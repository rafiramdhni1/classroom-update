const express = require('express');
const { auth, staffOnly } = require('../middleware/auth');
const Student = require('../models/Student');
const Grade = require('../models/Grade');
const CourseworkCache = require('../models/CourseworkCache');
const AdminMessage = require('../models/AdminMessage');
const ActivationCode = require('../models/ActivationCode');
const ChatId = require('../models/ChatId');
const User = require('../models/User');

const router = express.Router();

const SUBJECTS = ['ASJ', 'AIJ', 'TJBL', 'PKDK', 'TJKT'];
const round = (n, d = 2) => (n === null || n === undefined || Number.isNaN(n) ? null : Math.round(n * 10 ** d) / 10 ** d);

// Hitung rata-rata tiap siswa dari submissions Google Classroom + nilai manual.
// Satu jalan baca data, dipakai ulang oleh overview / leaderboard.
async function buildAverages() {
  const [students, coursework, manual] = await Promise.all([
    Student.find({ isActive: true }).select('nis nama kelas angkatan').lean(),
    CourseworkCache.find({}).select('courseAlias title dueDate workType createdAt studentSubmissions').lean(),
    Grade.find({}).select('studentId subject score title type createdAt').lean(),
  ]);

  const byStudent = new Map();
  students.forEach(s => {
    byStudent.set(String(s._id), {
      student: s,
      cwTotal: 0,
      cwCount: 0,
      subjectCw: {},
      manualTotal: 0,
      manualCount: 0,
      subjectManual: {},
    });
  });

  for (const cw of coursework) {
    for (const sub of cw.studentSubmissions || []) {
      if (!sub.studentId || sub.grade === null || sub.grade === undefined) continue;
      const row = byStudent.get(String(sub.studentId));
      if (!row) continue;
      row.cwTotal += sub.grade;
      row.cwCount += 1;
      if (!row.subjectCw[cw.courseAlias]) row.subjectCw[cw.courseAlias] = { total: 0, count: 0 };
      row.subjectCw[cw.courseAlias].total += sub.grade;
      row.subjectCw[cw.courseAlias].count += 1;
    }
  }

  for (const g of manual) {
    if (g.score === null || g.score === undefined) continue;
    const row = byStudent.get(String(g.studentId));
    if (!row) continue;
    row.manualTotal += g.score;
    row.manualCount += 1;
    if (!row.subjectManual[g.subject]) row.subjectManual[g.subject] = { total: 0, count: 0 };
    row.subjectManual[g.subject].total += g.score;
    row.subjectManual[g.subject].count += 1;
  }

  const rows = [];
  for (const row of byStudent.values()) {
    const total = row.cwTotal + row.manualTotal;
    const count = row.cwCount + row.manualCount;
    const subjectAvg = {};
    for (const alias of SUBJECTS) {
      const cw = row.subjectCw[alias];
      const mg = row.subjectManual[alias];
      const t = (cw?.total || 0) + (mg?.total || 0);
      const c = (cw?.count || 0) + (mg?.count || 0);
      if (c > 0) subjectAvg[alias] = round(t / c);
    }
    rows.push({
      student: row.student,
      average: count > 0 ? round(total / count) : null,
      gradedCount: count,
      subjectAvg,
    });
  }

  return { rows, coursework, manual, students };
}

function bucketOf(avg) {
  if (avg === null) return 'belum';
  if (avg >= 90) return 'a';
  if (avg >= 80) return 'b';
  if (avg >= 70) return 'c';
  return 'd';
}

function rankList(rows) {
  const sorted = [...rows].sort((a, b) => (b.average ?? -1) - (a.average ?? -1));
  let lastAvg = null;
  let lastRank = 0;
  return sorted.map((r, i) => {
    if (r.average !== null && r.average !== lastAvg) {
      lastRank = i + 1;
      lastAvg = r.average;
    }
    return { ...r, rank: r.average === null ? null : lastRank };
  });
}

