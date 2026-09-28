# Migrasi Project ke VM

Checklist + skrip bantu pindah `classroom-update` dari mesin sekarang (Ubuntu 24.04, deploy via pm2) ke VM (Docker Compose).

Tiga mode yang didukung `migrate-to-vm.sh`:

| Mode | Compose yang dipakai | Akses | Catatan |
|------|----------------------|-------|---------|
| `ts` (**untuk VM tanpa public IP**) | `docker-compose.yml` + `docker-compose.vm.yml` | `https://<vm>.<tailnet>.ts.net` | Pakai `tailscale serve`, sertifikat asli dari Tailscale. Hanya bisa diakses dari perangkat di tailnet |
| `http` | `docker-compose.yml` + `docker-compose.vm.yml` | `http://IP_VM:8081` | **Google OAuth akan gagal** (Google menolak redirect URI `http://` non-localhost). Telegram tetap jalan |
| `https` | `docker-compose.yml` + `docker-compose.ssl.yml` | `https://domain` | Butuh public IP + DNS A record + port 80/443 terbuka dari internet |

### Kebutuhan public IP

| Fitur | Perlu public IP? |
|-------|------------------|
| Backend + frontend | Tidak |
| Telegram notifikasi (cron 07:00/17:00) | **Tidak** — dikirim inline dari `server.js` |
| Telegram balasan student | **Tidak** — `bot-poll.js` memakai long polling `getUpdates` |
| Google OAuth login (`/api/auth/google`) | **Ya, atau pakai `tailscale serve`** — Google mewajibkan HTTPS pada redirect URI |
| n8n webhook | Tidak, selama pemanggilnya di dalam tailnet |

> Jadi kalau satu-satunya yang butuh public IP adalah Google OAuth, `VM_MODE=ts` sudah cukup. Public IP + domain baru dibutuhkan hanya kalau app harus bisa diakses dari luar tailnet (mis. siswa tanpa Tailscale).

### Telegram: JANGAN set webhook

Project ini **tidak** memakai webhook Telegram:
- Notifikasi harian dikirim inline oleh cron di `backend/server.js` (`0 7`, `0 17`, `0 2` hari-it) — otomatis hidup begitu container jalan
- Balasan/kode aktivasi dibaca `backend/bot-poll.js` via long polling — **tidak** butuh URL publik

`./routes/webhook.js` punya `POST /api/webhook/telegram`, tapi itu jalur alternatif yang tidak dipakai. Jangan jalankan `setWebhook` — hanya akan mematikan polling. Kalau webhook terlanjur aktif, jalankan `deleteWebhook` lalu jalankan `bot-poll.js`.

---

## Hasil migrasi aktual (2026-09-28)

Sudah dieksekusi ke `tgcld-vm-1` (`100.102.76.71`, Amazon Linux 2023, user `ec2-user`).
URL: **`https://tgcld-vm-1.leopon-city.ts.net`** — hanya reachable dari perangkat dalam tailnet.

| | |
|---|---|
| Port HTTP | **8081** (bukan 8080 — sudah dipakai app `myapp` milik pemilik VM) |
| Docker | v25.0.14 + compose v5.5.1 + buildx v0.37.1 (harus dipasang manual) |
| Spes | 1 vCPU, 1.9 GB RAM, swap 8 GB, disk 25 GB |
| Data | users 214 · students 213 · coursework 386 (cocok dengan sumber) |

**Soal IP publik:** VM punya IP `103.210.35.18`, TAPI tidak ada inbound publik sama
sekali — port 22 pun tertutup dari internet (provider memblokir di edge), semua akses
lewat Tailscale. Jadi `0.0.0.0:80/443/8081` di compose **tidak** berarti terekspos
ke internet. Tetap ingat kalau later `INPUT` firewall di-open.

### ⚠️ Bot Telegram hanya boleh jalan di satu tempat

`docker compose up -d` akan ikut menyalakan service `bot-poll`. Kalau proyek ini
masih dilayani dari VPS lama, **`telegram-bot.service` di sana ikut polling bot yang
sama** → dua `getUpdates` saling menabrak → balasan siswa rusak di kedua sisi
(`Conflict: terminated by other getUpdates request`).

Selama cutover web belum dilakukan, `smk-bot-poll` di VM **harus tetap stopped**:
```bash
sudo docker compose -f docker-compose.yml -f docker-compose.vm.yml stop bot-poll
```
Begitu cutover web selesai (VPS lama dimatikan), nyalakan permanen:
```bash
sudo docker compose -f docker-compose.yml -f docker-compose.vm.yml up -d bot-poll
```

