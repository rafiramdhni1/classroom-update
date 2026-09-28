#!/bin/bash
# ============================================
# SMK TKJ Akademik - Migrasi Project ke VM
# ============================================
# Pakai:
#   bash migrate-to-vm.sh prepare   # MESIN LAMA: cek git, dump DB, kirim ke VM
#   bash migrate-to-vm.sh deploy    # VM: install docker, env, up container, restore DB
#   bash migrate-to-vm.sh verify    # VM: cek container, health, webhook, DB
#   bash migrate-to-vm.sh rollback  # VM: stop container (opsional hapus data)
#   bash migrate-to-vm.sh all       # prepare + ssh deploy + verify
#
# Semua variabel di bawah bisa dioverride dari luar, contoh:
#   VM_HOST=1.2.3.4 VM_MODE=https VM_DOMAIN=rapzz.my.id bash migrate-to-vm.sh all
#   VM_HOST=100.102.76.71 VM_USER=ec2-user VM_MODE=ts bash migrate-to-vm.sh all
#
# CATATAN TELEGRAM: project ini TIDAK memakai webhook Telegram.
#   - Notifikasi (cron 07:00/17:00) dikirim inline dari server.js
#   - Balasan students dibaca lewat bot-poll.js (long polling getUpdates)
#   Jadi tidak butuh URL publik. JANGAN menjalankan setWebhook.
# ============================================

set -euo pipefail

# ─────────────── KONFIGURASI (ubah di sini) ───────────────
VM_HOST="${VM_HOST:-}"                 # IP VM: private (VPC), Tailscale (100.x), atau public
VM_USER="${VM_USER:-ubuntu}"           # user SSH di VM (Amazon Linux: ec2-user)
VM_SSH_PORT="${VM_SSH_PORT:-22}"
VM_APP_DIR="${VM_APP_DIR:-/opt/classroom-update}"
VM_MODE="${VM_MODE:-http}"             # http = http://IP:$VM_HTTP_PORT | ts = + HTTPS via tailscale serve | https = 80/443 + Let's Encrypt
VM_DOMAIN="${VM_DOMAIN:-}"             # wajib kalau VM_MODE=https
VM_HTTP_PORT="${VM_HTTP_PORT:-8081}"
VM_MONGODB_PORT="${VM_MONGODB_PORT:-27017}"

SOURCE_DIR="${SOURCE_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
DB_NAME="${DB_NAME:-smk_akademik}"
DB_URI="${DB_URI:-mongodb://127.0.0.1:27017/$DB_NAME}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/migration-backup}"

ALLOW_DIRTY="${ALLOW_DIRTY:-0}"        # 1 = lanjut walau ada file belum di-commit
COPY_ENV="${COPY_ENV:-1}"              # 1 = kirim backend/.env ke VM
SKIP_BUILD="${SKIP_BUILD:-0}"          # 1 = jangan --build (pakai image lama)
# ─────────────────────────────────────────────────────────

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

