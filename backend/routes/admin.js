const express = require('express');
const crypto = require('crypto');
const { auth, adminOnly, staffOnly } = require('../middleware/auth');
const Student = require('../models/Student');
const AdminMessage = require('../models/AdminMessage');
const ActivationCode = require('../models/ActivationCode');
const User = require('../models/User');
const ChatId = require('../models/ChatId');
const {
  validate,
  createMessageSchema,
  createActivationCodeSchema,
  bulkCreateSchema,
  updateAdminProfileSchema,
} = require('../middleware/validation');

const { google } = require('googleapis');

const router = express.Router();

router.use(auth);

// GET /api/admin/students
router.get('/students', staffOnly, async (req, res) => {
  try {
    const { kelas, angkatan, search, classroomStatus, page = 1, limit = 50 } = req.query;
    const filter = { isActive: true };

    if (kelas) filter.kelas = kelas;
    if (angkatan) filter.angkatan = parseInt(angkatan);
    if (search) {
      filter.$or = [
        { nama: { $regex: search, $options: 'i' } },
        { nis: { $regex: search, $options: 'i' } },
        { nisn: { $regex: search, $options: 'i' } },
      ];
    }

    if (classroomStatus === 'unlinked') {
      const unlinkedCond = {
        $or: [
          { classroomId: { $exists: false } },
          { classroomId: null },
          { classroomId: '' },
        ],
      };
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, unlinkedCond];
        delete filter.$or;
      } else {
        Object.assign(filter, unlinkedCond);
      }
    } else if (classroomStatus === 'linked') {
      const linkedCond = { classroomId: { $exists: true, $nin: [null, ''] } };
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, linkedCond];
        delete filter.$or;
      } else {
        Object.assign(filter, linkedCond);
      }
    }

    const baseFilter = { isActive: true };
    if (kelas) baseFilter.kelas = kelas;
    if (angkatan) baseFilter.angkatan = parseInt(angkatan);

    const [total, students, unlinkedCount, totalCount] = await Promise.all([
      Student.countDocuments(filter),
      Student.find(filter)
        .sort({ kelas: 1, nama: 1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      Student.countDocuments({
        ...baseFilter,
        $or: [
          { classroomId: { $exists: false } },
          { classroomId: null },
          { classroomId: '' },
        ],
      }),
      Student.countDocuments(baseFilter),
    ]);

    res.json({
      students,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      classroomStats: {
        total: totalCount,
        unlinked: unlinkedCount,
        linked: Math.max(0, totalCount - unlinkedCount),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

// GET /api/admin/unlinked-roster - Daftar akun Google Classroom yang belum terhubung ke database
router.get('/unlinked-roster', staffOnly, async (req, res) => {
  try {
    let user = await User.findById(req.userId);
    if (!user || !user.googleAccessToken) {
      user = await User.findOne({ googleAccessToken: { $exists: true, $ne: null } });
    }
    if (!user || !user.googleAccessToken) {
      return res.json({ unlinkedRoster: [], isConnected: false });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CALLBACK_URL
    );
    oauth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken,
    });
    const classroom = google.classroom({ version: 'v1', auth: oauth2Client });

    const coursesRes = await classroom.courses.list({ pageSize: 50 });
    const courses = coursesRes.data.courses || [];

    const linkedStudents = await Student.find({
      isActive: true,
      classroomId: { $exists: true, $nin: [null, ''] },
    }).select('classroomId').lean();
    const usedClassroomIds = new Set(linkedStudents.map(s => String(s.classroomId).trim()));

    const rosterMap = new Map();

    for (const c of courses) {
      try {
        const rosterRes = await classroom.courses.students.list({
          courseId: c.id,
          pageSize: 100,
          fields: 'students(userId,profile(name/fullName,emailAddress))',
        });
        const cStudents = rosterRes.data.students || [];
        for (const s of cStudents) {
          const uid = String(s.userId || '').trim();
          if (!uid || usedClassroomIds.has(uid)) continue;

          if (!rosterMap.has(uid)) {
            rosterMap.set(uid, {
              userId: uid,
              nama: s.profile?.name?.fullName || '',
              email: s.profile?.emailAddress || '',
              courses: [c.name],
            });
          } else {
            const entry = rosterMap.get(uid);
            if (!entry.courses.includes(c.name)) entry.courses.push(c.name);
          }
        }
      } catch (err) {
        // Abaikan kursus yang gagal roster
      }
    }

    const unlinkedRoster = Array.from(rosterMap.values()).sort((a, b) => a.nama.localeCompare(b.nama));
    res.json({ unlinkedRoster, isConnected: true });
  } catch (error) {
    console.error('Unlinked roster error:', error.message);
    res.json({ unlinkedRoster: [], isConnected: false, error: error.message });
  }
});

// PUT /api/admin/students/:id
router.put('/students/:id', staffOnly, async (req, res) => {
  try {
    const { nama, kelas, nisn, nis, orangTuaNama, orangTuaTelepon, classroomId } = req.body;
    const updateData = { nama, kelas, nisn, nis, orangTuaNama, orangTuaTelepon };
    if (classroomId !== undefined) {
      let resolvedId = String(classroomId || '').trim();
      if (resolvedId && resolvedId.includes('@')) {
        try {
          const userObj = await User.findOne({ googleAccessToken: { $exists: true, $ne: null } });
          if (userObj) {
            const oauth2Client = new google.auth.OAuth2(
              process.env.GOOGLE_CLIENT_ID,
              process.env.GOOGLE_CLIENT_SECRET,
              process.env.GOOGLE_CALLBACK_URL
            );
            oauth2Client.setCredentials({
              access_token: userObj.googleAccessToken,
              refresh_token: userObj.googleRefreshToken,
            });
            const classroom = google.classroom({ version: 'v1', auth: oauth2Client });
            const coursesRes = await classroom.courses.list({ pageSize: 50 });
            for (const c of (coursesRes.data.courses || [])) {
              try {
                const sRes = await classroom.courses.students.get({ courseId: c.id, userId: resolvedId });
                if (sRes.data?.userId) {
                  resolvedId = sRes.data.userId;
                  break;
                }
              } catch (_) {}
            }
          }
        } catch (err) {
          console.warn('Failed to resolve email to classroomId:', err.message);
        }
      }
      updateData.classroomId = resolvedId;
    }
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    if (!student) return res.status(404).json({ error: 'Siswa tidak ditemukan.' });

    if (nisn) {
      await User.findOneAndUpdate(
        { studentId: student._id, role: 'student' },
        { nisn, nis: nis || nisn }
      );
      await User.findOneAndUpdate(
        { studentId: student._id, role: 'parent' },
        { nisn: `${nisn}-OT`, nis: `${nis || nisn}-OT` }
      );
    }

    res.json({ message: 'Data siswa diperbarui.', student });
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

// DELETE /api/admin/students/:id
router.delete('/students/:id', staffOnly, async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!student) return res.status(404).json({ error: 'Siswa tidak ditemukan.' });
    res.json({ message: 'Siswa dinonaktifkan.' });
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

// GET /api/admin/students-selector (quick list for message picker)
router.get('/students-selector', staffOnly, async (req, res) => {
  try {
    const { kelas } = req.query;
    const filter = { isActive: true };
    if (kelas) filter.kelas = kelas;
    const students = await Student.find(filter)
      .select('_id nama nis kelas')
      .sort({ kelas: 1, nama: 1 })
      .lean();
    res.json({ students });
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

// POST /api/admin/messages
router.post('/messages', staffOnly, validate(createMessageSchema), async (req, res) => {
  try {
    const { title, content, targetType = 'all', targetStudents, targetKelas, targetAngkatan, isGlobal, priority, expiresAt } = req.body;

    let finalIsGlobal = false;
    let finalTargetKelas = [];
    let finalTargetStudents = [];

    if (targetType === 'all' || isGlobal === true) {
      finalIsGlobal = true;
    } else if (targetType === 'kelas') {
      finalTargetKelas = Array.isArray(targetKelas) ? targetKelas : (targetKelas ? [targetKelas] : []);
    } else if (targetType === 'student') {
      finalTargetStudents = Array.isArray(targetStudents) ? targetStudents : (targetStudents ? [targetStudents] : []);
    } else {
      // Fallback manual
      finalIsGlobal = !!isGlobal;
      finalTargetKelas = targetKelas || [];
      finalTargetStudents = targetStudents || [];
    }

    const senderDisplayName = req.user.namaLengkap || req.user.nama || (req.user.role === 'admin' ? 'Administrator' : `Guru (${req.user.nisn})`);

    const message = new AdminMessage({
      title,
      content,
      targetType,
      targetStudents: finalTargetStudents,
      targetKelas: finalTargetKelas,
      targetAngkatan: targetAngkatan || [],
      isGlobal: finalIsGlobal,
      priority: priority || 'normal',
      sender: req.user._id,
      senderName: senderDisplayName,
      senderRole: req.user.role || 'staff',
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    await message.save();
    const populated = await AdminMessage.findById(message._id)
      .populate('targetStudents', 'nama nis kelas')
      .lean();

    res.status(201).json({ message: 'Pesan berhasil dikirim.', data: populated });
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server: ' + error.message });
  }
});

// GET /api/admin/messages
router.get('/messages', staffOnly, async (req, res) => {
  try {
    const messages = await AdminMessage.find()
      .populate('targetStudents', 'nama nis kelas')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

// DELETE /api/admin/messages/:id
router.delete('/messages/:id', staffOnly, async (req, res) => {
  try {
    const msg = await AdminMessage.findById(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Pesan tidak ditemukan.' });

    // Admin can delete any message; Guru can only delete their own
    if (req.user.role !== 'admin' && String(msg.sender) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Akses ditolak. Anda hanya dapat menghapus pesan yang Anda buat sendiri.' });
    }

    await AdminMessage.findByIdAndDelete(req.params.id);
    res.json({ message: 'Pesan dihapus.' });
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

// POST /api/admin/activation-codes
router.post('/activation-codes', adminOnly, validate(createActivationCodeSchema), async (req, res) => {
  try {
    const { studentId, chatType } = req.body;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ error: 'Siswa tidak ditemukan.' });
    }

    const code = `${student.nisn}-${chatType === 'parent' ? 'OT' : 'ST'}-${cryptoRandom(6)}`;
    const activationCode = new ActivationCode({
      code,
      studentId,
      chatType: chatType || 'student',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    await activationCode.save();
    res.status(201).json({
      message: 'Kode aktivasi berhasil dibuat.',
      code,
      studentNama: student.nama,
      kelas: student.kelas,
      expiresAt: activationCode.expiresAt,
    });
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

// POST /api/admin/activation-codes/bulk
router.post('/activation-codes/bulk', adminOnly, async (req, res) => {
  try {
    const { kelas, chatType } = req.body;

    const filter = { isActive: true };
    if (kelas) filter.kelas = kelas;

    const students = await Student.find(filter);
    const codes = [];

    for (const student of students) {
      const code = `${student.nisn}-${chatType === 'parent' ? 'OT' : 'ST'}-${cryptoRandom(6)}`;
      const activationCode = new ActivationCode({
        code,
        studentId: student._id,
        chatType: chatType || 'student',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      await activationCode.save();
      codes.push({ code, nama: student.nama, nisn: student.nisn, kelas: student.kelas });
    }

    res.status(201).json({
      message: `${codes.length} kode aktivasi berhasil dibuat.`,
      codes,
    });
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

// GET /api/admin/activation-codes
router.get('/activation-codes', adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const total = await ActivationCode.countDocuments();
    const codes = await ActivationCode.find()
      .populate('studentId', 'nama nis kelas')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({ codes, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

// GET /api/admin/activation-codes/export
router.get('/activation-codes/export', adminOnly, async (req, res) => {
  try {
    const { kelas, status = 'pending' } = req.query;

    let filter = {};
    if (status === 'pending') filter.isUsed = false;
    else if (status === 'used') filter.isUsed = true;

    const codes = await ActivationCode.find(filter)
      .populate('studentId', 'nama nisn kelas')
      .sort({ createdAt: -1 });

    let filteredCodes = codes;
    if (kelas) {
      filteredCodes = codes.filter(c => c.studentId?.kelas === kelas);
    }

    const groupedByStudent = {};
    for (const c of filteredCodes) {
      const studentId = c.studentId?._id?.toString() || 'unknown';
      if (!groupedByStudent[studentId]) {
        groupedByStudent[studentId] = {
          nama: c.studentId?.nama || '-',
          nisn: c.studentId?.nisn || '-',
          kelas: c.studentId?.kelas || '-',
          studentCode: null,
          parentCode: null,
        };
      }
      if (c.chatType === 'student' && !groupedByStudent[studentId].studentCode) {
        groupedByStudent[studentId].studentCode = c.code;
      } else if (c.chatType === 'parent' && !groupedByStudent[studentId].parentCode) {
        groupedByStudent[studentId].parentCode = c.code;
      }
    }

    const exportData = Object.values(groupedByStudent);

    res.json({ codes: exportData, total: exportData.length });
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

// POST /api/admin/students/bulk-create
router.post('/students/bulk-create', adminOnly, validate(bulkCreateSchema), async (req, res) => {
  try {
    const { students, defaultPassword } = req.body;

    const results = [];
    const angkatanMap = { X: 2026, XI: 2025, XII: 2024 };

    for (const s of students) {
      const existing = await Student.findOne({ nisn: s.nisn });
      if (existing) {
        results.push({ nisn: s.nisn, status: 'sudah_ada' });
        continue;
      }

      const angkatanMatch = s.kelas?.match(/^(\w+)-TKJ/);

      const student = new Student({
        nis: s.nis || s.nisn,
        nisn: s.nisn,
        nama: s.nama,
        kelas: s.kelas,
        angkatan: angkatanMap[angkatanMatch?.[1]] || s.angkatan || 2026,
        orangTuaNama: s.orangTuaNama,
        orangTuaTelepon: s.orangTuaTelepon,
      });
      await student.save();

      const plainPassword = defaultPassword || '123456';

      const user = new User({
        nis: s.nis || s.nisn,
        nisn: s.nisn,
        password: plainPassword,
        role: 'student',
        studentId: student._id,
      });
      await user.save();

      if (s.orangTuaNama) {
        const parentUser = new User({
          nis: `${s.nisn}-OT`,
          nisn: `${s.nisn}-OT`,
          password: plainPassword,
          role: 'parent',
          studentId: student._id,
        });
        await parentUser.save();
      }

      const activationCode = `${s.nisn}-ST-${cryptoRandom(6)}`;
      const actCode = new ActivationCode({
        code: activationCode,
        studentId: student._id,
        chatType: 'student',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      await actCode.save();

      let parentActivationCode = null;
      if (s.orangTuaNama) {
        parentActivationCode = `${s.nisn}-OT-${cryptoRandom(6)}`;
        const parentActCode = new ActivationCode({
          code: parentActivationCode,
          studentId: student._id,
          chatType: 'parent',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
        await parentActCode.save();
      }

      results.push({
        nisn: s.nisn,
        nama: s.nama,
        status: 'berhasil',
        activationCode,
        parentActivationCode,
      });
    }

    const berhasil = results.filter(r => r.status === 'berhasil').length;
    const sudahAda = results.filter(r => r.status === 'sudah_ada').length;

    const codes = results
      .filter(r => r.activationCode)
      .map(r => ({
        nama: r.nama,
        nisn: r.nisn,
        studentCode: r.activationCode,
        parentCode: r.parentActivationCode,
      }));

    res.json({
      message: `Selesai: ${berhasil} dibuat, ${sudahAda} sudah ada.`,
      results,
      codes,
    });
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

// GET /api/admin/dashboard-stats
router.get('/dashboard-stats', staffOnly, async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments({ isActive: true });
    const totalUsers = await User.countDocuments();
    const activatedChats = await ChatId.countDocuments({ isActive: true });
    const pendingCodes = await ActivationCode.countDocuments({ isUsed: false });

    const kelasCount = await Student.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$kelas', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      totalStudents,
      totalUsers,
      activatedChats,
      pendingCodes,
      kelasCount,
    });
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

function cryptoRandom(length) {
  const crypto = require('crypto');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars.charAt(bytes[i] % chars.length);
  }
  return result;
}

// GET /api/admin/teachers - Daftar akun guru
router.get('/teachers', adminOnly, async (req, res) => {
  try {
    const users = await User.find({ role: 'guru' }).sort({ createdAt: -1 });
    const students = await Student.find();
    const studentMap = {};
    for (const s of students) studentMap[s._id.toString()] = s;

    const teachers = users.map(u => ({
      id: u._id,
      nis: u.nis,
      nisn: u.nisn,
      nama: studentMap[u.studentId?.toString()]?.nama || u.nisn,
      googleEmail: u.googleEmail || null,
      hasGoogleAuth: !!u.googleAccessToken,
      lastLogin: u.lastLogin,
      createdAt: u.createdAt,
    }));

    res.json({ teachers });
  } catch (error) {
    console.error('List teachers error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

// POST /api/admin/teachers - Buat akun guru
router.post('/teachers', adminOnly, async (req, res) => {
  try {
    const { nama, nisn, password } = req.body;
    if (!nama || !nisn) {
      return res.status(400).json({ error: 'Nama dan NISN wajib diisi.' });
    }

    const cleanNisn = String(nisn).trim();
    const existing = await User.findOne({ nisn: cleanNisn });
    if (existing) {
      return res.status(400).json({ error: 'NISN sudah terdaftar.' });
    }

    const teacherStudent = new Student({
      nis: cleanNisn,
      nisn: cleanNisn,
      nama,
      kelas: 'GURU',
      angkatan: new Date().getFullYear(),
      isActive: false,
    });
    await teacherStudent.save();

    const user = new User({
      nis: cleanNisn,
      nisn: cleanNisn,
      password: password || '123456',
      role: 'guru',
      studentId: teacherStudent._id,
      mustChangePassword: false,
    });
    await user.save();

    res.status(201).json({
      message: 'Akun guru berhasil dibuat.',
      teacher: {
        id: user._id,
        nis: user.nis,
        nisn: user.nisn,
        nama,
        passwordDefault: password || '123456',
      },
    });
  } catch (error) {
    console.error('Create teacher error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

// DELETE /api/admin/teachers/:userId - Hapus akun guru
router.delete('/teachers/:userId', adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'Akun guru tidak ditemukan.' });
    }
    if (user.role !== 'guru') {
      return res.status(400).json({ error: 'Hanya akun guru yang bisa dihapus.' });
    }

    const studentId = user.studentId;
    await User.findByIdAndDelete(user._id);
    if (studentId) await Student.findByIdAndDelete(studentId);

    // Hapus data sync milik guru tersebut
    await require('../models/CourseworkCache').deleteMany({ ownerId: user._id });

    res.json({ message: 'Akun guru berhasil dihapus.' });
  } catch (error) {
    console.error('Delete teacher error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

// GET /api/admin/profile - Ambil data profil admin/guru yang sedang login
router.get('/profile', staffOnly, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User tidak ditemukan.' });
    }

    let student = null;
    if (user.studentId) {
      student = await Student.findById(user.studentId);
    }

    res.json({
      user: {
        id: user._id,
        nis: user.nis,
        nisn: user.nisn,
        name: student?.nama || user.nisn,
        role: user.role,
        googleEmail: user.googleEmail || null,
        hasGoogleAuth: !!user.googleAccessToken,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Get admin profile error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

// PUT /api/admin/profile - Edit login username dan password untuk admin/staff itu sendiri
router.put('/profile', staffOnly, validate(updateAdminProfileSchema), async (req, res) => {
  try {
    const { username, name, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User tidak ditemukan.' });
    }

    // Verifikasi password saat ini
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ error: 'Password saat ini salah.' });
    }

    let usernameChanged = false;
    const cleanUsername = username ? String(username).trim() : '';

    if (cleanUsername) {
      if (cleanUsername.length < 3) {
        return res.status(400).json({ error: 'Username minimal 3 karakter.' });
      }
      if (cleanUsername.length > 50) {
        return res.status(400).json({ error: 'Username maksimal 50 karakter.' });
      }
      if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
        return res.status(400).json({ error: 'Username hanya boleh berisi huruf, angka, titik, strip, atau underscore.' });
      }

      if (cleanUsername !== user.nisn || cleanUsername !== user.nis) {
        // Cek duplikat di User
        const dupUser = await User.findOne({
          _id: { $ne: user._id },
          $or: [{ nisn: cleanUsername }, { nis: cleanUsername }],
        });
        if (dupUser) {
          return res.status(400).json({ error: 'Username sudah digunakan oleh akun lain.' });
        }

        // Cek duplikat di Student jika ada studentId
        if (user.studentId) {
          const dupStudent = await Student.findOne({
            _id: { $ne: user.studentId },
            $or: [{ nisn: cleanUsername }, { nis: cleanUsername }],
          });
          if (dupStudent) {
            return res.status(400).json({ error: 'Username sudah terdaftar pada data siswa.' });
          }
        }

        user.nisn = cleanUsername;
        user.nis = cleanUsername;
        usernameChanged = true;
      }
    }

    // Validasi & update password baru jika diisi
    let passwordChanged = false;
    if (newPassword && String(newPassword).trim()) {
      const cleanPassword = String(newPassword).trim();
      if (cleanPassword.length < 6) {
        return res.status(400).json({ error: 'Password baru minimal 6 karakter.' });
      }
      user.password = cleanPassword;
      user.mustChangePassword = false;
      passwordChanged = true;
    }

    // Update nama siswa jika ada studentId
    let nameChanged = false;
    const cleanName = name ? String(name).trim() : '';
    let updatedDisplayName = user.nisn;

    if (user.studentId) {
      const student = await Student.findById(user.studentId);
      if (student) {
        if (usernameChanged) {
          student.nis = cleanUsername;
          student.nisn = cleanUsername;
        }
        if (cleanName && cleanName !== student.nama) {
          student.nama = cleanName;
          nameChanged = true;
        }
        await student.save();
        updatedDisplayName = student.nama;
      }
    } else if (cleanName) {
      updatedDisplayName = cleanName;
    }

    if (!usernameChanged && !passwordChanged && !nameChanged) {
      return res.status(400).json({ error: 'Tidak ada perubahan data yang disimpan.' });
    }

    await user.save();

    res.json({
      message: 'Kredensial akun berhasil diperbarui.',
      user: {
        id: user._id,
        nis: user.nis,
        nisn: user.nisn,
        name: updatedDisplayName,
        role: user.role,
      },
      updatedFields: {
        username: usernameChanged,
        password: passwordChanged,
        name: nameChanged,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server saat memperbarui akun: ' + error.message });
  }
});

module.exports = router;