### Bug yang ditemukan & diperbaiki saat migrasi

1. **`sudo_vm()` hanya memberi sudo ke perintah pertama.** `sudo_vm "mkdir -p X && cp -a ..."`
   dipecah oleh `&&` di shell remote, jadi `cp`/`chown` jalan sebagai user biasa → `Permission denied`.
   Diperbaiki: kirim lewat stdin ke `sudo -n bash -s`.
2. **`STAGE_DIR` memakai `$HOME` lokal.** Hardcode `$HOME/.migrate-stage` = `/home/ubuntu/...`,
   padahal user VM `ec2-user` → tidak boleh bikin direktori di sana. Diganti
   `/tmp/.migrate-stage-$VM_USER`.
3. **Build gagal: `compose build requires buildx 0.17.0 or later`.** Compose v5 di VM
   butuh plugin buildx yang tidak ikut terpasang.
4. **`bot-poll.js` tidak pernah jalan di Docker.** `CMD` cuma `node server.js`, jadi
   balasan Telegram tidak akan berfungsi. Ditambahkan service `bot-poll` terpisah
   (bukan digabung, supaya crash-nya tidak menjatuhkan web server).
5. **502 Bad Gateway setelah container `app` di-recreate.** nginx me-resolve
   `app:5000` satu kali saat start lalu menyimpan IP-nya; begitu app di-recreate IP
   berubah, nginx memegang IP basi. Diperbaiki dengan `resolver 127.0.0.11 valid=10s;`
   + `proxy_pass $upstream_app;` (proxy_pass wajib pakai variabel supaya resolver berlaku).

### Verifikasi health dari dalam VM akan selalu GAGAL (itu normal)

`tailscale serve` tidak bisa dijangkau dari node-nya sendiri (*hairpin*).
`migrate-to-vm.sh verify` sudah otomatis fallback ke `http://localhost:8081/api/health`.
Dari perangkat lain di tailnet harus normal — cek dengan:
```bash
curl -s https://tgcld-vm-1.leopon-city.ts.net/api/health
```

---

## 0. Yang perlu disiapkan di VM

**Sistem**
- [ ] Ubuntu 22.04/24.04 atau Amazon Linux 2023, user non-root + `sudo`
- [ ] Docker Engine + plugin `docker compose` **dan `docker buildx`** (compose v5-buildx minimal 0.17.0; compose/buildx tidak ikut terpasang otomatis, harus manual — lihat bagian hasil migrasi)
- [ ] Spec minimum: 2 vCPU, RAM 2 GB, disk 20 GB. Build frontend (Vite) butuh RAM, 1 GB sering OOM
  > Terverifikasi jalan di 1 vCPU / 1.9 GB **asal swap sudah ada** (8 GB di VM tujuan). Tanpa swap, build Vite OOM.

**Jaringan** (kalau VM tidak punya public IP, sebagian besar lewati)
- [ ] Port 22 (SSH) terbuka
- [ ] Mode `ts`: Tailscale terinstall & login di VM, `tailscale status` OK
- [ ] Mode `https`: port 80 + 443 terbuka dari internet + DNS A record → IP public
- [ ] Mode `http`: port 8081 terbuka (hanya reachable lewat Tailscale/VPC)
- [ ] Security Group di AWS: **jangan** buka 27017 ke mana pun (compose sudah bind ke `127.0.0.1`)

**Kredensial & Akun**
- [ ] User SSH + keypair, sudah bisa `ssh user@IP_VM`
- [ ] Passwordless sudo (`ec2-user` di Amazon Linux sudah default NOPASSWD)
- [ ] Snapshot/backup VM sebelum eksekusi

---

## 1. Di mesin lama (sumber) — siapkan & kirim

```bash
cd /home/ubuntu/classroom-update

# Commit dulu perubahan yang belum masuk git (penting!)
git status --short
git add -A && git commit -m "sync sebelum migrasi VM"

# Kirim ke VM (harus dijalankan dari mesin yang ada di tailnet)
VM_HOST=100.102.76.71 VM_USER=ec2-user VM_MODE=ts \
  bash migrate-to-vm.sh prepare
```

> Kalau mesin sumber **tidak** ada di tailnet (Tailscale belum terinstall), `prepare` tidak bisa pakai SSH.
> Pakic `ALLOW_DIRTY`/`rsync` manual — lihat bagian "Kalau tidak bisa SSH" di bawah.