step()  { echo -e "\n${BLUE}==>${NC} ${YELLOW}$*${NC}"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()   { echo -e "${RED}[FAIL]${NC} $*" >&2; }
die()   { err "$*"; exit 1; }

need_cmd() { command -v "$1" >/dev/null 2>&1 || die "Command '$1' tidak ada. Install dulu."; }
need_vm()  { [ -n "$VM_HOST" ] || die "VM_HOST belum diisi. Contoh: VM_HOST=1.2.3.4 bash migrate-to-vm.sh prepare"; }

ssh_vm() { ssh -p "$VM_SSH_PORT" -o BatchMode=yes -o ConnectTimeout=15 "$VM_USER@$VM_HOST" "$@"; }
scp_vm() { scp -P "$VM_SSH_PORT" -o BatchMode=yes -o ConnectTimeout=15 "$@"; }

# sudo non-interaktif: 'sudo' saja akan menggantung kalau VM minta password.
# Jalankan SELURUH string sebagai root di VM.
# PENTING: jangan pakai "sudo -n cmd1 && cmd2" — operator && dipecah oleh shell
# remote, sehingga hanya cmd1 yang Dapet sudo. cmd2 & seterusnya jadi user biasa
# dan gagal dengan "Permission denied" (kecuali di /opt yang sudah root-owned).
# Solusinya: kirim lewat stdin ke `bash -s`, jadi satu proses root utuh.
sudo_vm() { printf '%s\n' "$*" | ssh_vm "sudo -n bash -s"; }

preflight_vm() {
  step "0/5 Preflight koneksi SSH ke $VM_USER@$VM_HOST:$VM_SSH_PORT"
  ssh_vm "true" 2>/dev/null || die "Tidak bisa SSH ke $VM_USER@$VM_HOST:$VM_SSH_PORT.
  Cek: (1) IP benar, (2) port SSH terbuka, (3) public key sudah di ~/.ssh/authorized_keys VM.
  Public key mesin ini: $(cat "$HOME/.ssh/id_ed25519_vm.pub" 2>/dev/null || echo '<belum ada>')"
  ssh_vm "sudo -n true" 2>/dev/null || die "sudo di VM minta password, tapi eksekusi ini non-interaktif.
  Perbaiki salah satu:
    a) Beri passwordless sudo di VM:
         echo '$VM_USER ALL=(ALL) NOPASSWD:ALL' | sudo tee /etc/sudoers.d/99-$VM_USER-nopasswd
    b) Jalankan manual: ssh -t $VM_USER@$VM_HOST 'sudo mkdir -p $VM_APP_DIR && sudo chown $USER $VM_APP_DIR' lalu panggil ulang"
  local os
  os="$(ssh_vm "(. /etc/os-release 2>/dev/null && echo \$PRETTY_NAME) || cat /etc/system-release 2>/dev/null || echo unknown" | tr -d '\r')"
  ok "VM hidup: $os"
  ssh_vm "nproc | tr -d '\n' | sed 's/^/   CPU: /'; free -m | awk '/Mem:/{printf \"   RAM: %d MB\n\", \$2}'; df -h / | awk 'NR==2{printf \"   Disk: %s (sisa %s)\n\", \$2, \$4}'" | sed 's/^/  /'
  local ram
  ram="$(ssh_vm "free -m | awk '/Mem:/{print \$2}'")"
  if [ "${ram:-0}" -lt 1800 ]; then
    warn "RAM ${ram} MB < 2000 MB. Build frontend (Vite) berisiko OOM. Tambah swap dulu:"
    warn "  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile"
  fi
}

compose_cmd() {
  if [ "$VM_MODE" = "https" ]; then
    echo "docker compose -f docker-compose.yml -f docker-compose.ssl.yml"
  else
    echo "docker compose -f docker-compose.yml -f docker-compose.vm.yml"
  fi
}
# PENTING: ini path di MESIN VM (remote), bukan di mesin sumber.
# Jangan pakai $HOME lokal — user VM bisa berbeda (mis. ec2-user vs ubuntu),
# dan $HOME lokal tidak ada / tidak bisa ditulis di VM.
STAGE_DIR="${STAGE_DIR:-/tmp/.migrate-stage-$VM_USER}"

