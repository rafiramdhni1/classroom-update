# Migrasi Project ke VM

Checklist + skrip bantu pindah `classroom-update` dari mesin sekarang (Ubuntu 24.04, deploy via pm2) ke VM (Docker Compose).

Tiga mode yang didukung `migrate-to-vm.sh`:

| Mode | Compose yang dipakai | Akses | Catatan |
|------|----------------------|-------|---------|
| `ts` (**untuk VM tanpa public IP**) | `docker-compose.yml` + `docker-compose.vm.yml` | `https://<vm>.<tailnet>.ts.net` | Pakai `tailscale serve`, sertifikat asli dari Tailscale. Hanya bisa diakses dari perangkat di tailnet |
| `http` | `docker-compose.yml` + `docker-compose.vm.yml` | `http://IP_VM:8080` | **Google OAuth akan gagal** (Google menolak redirect URI `http://` non-localhost). Telegram tetap jalan |
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

## 0. Yang perlu disiapkan di VM

**Sistem**
- [ ] Ubuntu 22.04/24.04 atau Amazon Linux 2023, user non-root + `sudo`
- [ ] Docker Engine + plugin `docker compose` (otomatis dipasang oleh skrip, tapi butuh `curl`)
- [ ] Spec minimum: 2 vCPU, RAM 2 GB, disk 20 GB. Build frontend (Vite) butuh RAM, 1 GB sering OOM

**Jaringan** (kalau VM tidak punya public IP, sebagian besar lewati)
- [ ] Port 22 (SSH) terbuka
- [ ] Mode `ts`: Tailscale terinstall & login di VM, `tailscale status` OK
- [ ] Mode `https`: port 80 + 443 terbuka dari internet + DNS A record → IP public
- [ ] Mode `http`: port 8080 terbuka (hanya reachable lewat Tailscale/VPC)
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

- [ ] `restart: unless-stopped` sudah ada di compose, jadi container otomatis jalan setelah reboot
- [ ] `sudo systemctl enable tailscaled` — Tailscale harus auto-start supaya `tailscale serve` aktif setelah reboot
- [ ] **Backup harian** — crontab root:
  ```bash
  0 2 * * * docker exec smk-mongodb mongodump --archive --gzip > /opt/backup/smk_akademik_$(date +\%F).archive.gz && find /opt/backup -name '*.gz' -mtime +14 -delete
  ```
- [ ] **Watchdog** (opsional) — cron di VM:
  ```bash
  */2 * * * * curl -sf --max-time 20 http://localhost:8080/api/health >/dev/null || (cd /opt/classroom-update && docker compose -f docker-compose.yml -f docker-compose.vm.yml restart app nginx) >> /var/log/app-watchdog.log 2>&1
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