Yang dilakukan `prepare`:
1. Preflight: cek SSH, cek passwordless sudo, cek RAM/CPU/disk VM
2. Menolak jalan kalau working tree kotor (bypass: `ALLOW_DIRTY=1`)
3. `mongodump` database `smk_akademik` → `~/migration-backup/smk_akademik_<timestamp>.archive.gz`
4. `rsync` source ke VM (exclude `node_modules`, `dist`, `logs`, `backups`) → diletakkan di `$VM_APP_DIR`
5. Mengirim `backend/.env` (tidak ada di git karena `.gitignore`) + dump DB ke VM

> `JWT_SECRET` sengaja dibiarkan sama supaya sesi login yang sedang berjalan tidak ikut logout.

## 2. Di VM — install & jalankan

```bash
ssh ec2-user@100.102.76.71
cd /opt/classroom-update

# Cek .env (wajib: Google OAuth, token Telegram)
nano backend/.env

# Build + start + restore DB + tailscale serve
VM_MODE=ts bash migrate-to-vm.sh deploy
```

`deploy` melakukan: install Docker → build image → start container → tunggu MongoDB healthy → `mongorestore` dump → (mode `ts`) `tailscale serve` + tulis `FRONTEND_URL`/`GOOGLE_REDIRECT_URI` ke `.env` → cek `/api/health`.

## 3. Verifikasi

```bash
cd /opt/classroom-update
bash migrate-to-vm.sh verify            # container, DB, log, health
bash migrate-to-vm.sh verify --telegram  # cek status webhook + polling
```

Manual:
```bash
curl -s https://<vm>.<tailnet>.ts.net/api/health
docker compose -f docker-compose.yml -f docker-compose.vm.yml ps
docker logs smk-app --tail=50
```

## 4. Yang harus di-update di luar VM

- [ ] **Google Cloud Console** → OAuth Client ID → *Authorized redirect URI* = URL yang tadi dicetak `deploy` (mode `ts`: `https://<vm>.<tailnet>.ts.net/api/auth/google/callback`; mode `https`: `https://domain-anda/api/auth/google/callback`)
- [ ] **Google OAuth consent screen** — kalau statusnya "Production", domain baru harus diverifikasi
- [ ] **DNS + Elastic IP** (hanya mode `https`): attach Elastic IP di AWS Console → A record `@`/`www` → IP tersebut. Arahkan **setelah** step 2 sukses, supaya downtime ≈ 0 (turunkan `TTL` H-1)
- [ ] **Telegram** — tidak perlu setWebhook. Kalau `verify --telegram` menandai webhook aktif, jalankan `deleteWebhook` lalu nyalakan `node backend/bot-poll.js`
- [ ] **n8n** (kalau dipakai, lihat `n8n/workflow-*.json`) — hostname webhook diarahkan ke URL baru

## 5. Checklist database (verifikasi data ikut pindah)

Collection yang harus ada: `users`, `students`, `grades`, `classroomcaches`, `courseworkcaches`, `activationcodes`, `adminmessages`, `chatids`

```bash
docker exec smk-mongodb mongosh --quiet mongodb://localhost/smk_akademik \
  --eval 'db.getCollectionNames().forEach(c => print(c, db[c].countDocuments()))'
```

## 6. Opsional: auto-start & monitoring

- [x] `restart: unless-stopped` sudah ada di compose, jadi container otomatis jalan setelah reboot
- [x] `sudo systemctl enable tailscaled` — Tailscale harus auto-start supaya `tailscale serve` aktif setelah reboot
- [x] **Backup harian** — Amazon Linux 2023 tidak punya `crontab` (paket `cronie` belum terpasang), jadi pakai **systemd timer** supaya tidak perlu menambah paket di VM orang lain:
  ```bash
  # skrip: /usr/local/bin/smk-backup.sh  (mongodump + retensi 14 hari, root:root 755)
  # unit:  /etc/systemd/system/smk-backup.{service,timer}
  sudo systemctl enable --now smk-backup.timer
  systemctl list-timers smk-backup.timer     # cek jadwal
  sudo systemctl start smk-backup.service    # tes manual
  ```
  > Host VM berjalan di **UTC**, jadi `OnCalendar=*-*-* 01:30:00 UTC` = 08:30 WIB. Dipilih agar tidak bentrok dengan cron internal app (notifikasi 07:00/17:00 dan sync 02:00 — semuanya WIB karena container pakai `TZ=Asia/Jakarta`).