# ============================================
# prepare - jalan di MESIN LAMA
# ============================================
cmd_prepare() {
  need_cmd git mongodump mongosh rsync scp ssh
  need_vm
  [ "$VM_MODE" = "https" ] && [ -z "$VM_DOMAIN" ] && die "VM_MODE=https butuh VM_DOMAIN (domain yang aim ke IP VM)."

  preflight_vm

  step "1/5 Cek isi git di $SOURCE_DIR"
  local dirty
  dirty="$(git -C "$SOURCE_DIR" status --porcelain | wc -l | tr -d ' ')"
  if [ "$dirty" != "0" ]; then
    warn "$dirty file belum di-commit. File ini TIDAK akan ikut kalau VM pakai git clone."
    git -C "$SOURCE_DIR" status --short | sed 's/^/       /'
    if [ "$ALLOW_DIRTY" != "1" ]; then
      echo ""
      warn "Pilihan:"
      echo "    1) Commit dulu di mesin ini:"
      echo "       git -C $SOURCE_DIR add -A && git -C $SOURCE_DIR commit -m 'sync sebelum migrasi VM'"
      echo "    2) Tetap lanjut (file dikirim apa adanya via rsync):"
      echo "       ALLOW_DIRTY=1 bash migrate-to-vm.sh prepare"
      exit 1
    fi
    warn "ALLOW_DIRTY=1 -> lanjut, semua file dikirim apa adanya."
  else
    ok "Working tree bersih."
  fi

  step "2/5 Dump database '$DB_NAME' dari $DB_URI"
  mkdir -p "$BACKUP_DIR"
  local stamp dump
  stamp="$(date +%Y%m%d_%H%M%S)"
  dump="$BACKUP_DIR/${DB_NAME}_${stamp}.archive.gz"
  mongodump --uri "$DB_URI" --archive --gzip --quiet > "$dump"
  mongosh --quiet "$DB_URI" --eval \
    "print('   koleksi: ' + db.getCollectionNames().join(', '))" || true
  mongosh --quiet "$DB_URI" --eval 'print("   dokumen users: " + db.users.countDocuments())' || true
  ok "Dump: $dump ($(du -h "$dump" | cut -f1))"

  step "3/5 Kirim source project ke VM (node_modules tidak ikut)"
  ssh_vm "mkdir -p '$STAGE_DIR'"
  rsync -az --delete \
    --exclude 'node_modules/' \
    --exclude 'frontend/dist/' \
    --exclude 'backend/logs/' \
    --exclude 'backend/backups/' \
    --exclude '*.log' \
    "$SOURCE_DIR/" "$VM_USER@$VM_HOST:$STAGE_DIR/"
  ok "Source terkirim ke $VM_USER@$VM_HOST:$STAGE_DIR"

  step "4/5 Pindahkan ke $VM_APP_DIR + kirim dump database"
  sudo_vm "mkdir -p '$VM_APP_DIR' && cp -a '$STAGE_DIR/.' '$VM_APP_DIR/' && chown -R '$VM_USER:$VM_USER' '$VM_APP_DIR'" >/dev/null
  ssh_vm "rm -rf '$STAGE_DIR'"
  scp_vm "$dump" "$VM_USER@$VM_HOST:/tmp/"
  ssh_vm "mkdir -p '$VM_APP_DIR/migration-backup' && mv '/tmp/$(basename "$dump")' '$VM_APP_DIR/migration-backup/'"
  ok "Project di $VM_APP_DIR, dump di $VM_APP_DIR/migration-backup/"

  step "5/5 File .env (tidak ada di git, harus dikirim manual)"
  if [ "$COPY_ENV" = "1" ] && [ -f "$SOURCE_DIR/backend/.env" ]; then
    scp_vm "$SOURCE_DIR/backend/.env" "$VM_USER@$VM_HOST:/tmp/app.env"
    ssh_vm "cp /tmp/app.env '$VM_APP_DIR/backend/.env' && rm /tmp/app.env && chmod 600 '$VM_APP_DIR/backend/.env'"
    ok ".env terkirim (JWT_SECRET ikut sama -> sesi login tidak ikut logout)"
  else
    ssh_vm "cd '$VM_APP_DIR' && [ -f backend/.env ] || cp backend/.env.example backend/.env"
    warn ".env tidak dikirim. Isi manual di VM: nano $VM_APP_DIR/backend/.env"
  fi

  if [ -n "$VM_DOMAIN" ]; then
    local scheme="http"
    [ "$VM_MODE" = "https" ] && scheme="https"
    ssh_vm "cd '$VM_APP_DIR' && sed -i 's|^FRONTEND_URL=.*|FRONTEND_URL=$scheme://$VM_DOMAIN|' backend/.env && sed -i 's|^GOOGLE_REDIRECT_URI=.*|GOOGLE_REDIRECT_URI=$scheme://$VM_DOMAIN/api/auth/google/callback|' backend/.env"
    ok "FRONTEND_URL & GOOGLE_REDIRECT_URI diarahkan ke $scheme://$VM_DOMAIN"
  fi

  cat <<EOF

$GREEN---Source terkirim, lanjut di VM ---${NC}
  ssh -p $VM_SSH_PORT $VM_USER@$VM_HOST
  cd $VM_APP_DIR
  nano backend/.env          # cek GOOGLE_CLIENT_ID/SECRET, TELEGRAM_BOT_TOKEN, FRONTEND_URL
  bash migrate-to-vm.sh deploy
EOF
}

