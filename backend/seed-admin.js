require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function seedAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    const adminStudentId = new mongoose.Types.ObjectId();

    const studentResult = await db.collection('students').insertOne({
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
    console.log('Student inserted:', studentResult.insertedId);

    const hash = await bcrypt.hash('admin123', 12);
    const userResult = await db.collection('users').insertOne({
      nis: 'ADMIN001',
      nisn: 'admin',
      password: hash,
      role: 'admin',
      studentId: adminStudentId,
      mustChangePassword: false,
    });
    console.log('User inserted:', userResult.insertedId);

    const verify = await db.collection('users').findOne({ nisn: 'admin' });
    console.log('Verify studentId:', verify.studentId);

    console.log('\n✅ Admin login credentials:');
    console.log('   NISN    : admin');
    console.log('   Password: admin123');

    process.exit(0);
  } catch (error) {
    console.error('Seed admin error:', error);
    process.exit(1);
  }
}

seedAdmin();
