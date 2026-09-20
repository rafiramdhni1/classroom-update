require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

async function seed() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smk_akademik';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB:', mongoUri);

    const db = mongoose.connection.db;
    await db.collection('users').deleteMany({});
    await db.collection('students').deleteMany({});
    console.log('Cleared existing users & students data');

    console.log('Hashing default password (123456)...');
    const defaultHash = await bcrypt.hash('123456', 10);
    const adminHash = await bcrypt.hash('admin123', 12);

    const dataPath = path.join(__dirname, 'students-data.json');
    const studentsRaw = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    const studentsBatch = [];
    const usersBatch = [];

    // Admin account
    const adminStudentId = new mongoose.Types.ObjectId();
    studentsBatch.push({
      _id: adminStudentId,
      nis: 'ADMIN001',
      nisn: 'ADMIN001',
      nama: 'Administrator',
      kelas: 'X-TKJ1',
      angkatan: 2026,
      orangTuaNama: '-',
      orangTuaTelepon: '-',
      isActive: true,
    });
    usersBatch.push({
      nis: 'ADMIN001',
      nisn: 'admin',
      password: adminHash,
      role: 'admin',
      studentId: adminStudentId,
      mustChangePassword: false,
    });

    // Real students from photos
    for (const s of studentsRaw) {
      const studentId = new mongoose.Types.ObjectId();
      const nis = String(s.nis).trim();
      const nisn = String(s.nisn).trim();
      const nama = s.nama.trim();
      const kelas = s.kelas.trim();
      const angkatan = Number(s.angkatan);

      studentsBatch.push({
        _id: studentId,
        nis,
        nisn,
        nama,
        kelas,
        angkatan,
        orangTuaNama: `Orang Tua ${nama}`,
        orangTuaTelepon: '-',
        isActive: true,
      });

      // Student User
      usersBatch.push({
        nis,
        nisn,
        password: defaultHash,
        mustChangePassword: true,
        role: 'student',
        studentId,
      });

      // Parent User
      usersBatch.push({
        nis: `${nis}-OT`,
        nisn: `${nisn}-OT`,
        password: defaultHash,
        mustChangePassword: true,
        role: 'parent',
        studentId,
      });
    }

    const S = 50;
    for (let i = 0; i < studentsBatch.length; i += S) {
      await db.collection('students').insertMany(studentsBatch.slice(i, i + S));
      process.stdout.write(`\rStudents: ${Math.min(i + S, studentsBatch.length)}/${studentsBatch.length}`);
    }
    console.log('');

    for (let i = 0; i < usersBatch.length; i += S) {
      await db.collection('users').insertMany(usersBatch.slice(i, i + S));
      process.stdout.write(`\rUsers: ${Math.min(i + S, usersBatch.length)}/${usersBatch.length}`);
    }
    console.log('');

    console.log(`\n✅ Selesai! ${studentsBatch.length - 1} siswa (+1 admin), ${usersBatch.length} akun user.`);
    console.log('--------------------------------------------------');
    console.log('📌 Kredensial Login Siswa:');
    console.log('   Username / NIS : 14707 (contoh siswa X-TKJ1)');
    console.log('   Password       : 123456');
    console.log('📌 Kredensial Login Orang Tua:');
    console.log('   Username / NIS : 14707-OT');
    console.log('   Password       : 123456');
    console.log('📌 Kredensial Login Admin:');
    console.log('   Username       : admin');
    console.log('   Password       : admin123');
    console.log('--------------------------------------------------');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seed();