# ============================================
# deploy - jalan di VM
# ============================================
cmd_deploy() {
  need_cmd docker
  [ "$VM_MODE" = "https" ] && [ -z "$VM_DOMAIN" ] && die "VM_MODE=https butuh VM_DOMAIN."
  cd "$VM_APP_DIR"

  step "1/5 Pastikan Docker + Compose plugin"
  if ! docker compose version >/dev/null 2>&1; then
    warn "Compose plugin belum ada, Attempt install..."
    if command -v apt-get >/dev/null 2>&1; then
      sudo apt-get update -qq
      sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    elif command -v dnf >/dev/null 2>&1; then
      sudo dnf install -y docker-ce moby-engine || curl -fsSL https://get.docker.com | sh
    else
      curl -fsSL https://get.docker.com | sh
    fi
  fi
  sudo systemctl enable --now docker
  ok "Docker: $(docker --version), $(docker compose version)"

  step "2/5 Cek file .env"
  if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    die "backend/.env belum ada. Sudah dibuat dari .env.example - isi dulu, lalu ulangi: bash migrate-to-vm.sh deploy"
  fi
  chmod 600 backend/.env
  mkdir -p backend/logs backend/backups nginx/ssl
  ok ".env siap (mode 600)"

  step "3/5 Build & start container"
  local build_flag="--build"
  [ "$SKIP_BUILD" = "1" ] && build_flag=""
  # shellcheck disable=SC2046
  $(compose_cmd) up -d $build_flag
  ok "Container start: $(docker ps --filter name=smk- --format '{{.Names}}' | tr '\n' ' ')"

  step "4/5 Tunggu MongoDB sehat"
  local i
  for i in $(seq 1 30); do
    if [ "$(docker inspect -f '{{.State.Health.Status}}' smk-mongodb 2>/dev/null)" = "healthy" ]; then
      ok "MongoDB healthy (${i}x10s)"
      break
    fi
    [ "$i" = "30" ] && die "MongoDB tidak healthy. Cek: docker logs smk-mongodb --tail=50"
    sleep 10
  done

  step "5/5 Restore database dari dump"
  local dump
  dump="$(ls -t migration-backup/*.archive.gz migration-backup/*.gz 2>/dev/null | head -1 || true)"
  if [ -z "$dump" ]; then
    warn "Tidak ada file dump di $VM_APP_DIR/migration-backup/. Database tetap kosong."
  else
    echo "   Restore: $dump"
    docker exec -i smk-mongodb mongorestore --archive --gzip --drop < "$dump"
    docker exec smk-mongodb mongosh --quiet "mongodb://localhost/$DB_NAME" --eval \
      "print('   koleksi: ' + db.getCollectionNames().join(', ') + ' | users: ' + db.users.countDocuments())"
    ok "Database '$DB_NAME' restored"
  fi

  if [ "$VM_MODE" = "https" ]; then
    setup_ssl
  elif [ "$VM_MODE" = "ts" ]; then
    setup_tailscale_serve
  else
    warn "Mode HTTP murni: aplikasi di http://$VM_HOST:$VM_HTTP_PORT"
    warn "Google OAuth AKAN GAGAL (Google tolak redirect URI http non-localhost)."
    warn "Disarankan VM_MODE=ts (tailscale serve) - tanpa public IP, HTTPS asli."
  fi

  telegram_check
  verify_health
}

