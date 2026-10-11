const express = require('express');
const { auth } = require('../middleware/auth');
const Student = require('../models/Student');
const CourseworkCache = require('../models/CourseworkCache');
const Grade = require('../models/Grade');
const AdminMessage = require('../models/AdminMessage');

const router = express.Router();

const SUBJECTS = ['ASJ', 'AIJ', 'TJBL', 'PKDK', 'TJKT'];

function getRank(averages, studentId) {
  const sorted = Object.entries(averages)
    .sort((a, b) => b[1] - a[1]);

  const rank = sorted.findIndex(([id]) => id === studentId.toString()) + 1;
  return { rank, total: sorted.length };
}

// GET /api/dashboard
router.get('/', auth, async (req, res) => {
  try {
    const student = await Student.findById(req.user.studentId).lean();
    if (!student) {
      if (req.user.role === 'admin') {
        return res.json({ user: { role: 'admin', nisn: req.user.nisn }, student: null, grades: [], messages: [], subjectGrades: [], overallAverage: 0, classRank: { rank: 0, total: 0 }, angkatanRank: { rank: 0, total: 0 } });
      }
      return res.status(404).json({ error: 'Data siswa tidak ditemukan.' });
    }

    const messages = await AdminMessage.find({
      $and: [
        {
          $or: [
            { targetStudents: student._id },
            { targetKelas: student.kelas },
            { targetAngkatan: student.angkatan },
            { isGlobal: true },
          ],
        },
        {
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } },
          ],
        },
      ],
    }).sort({ createdAt: -1 }).limit(20).lean();

    const classmates = await Student.find({ kelas: student.kelas, isActive: true }).select('_id').lean();
    const classmateIds = classmates.map(s => s._id);

    const relevantCoursework = await CourseworkCache.find({
      'studentSubmissions.studentId': { $in: classmateIds }
    }).lean();

    const manualGrades = await Grade.find({ studentId: student._id }).lean();

    const subjectGrades = {};
    let totalScore = 0;
    let totalSubjects = 0;
    
    // Guru hanya boleh melihat mapel yang diampu (User.subjects).
    // Kalau kosong, tidak ada pembatasan.
    const taughtSubjects = req.user?.subjects?.length ? req.user.subjects : null;
    const visibleSubjects = taughtSubjects ? SUBJECTS.filter(s => taughtSubjects.includes(s)) : SUBJECTS;
    
    for (const subject of visibleSubjects) {
      const subjectWorks = relevantCoursework.filter(w => w.courseAlias === subject);
      const subjectManual = manualGrades.filter(g => g.subject === subject);
      let subjectTotal = 0;
      let subjectCount = 0;
      const components = [];

      for (const work of subjectWorks) {
        const submission = (work.studentSubmissions || []).find(
          s => s.studentId?.toString() === student._id.toString()
        );

        if (submission && submission.grade !== undefined && submission.grade !== null) {
          subjectTotal += submission.grade;
          subjectCount++;
          components.push({
            title: work.title,
            score: submission.grade,
            maxScore: work.maxPoints || 100,
            isGraded: true,
            type: work.workType,
          });
        } else {
          components.push({
            title: work.title,
            score: null,
            maxScore: work.maxPoints || 100,
            isGraded: false,
            type: work.workType,
          });
        }
      }

      for (const mg of subjectManual) {
        const hasScore = mg.score !== null && mg.score !== undefined;
        if (hasScore) {
          subjectTotal += mg.score;
          subjectCount++;
        }
        components.push({
          title: mg.title,
          score: hasScore ? mg.score : null,
          maxScore: mg.maxScore || 100,
          isGraded: hasScore,
          type: mg.type,
        });
      }

      const avgScore = subjectCount > 0 ? Math.round(subjectTotal / subjectCount * 100) / 100 : null;

      if (avgScore !== null) {
        totalScore += avgScore;
        totalSubjects++;
      }

      subjectGrades[subject] = {
        average: avgScore,
        components,
        totalAssignments: subjectWorks.length,
        gradedCount: subjectCount,
      };
    }

    const overallAverage = totalSubjects > 0
      ? Math.round(totalScore / totalSubjects * 100) / 100
      : null;

    // --- RANKING OPTIMIZED ---
    const [studentsInClass, studentsInAngkatan] = await Promise.all([
      Student.find({ kelas: student.kelas, isActive: true }).select('_id').lean(),
      Student.find({ angkatan: student.angkatan, isActive: true }).select('_id').lean(),
    ]);

    const classIds = studentsInClass.map(s => s._id);
    const angkatanIds = studentsInAngkatan.map(s => s._id);

    const [classCoursework, angkatanCoursework, classManualGrades, angkatanManualGrades] = await Promise.all([
      CourseworkCache.find({
        'studentSubmissions.studentId': { $in: classIds },
      }).select('studentSubmissions.studentId studentSubmissions.grade').lean(),
      angkatanIds.length !== classIds.length
        ? CourseworkCache.find({
            'studentSubmissions.studentId': { $in: angkatanIds },
          }).select('studentSubmissions.studentId studentSubmissions.grade').lean()
        : null,
      Grade.find({ studentId: { $in: classIds } }).select('studentId score').lean(),
      angkatanIds.length !== classIds.length
        ? Grade.find({ studentId: { $in: angkatanIds } }).select('studentId score').lean()
        : null,
    ]);

    function calculateAveragesWithManual(ids, coursework, manualGrades) {
      const stats = new Map();
      for (const sid of ids) {
        stats.set(sid.toString(), { total: 0, count: 0 });
      }
      if (coursework) {
        for (const cw of coursework) {
          if (!cw.studentSubmissions) continue;
          for (const sub of cw.studentSubmissions) {
            if (sub.grade === undefined || sub.grade === null) continue;
            const sKey = sub.studentId?.toString();
            const st = stats.get(sKey);
            if (st) {
              st.total += sub.grade;
              st.count++;
            }
          }
        }
      }
      if (manualGrades) {
        for (const mg of manualGrades) {
          if (mg.score === null || mg.score === undefined) continue;
          const sKey = mg.studentId?.toString();
          const st = stats.get(sKey);
          if (st) {
            st.total += mg.score;
            st.count++;
          }
        }
      }
      const averages = {};
      for (const [sid, st] of stats.entries()) {
        averages[sid] = st.count > 0 ? st.total / st.count : 0;
      }
      return averages;
    }

    const classAverages = calculateAveragesWithManual(classIds, classCoursework, classManualGrades);
    const angkatanAverages = calculateAveragesWithManual(
      angkatanIds,
      angkatanCoursework || classCoursework,
      angkatanManualGrades || classManualGrades
    );

    // 4. Cari rank
    const classRank = getRank(classAverages, student._id);
    const angkatanRank = getRank(angkatanAverages, student._id);

    const adminPhone1 = process.env.ADMIN_PHONE || '6288233182147';
    const adminPhone2 = process.env.ADMIN_PHONE_2 || '6285641408175';
    const waLink = `https://wa.me/${adminPhone1}?text=${encodeURIComponent('Halo Admin, saya ingin bertanya tentang sistem akademik.')}`;
    const waLink2 = `https://wa.me/${adminPhone2}?text=${encodeURIComponent('Halo Admin, saya ingin bertanya tentang sistem akademik.')}`;

    res.json({
      student: {
        id: student._id,
        _id: student._id,
        nis: student.nis,
        nisn: student.nisn,
        nama: student.nama,
        kelas: student.kelas,
        angkatan: student.angkatan,
      },
      adminContact: waLink,
      adminContacts: [
        { label: 'Admin 1', phone: '0882-3318-2147', url: waLink },
        { label: 'Admin 2', phone: '0856-4140-8175', url: waLink2 },
      ],
      messages,
      subjectGrades,
      overallAverage,
      classRank,
      angkatanRank,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

// PUT /api/dashboard/messages/:messageId/read
router.put('/messages/:messageId/read', auth, async (req, res) => {
  try {
    const message = await AdminMessage.findById(req.params.messageId);
    if (!message) {
      return res.status(404).json({ error: 'Pesan tidak ditemukan.' });
    }

    const alreadyRead = message.isReadBy.some(
      r => r.studentId.toString() === req.user.studentId.toString()
    );

    if (!alreadyRead) {
      message.isReadBy.push({
        studentId: req.user.studentId,
        readAt: new Date(),
      });
      await message.save();
    }

    res.json({ message: 'Pesan ditandai sudah dibaca.' });
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

router.get('/missing-tasks', auth, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      return res.status(403).json({ error: 'Admin tidak dapat mengakses endpoint ini.' });
    }

    const student = await Student.findById(req.user.studentId).lean();
    if (!student) {
      return res.status(404).json({ error: 'Data siswa tidak ditemukan.' });
    }

    const allCoursework = await CourseworkCache.find({
      'studentSubmissions.studentId': student._id,
    }).sort({ lastSyncedAt: -1 }).lean();

    const seen = new Set();
    const deduped = [];
    for (const cw of allCoursework) {
      if (seen.has(cw.classroomWorkId)) continue;
      seen.add(cw.classroomWorkId);
      deduped.push(cw);
    }

    const now = new Date();
    const missing = [];

    for (const cw of deduped) {
      const sub = cw.studentSubmissions.find(
        s => s.studentId?.toString() === student._id.toString()
      );

      const isSubmitted = sub && ['TURNED_IN', 'RETURNED'].includes(sub.state);
      const isGraded = sub && sub.grade !== null && sub.grade !== undefined;

      if (!isSubmitted) {
        const dueDate = cw.dueDate ? new Date(cw.dueDate) : null;
        const isOverdue = dueDate && dueDate < now;
        const daysUntilDue = dueDate ? Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24)) : null;

        missing.push({
          id: cw.classroomWorkId,
          title: cw.title,
          subject: cw.courseAlias,
          courseName: cw.courseName,
          dueDate: cw.dueDate,
          hasDueDate: Boolean(cw.dueDate),
          overdue: isOverdue,
          daysUntilDue,
          workType: cw.workType,
          maxPoints: cw.maxPoints || 100,
          state: sub?.state || 'NEW',
          submittedAt: sub?.submittedAt || null,
        });
      }
    }

    const overdueCount = missing.filter(t => t.overdue).length;
    const dueSoonCount = missing.filter(t => !t.overdue && t.daysUntilDue !== null && t.daysUntilDue <= 3).length;
    const noDueDateCount = missing.filter(t => !t.hasDueDate).length;

    res.json({
      missing,
      summary: {
        total: missing.length,
        overdue: overdueCount,
        dueSoon: dueSoonCount,
        noDueDate: noDueDateCount,
      },
    });
  } catch (error) {
    console.error('Missing tasks error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

// GET /api/dashboard/export-csv

// POST /api/dashboard/push/subscribe - daftarkan push subscription
router.post('/push/subscribe', auth, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      return res.status(403).json({ error: 'Admin tidak dapat berlangganan push.' });
    }

    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: 'Format subscription tidak valid.' });
    }

    const userAgent = req.headers['user-agent'] || '';
    const { subscribeStudent } = require('../services/webpush');
    await subscribeStudent(req.user.studentId, subscription, userAgent);

    res.json({ message: 'Berlangganan push berhasil.' });
  } catch (error) {
    console.error('Push subscribe error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

// DELETE /api/dashboard/push/unsubscribe - hapus push subscription
router.delete('/push/unsubscribe', auth, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      return res.status(403).json({ error: 'Admin tidak dapat berlangganan push.' });
    }

    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint wajib diisi.' });
    }

    const { unsubscribeStudent } = require('../services/webpush');
    await unsubscribeStudent(req.user.studentId, endpoint);

    res.json({ message: 'Berhenti berlangganan push berhasil.' });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

// GET /api/dashboard/push/vapid-key - dapatkan VAPID public key
router.get('/push/vapid-key', auth, async (req, res) => {
  try {
    const { VAPID_PUBLIC_KEY } = require('../services/webpush');
    if (!VAPID_PUBLIC_KEY) {
      return res.status(503).json({ error: 'Push notification belum dikonfigurasi.' });
    }
    res.json({ publicKey: VAPID_PUBLIC_KEY });
  } catch (error) {
    console.error('VAPID key error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

// GET /api/dashboard/export-csv
router.get('/export-csv', auth, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      return res.status(403).json({ error: 'Admin tidak dapat mengexport nilai.' });
    }

    const student = await Student.findById(req.user.studentId);
    if (!student) {
      return res.status(404).json({ error: 'Data siswa tidak ditemukan.' });
    }

    const allCoursework = await CourseworkCache.find({
      'studentSubmissions.studentId': student._id,
    });

    const rows = [['Mata Pelajaran', 'Tugas', 'Tipe', 'Nilai', 'Max', 'Status', 'Tenggat']];

    for (const cw of allCoursework) {
      const sub = cw.studentSubmissions.find(
        s => s.studentId?.toString() === student._id.toString()
      );

      const score = sub && sub.grade !== undefined && sub.grade !== null ? sub.grade : '-';
      const status = sub && sub.state === 'TURNED_IN' ? 'Terkumpul' : 'Belum';
      const due = cw.dueDate
        ? new Date(cw.dueDate).toLocaleDateString('id-ID')
        : '-';

      rows.push([
        cw.courseAlias,
        cw.title,
        cw.workType,
        score,
        cw.maxPoints || 100,
        status,
        due,
      ]);
    }

    const csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="nilai-${student.nis}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

module.exports = router;