- [ ] **Watchdog** (opsional) — timer systemd 2 menit:
  ```bash
  */2 * * * * curl -sf --max-time 20 http://localhost:8081/api/health >/dev/null || (cd /opt/classroom-update && docker compose -f docker-compose.yml -f docker-compose.vm.yml restart app nginx) >> /var/log/app-watchdog.log 2>&1
  ```
  (`.watchdog.sh` yang sekarang spesifik pm2 + systemd nginx, tidak bisa dipakai di VM Docker)

---

## Kalau tidak bisa SSH dari mesin sumber

Kalau mesin sumber tidak ada di tailnet, `prepare` (yang pakai `rsync` over SSH) tidak bisa jalan. Dua jalan keluar:

**Opsi A — install Tailscale di mesin sumber** (paling enak, automation jadi penuh)
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --authkey=tskey-auth-xxxx   # generate di https://login.tailscale.com/admin/settings/keys
ssh ec2-user@100.102.76.71 'echo ok'          # tes
VM_HOST=100.102.76.71 VM_USER=ec2-user VM_MODE=ts bash migrate-to-vm.sh prepare
```

**Opsi B — paket manual** (butuh satu `scp` dari komputer yang ada di tailnet)
```bash
# Di mesin ini (sumber)
mongodump --uri "mongodb://127.0.0.1:27017/smk_akademik" --archive --gzip > smk_akademik.archive.gz
tar czf classroom-update.tar.gz --exclude=node_modules --exclude=frontend/dist \
    --exclude=backend/logs --exclude=backend/backups -C /home/ubuntu classroom-update

# Di komputer yang ada di tailnet
scp <sumber>:smk_akademik.archive.gz . && scp <sumber>:classroom-update.tar.gz .
scp smk_akademik.archive.gz classroom-update.tar.gz ec2-user@100.102.76.71:/tmp/

# Di VM
sudo mkdir -p /opt/classroom-update/migration-backup
sudo tar xzf /tmp/classroom-update.tar.gz -C /tmp
sudo cp -a /tmp/classroom-update/. /opt/classroom-update/
sudo chown -R ec2-user:ec2-user /opt/classroom-update
mv /tmp/smk_akademik.archive.gz /opt/classroom-update/migration-backup/
cd /opt/classroom-update && VM_MODE=ts bash migrate-to-vm.sh deploy
```

## Update setelah migrasi

```bash
# Di mesin sumber (perlu di tailnet)
VM_HOST=100.102.76.71 VM_USER=ec2-user VM_MODE=ts bash migrate-to-vm.sh prepare

# Di VM
cd /opt/classroom-update && VM_MODE=ts bash migrate-to-vm.sh deploy
```

Alternatif tanpa rsync: `git clone https://github.com/rafiramdhni1/classroom-update.git` di VM (repo-nya private → butuh deploy key atau token), lalu `git pull` + `deploy` untuk update berikutnya.

## Rollback

```bash
cd /opt/classroom-update
bash migrate-to-vm.sh rollback            # stop container, data DB tetap
bash migrate-to-vm.sh rollback --purge    # hapus juga volume database
```

Rollback ke mesin lama: kembalikan DNS A record ke IP mesin lama, `pm2 restart backend frontend`.

---

## Catatan penting

- **Build frontend butuh RAM**: kalau VM cuma 1 GB, `npm run build` (Vite) di stage 1 Dockerfile bisa OOM. Solusikan: tambah swap (`fallocate -l 2G /swapfile; chmod 600 /swapfile; mkswap /swapfile; swapon /swapfile`) atau naikkan RAM ke 2 GB.
- **Jangan pernah** commit `backend/.env` — isinya berisi `JWT_SECRET`, token Telegram, dan Google client secret.
- **Volume `mongodb_data`** yang menyimpan data. Kalau `docker compose down -v` dijalankan, data hilang (pakai `rollback`, bukan `rollback --purge`, kalau tidak sengaja).
- `nginx/conf.d/rapzz.my.id.conf` dan `01-https.conf` di repo sudah **tidak berlaku** (menunjuk ke Vite dev server `:5173` dan service `frontend`/`backend` yang tidak ada). Untuk mode `https` pakai `nginx/ssl-conf/`, untuk mode `http` pakai `nginx/vm-conf/`.