# ============================================
# Tailscale serve - untuk VM_MODE=ts
# ============================================
setup_tailscale_serve() {
  step "EXTRA Aktifkan HTTPS via Tailscale ( tanpa public IP )"
  if ! command -v tailscale >/dev/null 2>&1; then
    die "tailscale CLI tidak ada di VM. Install: curl -fsSL https://tailscale.com/install.sh | sh"
  fi

  local dns ts_url
  # Catatan: output `tailscale status --json` memformat dengan SPASI setelah
  # titik dua ("DNSName": "..."). Pola grep harus toleran whitespace,
  # kalau tidak DNSName terbaca kosong dan langkah ini di-skip/diam.
  dns="$(tailscale status --json 2>/dev/null \
    | grep -o '"DNSName"[[:space:]]*:[[:space:]]*"[^"]*"' \
    | head -1 | cut -d'"' -f4 | sed 's/\.$//')"
  ts_url="https://$dns"
  if [ -z "$dns" ]; then
    warn "Tidak bisa baca DNSName Tailscale. Cek manual: tailscale status"
    warn "Lalu jalankan: sudo tailscale serve --bg $VM_HTTP_PORT"
    return 0
  fi

  # Jangan arahkan output ke /dev/null: kalau gagal, script jadi mati diam-diam
  # tanpa pesan apa pun. Simpan log supaya error-nya bisa ditampilkan.
  local serve_log="/tmp/ts-serve.log"
  if ! sudo tailscale serve --bg "http://localhost:$VM_HTTP_PORT" >"$serve_log" 2>&1; then
    if ! sudo tailscale serve --bg "$VM_HTTP_PORT" >"$serve_log" 2>&1; then
      warn "tailscale serve GAGAL. Output:"
      sed 's/^/       /' "$serve_log"
      warn "Jalankan manual: sudo tailscale serve --bg $VM_HTTP_PORT"
      return 0
    fi
  fi

  # FRONTEND_URL + GOOGLE_REDIRECT_URI harus ikut ke URL HTTPS ini.
  sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=$ts_url|" backend/.env
  sed -i "s|^GOOGLE_REDIRECT_URI=.*|GOOGLE_REDIRECT_URI=$ts_url/api/auth/google/callback|" backend/.env
  ok "HTTPS: $ts_url"
  ok "FRONTEND_URL & GOOGLE_REDIRECT_URI di .env -> $ts_url"
  echo ""
  warn "WAJIB: daftarkan URL ini di Google Cloud Console > OAuth redirect URI:"
  echo "     $ts_url/api/auth/google/callback"
  echo ""
  warn "Tailscale serve hanya bisa diakses dari perangkat yang ada di tailnet."
  warn "Kalau mau bisa diakses tanpa Tailscale -> butuh Elastic IP + domain (mode https)."
}

# ============================================
# SSL - hanya untuk VM_MODE=https
# ============================================
setup_ssl() {
  step "EXTRA Pasang sertifikat Let's Encrypt untuk $VM_DOMAIN"
  mkdir -p nginx/ssl
  if [ -f nginx/ssl-conf/ssl.conf ]; then
    sed -i "s/DOMAIN_NAME/$VM_DOMAIN/g" nginx/ssl-conf/*.conf
    ok "Domain di nginx/ssl-conf/*.conf diganti jadi $VM_DOMAIN"
  else
    die "nginx/ssl-conf/ssl.conf tidak ada (file ini shipped bersama project)."
  fi

  # Certbot webroot butuh location /.well-known/acme-challenge/ di vhost HTTP.
  # shellcheck disable=SC2046
  $(compose_cmd) run --rm certbot certonly --webroot -w /var/www/certbot \
    -d "$VM_DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email || \
    die "Gagal terbit sertifikat. Pastikan DNS $VM_DOMAIN -> $VM_HOST dan port 80 terbuka."

  [ -f "nginx/ssl/live/$VM_DOMAIN/fullchain.pem" ] || die "Sertifikat tidak ditemukan di nginx/ssl/live/$VM_DOMAIN/."
  # shellcheck disable=SC2046
  $(compose_cmd) up -d nginx
  ok "HTTPS aktif: https://$VM_DOMAIN"
}

# ============================================
# Telegram - cek, JANGAN set webhook
# ============================================
telegram_check() {
  step "EXTRA Cek Telegram"
  local token info
  token="$(grep -E '^TELEGRAM_BOT_TOKEN=' backend/.env | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r')"
  if [ -z "$token" ]; then
    warn "TELEGRAM_BOT_TOKEN kosong di .env - notifikasi tidak akan terkirim."
    return 0
  fi
  info="$(curl -s --max-time 20 "https://api.telegram.org/bot$token/getWebhookInfo" || true)"
  local wh
  wh="$(echo "$info" | grep -o '"url": *"[^"]*"' | head -1 | cut -d'"' -f4 || true)"
  if [ -n "$wh" ]; then
    warn "Webhook aktif: $wh"
    warn "Project ini pakai long polling (bot-poll.js). Matikan webhook:"
    warn "  curl -X POST \"https://api.telegram.org/bot$TOKEN/deleteWebhook\""
    warn " Lalu jalankan: cd $VM_APP_DIR && node backend/bot-poll.js  (atau via pm2)"
  else
    ok "Webhook kosong (benar - project ini pakai long polling)"
  fi
  echo "   Notifikasi cron 07:00/17:00 jalan inline di server.js -> otomatis aktif."
  echo "   Balasan student butuh: node backend/bot-poll.js  (belum otomatis di Docker)"
}

# ============================================
# verify - jalan di VM
# ============================================
verify_health() {
  step "Cek health endpoint"
  local url
  case "$VM_MODE" in
    https) url="https://$VM_DOMAIN/api/health" ;;
    ts)
      local dns
      dns="$(grep -E '^FRONTEND_URL=' backend/.env | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\r')"
      url="${dns:-http://localhost:$VM_HTTP_PORT}/api/health"
      ;;
    *) url="http://localhost:$VM_HTTP_PORT/api/health" ;;
  esac
  # PENTING: script ini jalan DI VM itu sendiri. Tailscale serve tidak bisa
  # dijangkau dari node-nya sendiri (hairpin), jadi curls ke URL .ts.net akan
  # gagal padahal aplikasinya sehat. Karena itu selalu sediakan fallback lokal.
  local fallback="http://localhost:$VM_HTTP_PORT/api/health"
  if curl -sf --max-time 20 "$url" >/dev/null; then
    ok "Health OK: $url"
  elif [ "$url" != "$fallback" ] && curl -sf --max-time 20 "$fallback" >/dev/null; then
    ok "Health OK: $fallback"
    warn "URL Tailscale ($url) tidak bisa dijangkau DARI DALAM VM (hairpin, normal)."
    warn "Health dicek lewat localhost. Dari perangkat lain di tailnet harus OK:"
    warn "  curl -s $url"
  else
    err "Health GAGAL: $url"
    err "Health GAGAL juga di $fallback"
    return 1
  fi
}

cmd_verify() {
  cd "$VM_APP_DIR"
  step "1/4 Status container"
  # shellcheck disable=SC2046
  $(compose_cmd) ps

  step "2/4 Image & resource"
  docker images --format 'table {{.Repository}}\t{{.Size}}' | head -8 | sed 's/^/   /'
  df -h / | sed 's/^/   /'
  docker stats --no-stream --format '   {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}' 2>/dev/null || true

  step "3/4 Isi database"
  docker exec smk-mongodb mongosh --quiet "mongodb://localhost/$DB_NAME" --eval \
    "print('   koleksi: ' + db.getCollectionNames().join(', '))" 2>/dev/null || warn "MongoDB tidak bisa diakses."
  docker exec smk-mongodb mongosh --quiet "mongodb://localhost/$DB_NAME" --eval \
    "print('   users: ' + db.users.countDocuments() + ', students: ' + db.students.countDocuments())" 2>/dev/null || true

  step "4/4 Log aplikasi (30 baris terakhir)"
  docker logs smk-app --tail=30 2>&1 | sed 's/^/   /'

  if [ "${1:-}" = "--telegram" ]; then telegram_check; fi
  verify_health
}

# ============================================
# rollback - jalan di VM
# ============================================
cmd_rollback() {
  cd "$VM_APP_DIR"
  if [ "${1:-}" = "--purge" ]; then
    step "Rollback TOTAL: hapus container + volume database"
    # shellcheck disable=SC2046
    $(compose_cmd) down -v
    warn "Volume mongodb_data dihapus. Backup dump ada di $VM_APP_DIR/migration-backup/"
  else
    step "Rollback: stop container, database tetap disimpan"
    # shellcheck disable=SC2046
    $(compose_cmd) down
  fi
  ok "Selesai."
}

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
}

# ============================================
case "${1:-help}" in
  prepare)  cmd_prepare ;;
  deploy)   cmd_deploy ;;
  verify)   cmd_verify "${2:-}" ;;
  rollback) cmd_rollback "${2:-}" ;;
  all)      need_vm; cmd_prepare; ssh_vm "cd '$VM_APP_DIR' && VM_MODE='$VM_MODE' VM_DOMAIN='$VM_DOMAIN' VM_HTTP_PORT='$VM_HTTP_PORT' bash migrate-to-vm.sh deploy" ;;
  help|*)   usage ;;
esac
