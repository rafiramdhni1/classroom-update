# Migrasi Project ke VM

Checklist + skrip bantu pindah `classroom-update` dari mesin sekarang (Ubuntu 24.04, deploy via pm2) ke VM (Docker Compose).

Dua mode yang didukung `migrate-to-vm.sh`:

| Mode | Compose yang dipakai | Akses | Catatan |
|------|----------------------|-------|---------|
| `http` (default) | `docker-compose.yml` + `docker-compose.vm.yml` | `http://IP_VM:8080` | Telegram webhook **tidak** bisa dipakai (Telegram hanya mau URL HTTPS) |
| `https` | `docker-compose.yml` + `docker-compose.ssl.yml` | `https://domain` | Butuh DNS A record + port 80/443 terbuka |

---

## 0. Yang perlu disiapkan di VM

**Sistem**
- [ ] Ubuntu 22.04/24.04 atau Amazon Linux 2023, user non-root + `sudo`
- [ ] Docker Engine + plugin `docker compose` (otomatis dipasang oleh skrip, tapi butuh `curl`)
- [ ] Spec minimum: 2 vCPU, RAM 2 GB, disk 20 GB. Build frontend (Vite) butuh RAM, 1 GB sering OOM

**Jaringan**
- [ ] Port 22 (SSH) terbuka
- [ ] Port 80 + 443 terbuka (mode `https`), atau 8080 (mode `http`)
- [ ] Security Group di provider VPS + firewall host (`ufw allow 22,80,443/tcp`)

**Kredensial & Akun**
- [ ] User SSH + (recommended) keypair, sudah bisa `ssh user@IP_VM`
- [ ] Snapshot/backup VM baru sebelum eksekusi (sebagai insurance)

---

## 1. Di mesin lama (sumber) — siapkan & kirim

```bash
cd /home/ubuntu/classroom-update

# Commit dulu perubahan yang belum masuk git (penting!)
git status --short          # saat ini masih ada file belum di-commit
git add -A && git commit -m "sync sebelum migrasi VM"
git push origin main

# CekVM
VM_HOST=IP_VM_ANDA VM_USER=ubuntu VM_MODE=https VM_DOMAIN=domain-anda \
  bash migrate-to-vm.sh prepare
```

Yang dilakukan `prepare`:
1. Menolak jalan kalau working tree kotor (bypass: `ALLOW_DIRTY=1`)
2. `mongodump` database `smk_akademik` → `~/migration-backup/smk_akademik_<timestamp>.archive.gz`
3. `rsync` source ke VM (exclude `node_modules`, `dist`, `logs`, `backups`) → diletakkan di `$VM_APP_DIR`
4. Mengirim `backend/.env` (tidak ada di git karena `.gitignore`) + dump DB ke VM
5. Kalau `VM_DOMAIN` diisi, otomatis menulis `FRONTEND_URL` + `GOOGLE_REDIRECT_URI` di `.env` VM

> `JWT_SECRET` sengaja dibiarkan sama supaya sesi login yang sedang berjalan tidak ikut logout.

## 2. Di VM — install & jalankan

```bash
ssh ubuntu@IP_VM_ANDA
cd /opt/classroom-update

# Cek .env (wajib diisi manual: Google OAuth, Telegram token, dll)
nano backend/.env

# Build + start + restore DB + SSL + webhook Telegram
VM_MODE=https VM_DOMAIN=domain-anda bash migrate-to-vm.sh deploy
```

`deploy` melakukan: install Docker → build image → start container → tunggu MongoDB healthy → `mongorestore` dump → (mode https) terbitkan sertifikat Let's Encrypt → set webhook Telegram → cek `/api/health`.

## 3. Verifikasi

```bash
cd /opt/classroom-update
bash migrate-to-vm.sh verify            # container, DB, log, health
bash migrate-to-vm.sh verify --set-webhook   # ulangi set webhook Telegram
```

Manual:
```bash
curl -s https://domain-anda/api/health
docker compose -f docker-compose.yml -f docker-compose.ssl.yml ps
docker logs smk-app --tail=50
```

## 4. Yang harus di-update di luar VM

- [ ] **DNS**: A record `@` dan `www` diarahkan ke IP VM. Arahkan **setelah** step 2 sukses (kalau domain masih dipakai mesin lama, host sekarang, downtime = 0 dengan `TTL` rendah)
- [ ] **Google Cloud Console** → OAuth Client ID → *Authorized redirect URI* = `https://domain-anda/api/auth/google/callback`
- [ ] **Telegram** (BotFather) — webhook otomatis di-set oleh `deploy`, cek: `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
- [ ] **Google OAuth consent screen** — jika ada setting "Production" pastikan verifikasi domain sudah untuk domain baru

## 5. Checklist database (verifikasi data ikut moved)

Collection yang harus ada: `users`, `students`, `grades`, `classroomGrades`, `courseworkcaches`, `activationcodes`, `adminmessages`, `chatids`

```bash
docker exec smk-mongodb mongosh --quiet mongodb://localhost/smk_akademik \
  --eval 'db.getCollectionNames().forEach(c => print(c, db[c].countDocuments()))'
```

## 6. Opsional: auto-start & monitoring

- [ ] `restart: unless-stopped` sudah ada di compose, jadi container otomatis jalan setelah reboot
- [ ] **Backup harian** — crontab root:
  ```bash
  0 2 * * * docker exec smk-mongodb mongodump --archive --gzip > /backup/smk_akademik_$(date +\%F).archive.gz && find /backup -name '*.gz' -mtime +14 -delete
  ```
- [ ] **Watchdog** (opsional). Kalau dipakai, sesuaikan dengan container:
  ```bash
  */1 * * * * curl -sf --max-time 20 http://localhost/api/health >/dev/null || (cd /opt/classroom-update && docker compose -f docker-compose.yml -f docker-compose.ssl.yml restart app nginx) >> /var/log/app-watchdog.log 2>&1
  ```
  (script `.watchdog.sh` yang sekarang spesifik pm2 + systemd nginx, tidak bisa langsung dipakai di VM Docker)

---

## Update setelah migrasi

```bash
# Di mesin lama
git pull && bash migrate-to-vm.sh prepare   # kirim file terbaru ke VM

# Di VM
cd /opt/classroom-update && bash migrate-to-vm.sh deploy
```

Alternatif tanpa rsync: `git clone https://github.com/rafiramdhni1/classroom-update.git` di VM, lalu `git pull` + `deploy` untuk update berikutnya.

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
