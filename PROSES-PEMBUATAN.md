# Panduan Proses Pembuatan Project

> Dokumen ini menjelaskan **proses pembuatan** project Sistem Informasi Akademik SMK TKJ dari awal sampai akhir, dengan bahasa yang mudah dipahami. Dibuat untuk membantu siapa saja memahami bagaimana project ini dibangun langkah demi langkah.

---

## Daftar Isi

1. [Apa Itu Project Ini?](#1-apa-itu-project-ini)
2. [Persiapan Sebelum Mulai](#2-persiapan-sebelum-mulai)
3. [Tahap 1 - Membuat Struktur Folder](#3-tahap-1---membuat-struktur-folder)
4. [Tahap 2 - Membuat Backend (Server API)](#4-tahap-2---membuat-backend-server-api)
5. [Tahap 3 - Membangun Autentikasi Login](#5-tahap-3---membangun-autentikasi-login)
6. [Tahap 4 - Membuat Data Siswa & Mengisi Data Awal](#6-tahap-4---membuat-data-siswa--mengisi-data-awal)
7. [Tahap 5 - Membuat Dashboard Nilai & Ranking](#7-tahap-5---membuat-dashboard-nilai--ranking)
8. [Tahap 6 - Integrasi Google Classroom](#8-tahap-6---integrasi-google-classroom)
9. [Tahap 7 - Membuat Bot Telegram](#9-tahap-7---membuat-bot-telegram)
10. [Tahap 8 - Membuat Panel Admin](#10-tahap-8---membuat-panel-admin)
11. [Tahap 9 - Menambahkan Tugas Otomatis (Cron Job)](#11-tahap-9---menambahkan-tugas-otomatis-cron-job)
12. [Tahap 10 - Membuat Frontend (Tampilan Web)](#12-tahap-10---membuat-frontend-tampilan-web)
13. [Tahap 11 - Menghubungkan Frontend ke Backend](#13-tahap-11---menghubungkan-frontend-ke-backend)
14. [Tahap 12 - Menjalankan & Menguji Secara Lokal](#14-tahap-12---menjalankan--menguji-secara-lokal)
15. [Tahap 13 - Deploy ke Server (VPS) dengan Docker](#15-tahap-13---deploy-ke-server-vps-dengan-docker)
16. [Tahap 14 - Deploy Otomatis dengan GitHub Actions](#16-tahap-14---deploy-otomatis-dengan-github-actions)
17. [Tahap 15 - Backup, Monitoring & Pemeliharaan](#17-tahap-15---backup-monitoring--pemeliharaan)
18. [Ringkasan Urutan Pekerjaan](#18-ringkasan-urutan-pekerjaan)

---

## 1. Apa Itu Project Ini?

Project ini adalah **website sistem informasi akademik** untuk sekolah SMK jurusan TKJ (Teknik Komputer dan Jaringan). Fungsinya:

- **Siswa** bisa login dan melihat nilai, ranking kelas, dan pesan dari sekolah.
- **Orang tua** bisa memantau nilai anaknya.
- **Admin / guru** bisa mengelola data siswa, mengirim pesan, dan membuat kode aktivasi.
- **Bot Telegram** mengirim notifikasi tugas yang belum dikerjakan.
- Data nilai bisa **tersinkron otomatis dari Google Classroom**.

### Teknologi yang Dipakai

| Bagian | Teknologi | Fungsinya |
|--------|-----------|-----------|
| Backend (server) | Node.js + Express.js | Membuat REST API (jembatan antara website dan database) |
| Database | MongoDB + Mongoose | Menyimpan data siswa, nilai, akun, dll. |
| Keamanan login | JWT + bcrypt | Token login + enkripsi password |
| Frontend (tampilan) | React + Vite + Tailwind CSS | Membuat halaman web yang interaktif |
| Bot notifikasi | Telegram Bot API | Mengirim notifikasi ke Telegram |
| Integrasi nilai | Google Classroom API | Menarik data tugas dari Google Classroom |
| Tugas terjadwal | node-cron | Menjalankan tugas otomatis (sinkronisasi, backup) |
| Deploy | Docker + Docker Compose + Nginx | Menjalankan di server |

**Singkatnya alurnya:**
```
User (siswa/guru) → Website React → Server API (Express) → Database (MongoDB)
                                            ↓
                                Google Classroom / Telegram
```

---

## 2. Persiapan Sebelum Mulai

Sebelum membuat project, siapkan hal-hal berikut:

### 2.1 Tools yang Harus Diinstal
- **Node.js** versi 18 atau lebih baru (untuk menjalankan kode JavaScript di server).
- **MongoDB** versi 7 (untuk database). Bisa dipasang lokal atau menggunakan layanan cloud.
- **Git** (untuk menyimpan versi kode).
- **Editor kode** seperti VS Code.

> Cara cek sudah terinstal atau belum:
> ```bash
> node -v   # cek versi Node.js
> npm -v    # cek versi npm
> ```

### 2.2 Akun yang Harus Disiapkan
- **Bot Telegram** — buat lewat @BotFather di Telegram untuk mendapatkan Token Bot.
- **Google Cloud Project** — aktifkan API Google Classroom dan buat OAuth (Client ID + Secret) agar bisa menarik data kelas.
- **Akun GitHub** — untuk menyimpan kode dan membuat deploy otomatis.

### 2.3 Konsep yang Wajib Dipahami
- **API**: sebuah "jembatan" di server yang bisa diminta datanya oleh website melalui URL.
- **Database**: tempat penyimpanan data. MongoDB menyimpan data dalam bentuk "collection" (mirip folder) dan "document" (mirip baris data).
- **JWT**: semacam "kartu akses" yang diberikan saat login, agar server tahu siapa yang sedang mengakses.

Siap? Mari mulai!

---

## 3. Tahap 1 - Membuat Struktur Folder

Buat folder utama project, lalu bagi menjadi 2 bagian besar: folder `backend` (server) dan `frontend` (tampilan).

```bash
mkdir smk-akademik
cd smk-akademik
mkdir backend frontend
```

Struktur akhirnya seperti ini:
```
smk-akademik/
├── backend/          # Semua kode server
│   ├── models/       # Struktur data (schema) MongoDB
│   ├── routes/       # Daftar alamat API
│   ├── services/     # Logika khusus (Telegram, Google, dll)
│   ├── middleware/   # Pengaman (auth, validasi)
│   ├── seeds/        # Script pengisi data awal
│   ├── config/       # Konfigurasi koneksi database
│   └── utils/        # Bantuan umum (logger)
├── frontend/         # Semua kode tampilan
│   └── src/
│       ├── pages/    # Halaman (Login, Dashboard, Admin)
│       ├── contexts/ # State login
│       └── utils/    # Koneksi ke API
├── nginx/            # Konfigurasi web server
├── n8n/              # Workflow otomatis (bonus)
└── docker-compose.yml # Script menjalankan semuanya di server
```

---

## 4. Tahap 2 - Membuat Backend (Server API)

Backend adalah "otak" project. Semua permintaan dari website diproses di sini.

### 4.1 Inisialisasi Project Backend

Masuk ke folder `backend`, lalu buat file `package.json` (daftar kebutuhan project):

```bash
cd backend
npm init -y
```

### 4.2 Install Dependensi (Library Bantuan)

```bash
npm install express mongoose bcryptjs jsonwebtoken cors dotenv node-cron googleapis node-fetch express-rate-limit winston zod
npm install --save-dev nodemon
```

Penjelasan singkat:
- `express` — bikin server API.
- `mongoose` — menghubungkan & membuat data MongoDB.
- `bcryptjs` — enkripsi password.
- `jsonwebtoken` — membuat token login (JWT).
- `dotenv` — membaca file `.env` (tempat menyimpan kunci rahasia).
- `node-cron` — tugas otomatis terjadwal.
- `googleapis` — akses API Google Classroom.
- `node-fetch` — memanggil API lain (misal Telegram).
- `express-rate-limit` — mencegah percobaan login berulang (bruteforce).
- `zod` — validasi input dari user.
- `winston` — mencatat log (catatan aktivitas server).
- `nodemon` — otomatis restart server saat kode berubah (untuk pengembangan).

### 4.3 Membuat File Konfigurasi Rahasia (.env)

Buat file `.env` untuk menyimpan kunci-kunci rahasia. **File ini tidak boleh diunggah ke GitHub** (simpan daftarnya di `.env.example` sebagai contoh):

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/smk_akademik
JWT_SECRET=kunci-rahasia-login
JWT_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=id-dari-google
GOOGLE_CLIENT_SECRET=secret-dari-google
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
TELEGRAM_BOT_TOKEN=token-dari-botfather
FRONTEND_URL=http://localhost:5000
```

### 4.4 Membuat Koneksi ke Database

Buat file `backend/config/db.js` untuk menghubungkan ke MongoDB:

```javascript
const mongoose = require('mongoose');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB terhubung');
  } catch (err) {
    console.error('Gagal konek MongoDB:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
```

### 4.5 Membuat Server Utama

Buat file `backend/server.js` — ini yang paling penting. Fungsinya:
1. Membaca konfigurasi dari `.env`.
2. Menyambungkan database.
3. Mengaktifkan Express (server API).
4. Mendaftarkan semua route (alamat API).
5. Menjalankan server di port 5000.
6. Menjadwalkan tugas otomatis (cron).

```javascript
const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json()); // agar bisa membaca data JSON dari request

// Daftarkan route API
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/tools', toolsRoutes);
app.use('/api/grades', gradesRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));
```

**Catatan penting:**
- Tambahkan `rate limit` (batas jumlah request) agar server tidak diserang.
- Tambahkan pengaman untuk error agar server tidak berhenti tiba-tiba.

---

## 5. Tahap 3 - Membangun Autentikasi Login

Ini bagian yang membuat user bisa login. Alurnya:

```
User kirim NIS + password → Server cek ke database → Cocok? → Beri token JWT
```

### 5.1 Membuat Model User (Struktur Data Akun)

Buat file `backend/models/User.js`. Isinya mendefinisikan akun apa saja yang bisa login:

- `nis` / `nisn` — nomor induk siswa.
- `password` — disimpan dalam keadaan terenkripsi (bcrypt).
- `role` — peran pengguna: `student` (siswa), `parent` (orang tua), `admin`, atau `guru`.
- `studentId` — tautan ke data siswa.
- `mustChangePassword` — tanda user harus ganti password saat pertama login.

Fun fact: Enkripsi password otomatis terjadi lewat kode ini:

```javascript
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});
```

Artinya: setiap kali password disimpan, password itu langsung diacak (hash) dahulu — jadi tidak ada yang bisa membaca password asli, bahkan admin sekalipun.

### 5.2 Membuat Endpoint Login

Buat `backend/routes/auth.js` dengan beberapa alamat API:

| Alamat API | Fungsi |
|------------|--------|
| `POST /api/auth/login` | Login dengan NIS/NISN + password |
| `POST /api/auth/change-password` | Ganti password |
| `POST /api/auth/forgot-password` | Lupa password (kirim OTP ke Telegram) |
| `POST /api/auth/verify-otp` | Verifikasi kode OTP |
| `GET /api/auth/me` | Melihat data user yang sedang login |
| `GET /api/auth/google` | Login/tautkan Google Classroom |

Proses login di dalam kode:
1. Terima NIS dan password dari frontend.
2. Cari user di database berdasarkan NIS.
3. Bandingkan password (pakai fungsi `comparePassword`).
4. Kalau cocok → buat token JWT → kirim balik ke frontend.
5. Frontend menyimpan token dan memakainya untuk permintaan berikutnya.

### 5.3 Membuat Middleware Auth (Pengaman)

Buat `backend/middleware/auth.js`. Fungsinya memeriksa **apakah setiap permintaan membawa token yang valid**. Kalau tidak, permintaan ditolak. Token bisa diperiksa lewat `Authorization: Bearer <token>`.

```javascript
const jwt = require('jsonwebtoken');

module.exports = function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Tidak login' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token tidak valid' });
  }
};
```

Semua endpoint yang memakai middleware `auth` **hanya bisa diakses oleh user yang sudah login**.

---

## 6. Tahap 4 - Membuat Data Siswa & Mengisi Data Awal

Database butuh "modal awal": daftar siswa, kelas, dan akun untuk login.

### 6.1 Membuat Model Student

Buat `backend/models/Student.js` untuk menyimpan: `nis`, `nisn`, `nama`, `jenis kelamin`, `kelas`, `angkatan`, `nama orang tua`, `nomor telepon orang tua`, `classroomId` (ID user di Google Classroom), dan `isActive`.

Kelas yang didukung: `X-TKJ1`, `X-TKJ2`, `XI-TKJ1`, `XI-TKJ2`, `XII-TKJ1`, `XII-TKJ2`.

### 6.2 Membuat Script Seed (Pengisi Data)

Buat `backend/seeds/seed.js`. Script ini dijalankan sekali untuk:
1. Menghapus data lama (agar bersih).
2. Membuat akun admin pertama (`nis: admin`, `password: admin123`).
3. Membaca data siswa dari file JSON/CSV.
4. Membuat akun untuk tiap siswa (password awal default, dan wajib ganti password saat masuk).

```bash
node seeds/seed.js
```

Model data lain yang dibuat di tahap yang sama (di dalam folder `models/`):
- `Grade.js` — menyimpan nilai per mata pelajaran.
- `ActivationCode.js` — kode aktivasi untuk siswa baru.
- `AdminMessage.js` — pesan dari admin.
- `ChatId.js` — daftar chat Telegram yang terhubung per siswa.
- `CourseworkCache.js` — cache data tugas dari Google Classroom (biar cepat, tidak perlu minta lagi ke Google setiap saat).

---

## 7. Tahap 5 - Membuat Dashboard Nilai & Ranking

Dashboard adalah halaman utama yang dilihat siswa setelah login.

### 7.1 Membuat Route Dashboard

Buat `backend/routes/dashboard.js`. Endpoint `GET /api/dashboard` akan merangkum:
- **Nilai** semua mata pelajaran siswa tersebut.
- **Ranking** posisi siswa di kelas dan angkatan.
- **Pesan** dari admin.

### 7.2 Logika Ranking

Ranking dihitung dengan cara:
1. Ambil semua nilai siswa sekelas.
2. Hitung rata-rata tiap orang.
3. Urutkan rata-rata dari tertinggi ke terendah.
4. Cari posisi user yang sedang login.

### 7.3 Model Grade

Mata pelajaran yang dipakai (kode singkat):
| Kode | Nama Lengkap |
|------|--------------|
| ASJ | Administrasi Sistem Jaringan |
| AIJ | Administrasi Infrastruktur Jaringan |
| TJBL | Tata Jaringan Berbasis Luas |
| PKDK | Pemodelan dan Komunikasi Data |
| TJKT | Teknologi Jaringan Komputer dan Telekomunikasi |

Nilai bisa diisi manual oleh admin (`routes/manual grades`) atau ditarik otomatis dari Google Classroom.

---

## 8. Tahap 6 - Integrasi Google Classroom

Sistem bisa mengambil data tugas & nilai langsung dari Google Classroom.

### 8.1 Persiapan OAuth di Google

1. Buka Google Cloud Console → buat project.
2. Aktifkan **Google Classroom API**.
3. Buat **OAuth Client** → dapatkan Client ID + Client Secret.
4. Masukkan ke file `.env`.

### 8.2 Membuat Service Classroom

Buat `backend/services/classroom.js`. Isinya:
- `getAuthUrl(state)` — membuat link "Masuk dengan Google".
- `getTokensFromCode(code)` — menukar kode otorisasi menjadi token akses.
- `syncAllCourses(userId)` — menarik semua kelas/course dari Google Classroom, lalu menyimpan tugas dan nilai ke MongoDB.

Alur sinkronisasi:
1. Admin/guru klik "Hubungkan Google Classroom".
2. Login ke Google → Google kasih izin → server dapat token.
3. Server minta daftar course (kelas) ke API Google.
4. Untuk setiap course, cek nama course: kalau mengandung "ASJ/AIJ/TJBL/PKDK/TJKT" → dikenali sebagai mata pelajaran.
5. Tarik daftar tugas (coursework) beserta pengumpulan (submissions) siswa.
6. Cocokkan user Google dengan siswa di database (lewat `classroomId`).
7. Simpan hasilnya ke MongoDB dan tampilkan di dashboard.

**Teknis penting:** agar tidak kena limit Google, permintaan dikerjakan "berurutan dengan concurrency kecil" (misal 3-4 course dalam satu waktu), bukan semua sekaligus.

---

## 9. Tahap 7 - Membuat Bot Telegram

Bot digunakan untuk notifikasi nilai/tugas dan juga untuk reset password (OTP).

### 9.1 Membuat Bot di Telegram
1. Chat ke **@BotFather** di Telegram.
2. Ketik `/newbot` → ikuti instruksi → dapatkan **Token**.
3. Masukkan token ke `.env`.

### 9.2 Kode Bot

Ada dua cara server menerima pesan bot:
1. **Polling** (`backend/bot-poll.js`) — bot aktif mengecek pesan masuk tiap waktu.
2. **Webhook** (`backend/routes/webhook.js`) — Telegram yang mengirim pesan ke server saat ada pesan masuk.

Kode `backend/services/telegram.js` berisi fungsi umum seperti `sendTelegramMessage(chatId, teks)`:
```javascript
const url = `https://api.telegram.org/bot${token}/sendMessage`;
await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chat_id: chatId, text: teks, parse_mode: 'Markdown' }),
});
```

Fitur bot:
- Mengirim **notifikasi** ke orang tua saat tugas belum dikerjakan.
- Mengirim **OTP** kode reset password ke Telegram orang tua.
- Mencatat `chatId` (ke folder `ChatId`) saat user berinteraksi dengan bot, agar notifikasi tahu mau dikirim ke mana.

---

## 10. Tahap 8 - Membuat Panel Admin

Panel admin adalah halaman khusus guru/admin (dilindungi lewat middleware `auth` dan pengecekan role).

Buat `backend/routes/admin.js` dengan endpoint:

| Alamat API | Fungsi |
|------------|--------|
| `GET /api/admin/students` | Lihat daftar siswa |
| `POST /api/admin/students/bulk-create` | Import banyak siswa sekaligus |
| `POST /api/admin/messages` | Kirim pesan ke siswa |
| `POST /api/admin/activation-codes` | Buat kode aktivasi |
| `POST /api/admin/activation-codes/bulk` | Buat kode aktivasi massal |

Admin juga bisa menginput/memperbaiki nilai lewat route `grades` dan `tools`.

**Keamanan:** setiap endpoint admin memeriksa apakah user berperan `admin` atau `guru`. Kalau bukan, permintaan ditolak.

---

## 11. Tahap 9 - Menambahkan Tugas Otomatis (Cron Job)

Agar sistem bekerja sendiri tanpa harus ditekan tombol, dipakai **node-cron** di dalam `server.js`.

Jadwalnya:
| Jam (server) | Hari | Tugas |
|--------------|------|-------|
| 07:00 | Senin–Jumat | Sinkronisasi data Google Classroom |
| 17:00 | Senin–Jumat | Kirim notifikasi tugas belum dikerjakan |
| 02:00 | Setiap hari | Backup database |

Contoh kode:
```javascript
cron.schedule('0 7 * * 1-5', async () => {
  console.log('Mulai sinkronisasi Google Classroom...');
  await syncAllCourses();
});

cron.schedule('0 2 * * *', async () => {
  await createBackup('auto'); // backup otomatis tiap jam 2 pagi
});
```

File `services/notification.js` berisi logika mencari siswa yang punya tugas dengan tenggat belum terpenuhi, lalu mengirim pesan ke Telegramnya.

File `services/backup.js` mengekspor seluruh collection MongoDB menjadi file JSON di folder `backend/backups/`.

---

## 12. Tahap 10 - Membuat Frontend (Tampilan Web)

Sekarang masuk ke bagian tampilan. Frontend dibuat dengan **React + Vite + Tailwind CSS**.

### 12.1 Membuat Project React

```bash
cd frontend
npm create vite@latest . -- --template react
npm install react-router-dom axios
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### 12.2 Halaman yang Dibuat (folder `src/pages/`)

1. **Login.jsx** — form login (NIS + password), panggil `POST /api/auth/login`, simpan token.
2. **Dashboard.jsx** — tampilkan nilai, ranking, dan pesan. Dilindungi: hanya bisa dilihat siswa/parent.
3. **AdminPanel.jsx** — kelola siswa, nilai, pesan, kode aktivasi. Hanya bisa dilihat admin/guru.

### 12.3 Pengaturan Rute

File `frontend/src/App.jsx` mengatur halaman dan perlindungannya:
- `/login` → halaman login (semua orang bisa).
- `/dashboard` → hanya yang sudah login (komponen `ProtectedRoute` / `StudentRoute`).
- `/admin` → hanya admin/guru (komponen `AdminRoute`).
- URL lain → otomatis diarahkan ke dashboard.

### 12.4 Context Auth (Menyimpan Status Login)

File `frontend/src/contexts/AuthContext.jsx` menyimpan:
- Token (dari localStorage).
- Data user yang sedang login.
- Fungsi login & logout.

Setiap kali ada permintaan ke server, token disisipkan ke header lewat file `frontend/src/utils/api.js` (axios).

---

## 13. Tahap 11 - Menghubungkan Frontend ke Backend

Agar frontend dan backend "ngobrol", dipakai **axios** (library HTTP client).

Contoh di `utils/api.js`:
```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',          // semua permintaan dimulai dari /api
});

// Otomatis siapkan token di header setiap request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

Saat dijalankan bersama (misal ala Docker), frontend dan backend digabung jadi satu: hasil build frontend (folder `dist`) disajikan langsung oleh backend. Jadi user cukup buka satu alamat website saja.

Menjalankan di mode pengembangan (dua terminal berbeda):
```bash
# Terminal 1 - backend
cd backend && npm run dev          # port 5000

# Terminal 2 - frontend
cd frontend && npm run dev         # port 5173
```

---

## 14. Tahap 12 - Menjalankan & Menguji Secara Lokal

### 14.1 Instalasi dan Konfigurasi
```bash
# 1. Siapkan konfigurasi
cd backend
cp .env.example .env        # lalu isi dengan nilai asli

# 2. Install semua library
npm install
cd ../frontend
npm install
```

### 14.2 Isi Data Awal
```bash
cd ../backend
npm run seed                # membuat akun awal (admin + siswa)
```

### 14.3 Jalankan Server
```bash
# Terminal 1 - backend
npm run dev

# Terminal 2 - bot (yang polling pesan Telegram)
node bot-poll.js

# Terminal 3 - frontend
cd ../frontend
npm run dev
```

### 14.4 Cek Login
Buka browser di `http://localhost:5173`, lalu coba login:

| Peran | NIS | Password |
|-------|-----|----------|
| Admin | admin | admin123 |
| Siswa | 240001 | (password awal dari seed) |

> Tips: saat pertama kali login sebagai siswa, sistem akan meminta ganti password (karena `mustChangePassword = true`).

---

## 15. Tahap 13 - Deploy ke Server (VPS) dengan Docker

Agar bisa diakses publik 24 jam, project ini dijalankan di server (VPS) memakai **Docker**. Docker membuat semua bagian jalan dalam "kotak" (container) yang konsisten — tidak peduli server apa yang dipakai.

### 15.1 Diagram Container

| Container | Fungsi |
|-----------|--------|
| `smk-mongodb` | Database MongoDB, disimpan di volume `mongodb_data` |
| `smk-app` | Backend + Frontend hasil build, port 5000 |
| `smk-nginx` | Web server (port 80/443), meneruskan koneksi ke app |
| `smk-certbot` | Mengurus sertifikat SSL gratis (HTTPS) |

### 15.2 File Dockerfile

`Dockerfile` didesain 2 tahap (bikin image kecil & efisien):
1. **Tahap build** — install dependensi frontend dan menjalankan `npm run build`, hasilnya di folder `dist`.
2. **Tahap runtime** — install dependensi backend saja, lalu salin `dist` frontend ke folder `public` backend.

```dockerfile
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --only=production
COPY backend/ ./
COPY --from=frontend-builder /app/frontend/dist ./public
CMD ["node", "server.js"]
```

### 15.3 File docker-compose.yml

File ini "memesan" semua container sekaligus dan menghubungkannya. Bagian penting:
```yaml
services:
  mongodb:
    image: mongo:7
    ports: ["127.0.0.1:27017:27017"]
    volumes: [mongodb_data:/data/db]    # data tetap aman walau restart

  app:
    build: .
    depends_on:
      mongodb: { condition: service_healthy }  # tunggu DB siap dulu
    env_file: ./backend/.env
    environment:
      MONGODB_URI: mongodb://mongodb:27017/smk_akademik
    ports: ["127.0.0.1:5000:5000"]

  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes: [./nginx/conf.d:/etc/nginx/conf.d, ./nginx/ssl:/etc/nginx/ssl]
```

### 15.4 Langkah Deploy ke VPS

```bash
# 1. Masuk ke server
ssh root@IP_VPS_ANDA

# 2. Install Docker
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin

# 3. Ambil kode project
cd /opt
git clone https://github.com/YOUR_USERNAME/classroom-update.git
cd classroom-update

# 4. Siapkan konfigurasi
cp backend/.env.production backend/.env
nano backend/.env                    # isi nilai asli (token, secret, dll)

# 5. Akses domain lewat Nginx
sed -i 's/DOMAIN_NAME/domain-anda.com/g' nginx/conf.d/*.conf

# 6. Jalan! (build + mulai semua container)
docker-compose up -d --build

# 7. Atur SSL biar pakai HTTPS
#    (jalankan certbot, copy sertifikat ke nginx/ssl, restart nginx)
```

### 15.5 Setup SSL (HTTPS)

1. Install certbot di VPS (bukan di container).
2. Generate sertifikat untuk domain.
3. Salin ke `nginx/ssl/`.
4. Restart nginx.
5. Lalu set webhook Telegram ke domain:
   ```bash
   curl -X POST "https://api.telegram.org/botTOKEN/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url":"https://domain-anda.com/api/webhook/telegram"}'
   ```

---

## 16. Tahap 14 - Deploy Otomatis dengan GitHub Actions

Supaya tidak perlu SSH ke server setiap update, dibuat **CI/CD** dengan GitHub Actions.

File `.github/workflows/deploy.yml` berisi instruksi yang otomatis jalan setiap ada push ke branch `main`:
1. Checkout kode terbaru.
2. Install Node.js versi 20.
3. Install dependensi backend & frontend.
4. Build frontend.
5. Matikan server lama.
6. Jalankan server baru (server.js + bot-poll.js).
7. Cek kesehatan API (`/api/health`).

Dengan ini, begitu kode di-push ke GitHub, sistem otomatis diperbarui.

---

## 17. Tahap 15 - Backup, Monitoring & Pemeliharaan

### 17.1 Backup Database

- **Otomatis:** cron setiap jam 02.00 membuat backup JSON ke `backend/backups/`.
- **Manual via Docker:**
  ```bash
  # Backup
  docker exec smk-mongodb mongodump --archive --gzip > backup_$(date +%Y%m%d).gz

  # Restore
  docker exec -i smk-mongodb mongorestore --archive --gzip < backup_20240101.gz
  ```

### 17.2 Monitoring

- `backend/services/monitoring.js` mencatat jumlah request dan error ke log.
- `backend/utils/logger.js` (winston) menulis log ke file di `backend/logs/`.
- Perintah berguna di server:
  ```bash
  docker stats                          # lihat pemakaian server
  docker-compose logs -f                # lihat log realtime
  df -h                                 # cek ruang disk
  ```

### 17.3 Cek Kesehatan Server

Ada endpoint `GET /api/health` yang mengembalikan status server. Endpoint ini berguna untuk memastikan sistem hidup (bisa dipakai oleh uptime monitor).

---

## 18. Ringkasan Urutan Pekerjaan

Kalau diringkas, berikut urutan nyata pembuatan project ini:

1. **Persiapan** — install Node.js & MongoDB, buat Bot Telegram, buat Google Cloud Project.
2. **Struktur project** — buat folder `backend` dan `frontend`.
3. **Backend dasar** — init npm, install library, buat `.env`, konek MongoDB (`config/db.js`).
4. **Server utama** (`server.js`) — Express, CORS, rate limit, daftarkan route.
5. **Model data** (`models/`) — User, Student, Grade, ActivationCode, AdminMessage, ChatId, CourseworkCache.
6. **Autentikasi** (`routes/auth.js`) — login, ganti password, lupa password (OTP), JWT, middleware auth.
7. **Seed data** (`seeds/`) — isi data siswa & akun admin.
8. **Dashboard** (`routes/dashboard.js`) — nilai, ranking, pesan.
9. **Integrasi Google Classroom** (`services/classroom.js`) — OAuth + sinkronisasi kursus/tugas/nilai.
10. **Bot Telegram** (`services/telegram.js`, `bot-poll.js`, `routes/webhook.js`) — notifikasi + OTP.
11. **Panel admin** (`routes/admin.js`) — kelola siswa, pesan, kode aktivasi.
12. **Tugas otomatis** (cron) — sinkronisasi pagi, notifikasi sore, backup tengah malam.
13. **Frontend** (React + Vite + Tailwind) — halaman Login, Dashboard, Admin, AuthContext, axios.
14. **Uji lokal** — jalankan seed, dev server, coba login.
15. **Deploy ke VPS** — Dockerfile, docker-compose, Nginx, SSL, webhook.
16. **Deploy otomatis** — GitHub Actions (CI/CD).
17. **Pemeliharaan** — backup otomatis harian, monitoring log, health check.

---

## Penutup

Project ini dibangun bertahap dari bawah ke atas:
server → database → login → fitur → tampilan → deploy.

Setiap tahap punya satu esensi sederhana:
> **Backend menyediakan data lewat API, dan Frontend menampilkannya untuk user.**

Semoga panduan ini membantu! Kalau ingin mempelajari satu bagian lebih dalam, tinggal buka file terkait di folder project — setiap folder sudah diatur sesuai fungsinya masing-masing.