// GET /api/analytics/overview - dasbor analitik admin & guru
router.get('/overview', auth, staffOnly, async (req, res) => {
  try {
    const { rows, coursework, manual } = await buildAverages();

    const kelasMap = new Map();
    for (const r of rows) {
      const k = r.student.kelas;
      if (!kelasMap.has(k)) kelasMap.set(k, { kelas: k, students: 0, sums: 0, graded: 0, dist: { a: 0, b: 0, c: 0, d: 0, belum: 0 } });
      const entry = kelasMap.get(k);
      entry.students += 1;
      if (r.average !== null) {
        entry.sums += r.average;
        entry.graded += 1;
      }
      entry.dist[bucketOf(r.average)] += 1;
    }
    const perKelas = [...kelasMap.values()]
      .map(k => ({
        kelas: k.kelas,
        students: k.students,
        graded: k.graded,
        average: k.graded > 0 ? round(k.sums / k.graded) : null,
        dist: k.dist,
      }))
      .sort((a, b) => a.kelas.localeCompare(b.kelas));

    const subjMap = {};
    SUBJECTS.forEach(s => { subjMap[s] = { subject: s, total: 0, count: 0 }; });
    for (const r of rows) {
      for (const [alias, avg] of Object.entries(r.subjectAvg)) {
        if (!subjMap[alias]) continue;
        subjMap[alias].total += avg;
        subjMap[alias].count += 1;
      }
    }
    const perSubject = SUBJECTS.map(s => ({
      subject: s,
      students: subjMap[s].count,
      average: subjMap[s].count > 0 ? round(subjMap[s].total / subjMap[s].count) : null,
      entries: coursework.filter(c => c.courseAlias === s).length,
    }));

    const gradedValues = rows.filter(r => r.average !== null).map(r => r.average);
    const overallAverage = gradedValues.length
      ? round(gradedValues.reduce((a, b) => a + b, 0) / gradedValues.length)
      : null;

    const buckets = { a: 0, b: 0, c: 0, d: 0, belum: 0 };
    rows.forEach(r => { buckets[bucketOf(r.average)] += 1; });

    // Tren nilai manual per bulan (nilai input manual punya createdAt).
    const trendMap = new Map();
    for (const g of manual) {
      if (g.score === null || g.score === undefined || !g.createdAt) continue;
      const key = g.createdAt.toISOString().slice(0, 7);
      if (!trendMap.has(key)) trendMap.set(key, { total: 0, count: 0 });
      const t = trendMap.get(key);
      t.total += g.score;
      t.count += 1;
    }
    const trend = [...trendMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([month, v]) => ({ month, average: round(v.total / v.count), entries: v.count }));

    const topStudents = rankList(rows)
      .filter(r => r.average !== null)
      .slice(0, 10)
      .map(r => ({ rank: r.rank, nis: r.student.nis, nama: r.student.nama, kelas: r.student.kelas, average: r.average }));

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [newStudents7d, newGrades7d, newMessages, newCodes, totalStudents, totalUsers, activatedChats, pendingCodes] =
      await Promise.all([
        Student.countDocuments({ createdAt: { $gte: since } }),
        Grade.countDocuments({ createdAt: { $gte: since } }),
        AdminMessage.countDocuments({ createdAt: { $gte: since } }),
        ActivationCode.countDocuments({ createdAt: { $gte: since } }),
        Student.countDocuments({ isActive: true }),
        User.countDocuments(),
        ChatId.countDocuments({ isActive: true }),
        ActivationCode.countDocuments({ isUsed: false }),
      ]);

    const recentMessages = (await AdminMessage.find({}).sort({ createdAt: -1 }).limit(6).lean())
      .map(m => ({
        id: m._id,
        title: m.title,
        priority: m.priority,
        isGlobal: m.isGlobal,
        createdAt: m.createdAt,
        readCount: (m.isReadBy || []).length,
      }));

    res.json({
      generatedAt: new Date(),
      totals: { totalStudents, totalUsers, activatedChats, pendingCodes, overallAverage },
      perKelas,
      perSubject,
      distribution: [
        { label: '90 - 100', key: 'a', count: buckets.a },
        { label: '80 - 89', key: 'b', count: buckets.b },
        { label: '70 - 79', key: 'c', count: buckets.c },
        { label: '< 70', key: 'd', count: buckets.d },
        { label: 'Belum dinilai', key: 'belum', count: buckets.belum },
      ],
      trend,
      topStudents,
      activity: {
        newStudents7d,
        newGrades7d,
        newMessages7d: newMessages,
        newCodes7d: newCodes,
        messages: recentMessages,
      },
    });
  } catch (error) {
    console.error('Analytics overview error:', error);
    res.status(500).json({ error: 'Gagal memuat analitik.' });
  }
});

// GET /api/analytics/leaderboard?scope=class|angkatan|school
router.get('/leaderboard', auth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);
    const { rows } = await buildAverages();
    const ranked = rankList(rows);

    const me = req.user.studentId ? rows.find(r => String(r.student._id) === String(req.user.studentId)) : null;
    let scope = req.query.scope || 'class';

    if (req.user.role === 'admin' || req.user.role === 'guru') {
      scope = req.query.scope === 'angkatan' || req.query.scope === 'class' ? req.query.scope : 'school';
    }

    let filtered = ranked;
    if (scope === 'class' && me) filtered = ranked.filter(r => r.student.kelas === me.student.kelas);
    else if (scope === 'angkatan' && me) filtered = ranked.filter(r => r.student.angkatan === me.student.angkatan);
    else if (scope === 'kelas' && req.query.kelas) filtered = ranked.filter(r => r.student.kelas === req.query.kelas);

    const entries = filtered
      .slice(0, limit)
      .map(r => ({
        rank: r.rank,
        nis: r.student.nis,
        nama: r.student.nama,
        kelas: r.student.kelas,
        angkatan: r.student.angkatan,
        average: r.average,
        isMe: me ? String(r.student._id) === String(me.student._id) : false,
      }));

    const myRank = me && (scope === 'class' || scope === 'angkatan' || scope === 'school')
      ? (filtered.find(r => String(r.student._id) === String(me.student._id)) || {}).rank ?? null
      : null;

    res.json({
      scope,
      total: filtered.length,
      entries,
      me: me
        ? { rank: myRank, nama: me.student.nama, kelas: me.student.kelas, angkatan: me.student.angkatan, average: me.average }
        : null,
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Gagal memuat peringkat.' });
  }
});

// GET /api/analytics/tasks?days=30 - kalender tugas (Google Classroom)
// Query opsional:
//   range=bills -> jendela diperluas (-90 hari s/d +120 hari) untuk menu Tagihan Tugas
router.get('/tasks', auth, async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days, 10) || 30, 120);
    const wide = req.query.range === 'bills';
    const now = new Date();
    const from = new Date(now.getTime() - (wide ? 90 : 15) * 24 * 60 * 60 * 1000);
    const to = new Date(now.getTime() + (wide ? 120 : days) * 24 * 60 * 60 * 1000);

    const isStaff = req.user.role === 'admin' || req.user.role === 'guru';
    const filter = {};
    if (!isStaff && req.user.studentId) filter['studentSubmissions.studentId'] = req.user.studentId;

    // Banyak tugas Google Classroom tidak punya dueDate (atau dueDate lama),
    // jadi pakai dueDate bila ada, kalau tidak pakai tanggal sinkronisasi.
    const works = (await CourseworkCache.find(filter)
      .select('title courseAlias courseName dueDate createdAt workType studentSubmissions')
      .lean())
      .map(w => ({ ...w, eventAt: w.dueDate || w.createdAt }))
      .filter(w => w.eventAt && w.eventAt >= from && w.eventAt <= to)
      .sort((a, b) => a.eventAt - b.eventAt);

    const taught = req.user?.subjects?.length ? req.user.subjects : null;
    const tasks = works
      .filter(w => (isStaff && taught ? taught.includes(w.courseAlias) : true))
      .map(w => {
        const base = {
          id: String(w._id),
          title: w.title,
          subject: w.courseAlias,
          courseName: w.courseName,
          dueDate: w.eventAt,
          hasDueDate: Boolean(w.dueDate),
          postedAt: w.createdAt,
          workType: w.workType,
          overdue: w.eventAt < now,
        };
        if (isStaff) {
          const subs = (w.studentSubmissions || []).filter(s => s.studentId);
          const submitted = subs.filter(s => ['TURNED_IN', 'RETURNED'].includes(s.state)).length;
          const graded = subs.filter(s => s.grade !== null && s.grade !== undefined).length;
          return { ...base, totalStudents: subs.length, submitted, graded };
        }
        const sub = (w.studentSubmissions || []).find(s => String(s.studentId) === String(req.user.studentId));
        return {
          ...base,
          state: sub?.state || 'NEW',
          submittedAt: sub?.submittedAt || null,
          grade: sub?.grade ?? null,
          isGraded: sub?.grade !== null && sub?.grade !== undefined,
        };
      });

    const myOverdue = tasks.filter(t => !isStaff && t.overdue && t.state !== 'TURNED_IN' && t.state !== 'RETURNED').length;
    const dueThisWeek = tasks.filter(t => {
      const diff = (new Date(t.dueDate) - now) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 7;
    }).length;
    res.json({ tasks, summary: { total: tasks.length, dueThisWeek, myOverdue } });
  } catch (error) {
    console.error('Tasks error:', error);
    res.status(500).json({ error: 'Gagal memuat daftar tugas.' });
  }
});

module.exports = router;
