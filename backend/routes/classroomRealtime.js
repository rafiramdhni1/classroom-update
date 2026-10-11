const express = require('express');
const { auth, staffOnly } = require('../middleware/auth');
const Student = require('../models/Student');
const CourseworkCache = require('../models/CourseworkCache');
const User = require('../models/User');
const { google } = require('googleapis');
const { mapWithConcurrency, apiWithRetry, buildStudentMatchMaps, courseHasMatchingStudent, ROSTER_FIELDS } = require('../services/classroom');

const router = express.Router();

const COURSE_CONCURRENCY = 4;
const WORK_CONCURRENCY = 6;
const COURSEWORK_FIELDS = 'courseWork(id,title,description,dueDate,dueTime,maxPoints,workType)';
const SUBMISSION_FIELDS = 'studentSubmissions(userId,state,late,updateTime,draftGrade,assignedGrade,shortAnswerSubmission,multipleChoiceSubmission)';

const SUBJECT_ALIAS_MAP = {
  'ASJ': 'ASJ',
  'AIJ': 'AIJ',
  'TJBL': 'TJBL',
  'PKDK': 'PKDK',
  'TJKT': 'TJKT',
};

function detectSubjectAlias(courseName) {
  const name = courseName.toUpperCase();
  for (const alias of Object.keys(SUBJECT_ALIAS_MAP)) {
    if (name.includes(alias)) return alias;
  }
  return null;
}

// Cocokkan roster dengan EXACT match saja (classroomId persis, atau email=NISN).
// Tanpa fuzzy nama, supaya deteksi kelas sesuai data admin & tidak salah ambil siswa beda kelas.
function buildExactRosterMatchMap(rosterStudents, maps) {
  const matchMap = new Map();
  for (const gc of rosterStudents) {
    const gcUserId = gc.userId;
    if (!gcUserId) continue;
    const byId = maps.byClassroomId.get(gcUserId);
    if (byId) {
      matchMap.set(gcUserId, byId);
      continue;
    }
    const emailPrefix = (gc.profile?.emailAddress?.split('@')[0] || '').trim().toLowerCase();
    if (emailPrefix && maps.byNisn.has(emailPrefix)) {
      matchMap.set(gcUserId, maps.byNisn.get(emailPrefix));
    }
  }
  return matchMap;
}

// Ambil info kelas (X-TKJ1..XII-TKJ2) dari NAMA kursus Google Classroom.
// Nama kursus selalu memuat kode kelas, mis. "XI-2 AIJ 26-27" => XI-TKJ2,
// "2526-1-XII TKJ-AIJ" => XII-TKJ1, "21/22 TJBL 1-XITKJ" => XI-TKJ1.
function detectKelasFromCourseName(courseName) {
  const name = String(courseName || '').toUpperCase();
  const full = name.match(/(XII|XI|\bX\b)(?:-|\s|\.|\/)?TKJ(?:-|\s|\.)?([1-9])/);
  if (full) return `${full[1]}-TKJ${full[2]}`;
  const rev = name.match(/([1-9])(?:-|\s|\/)(XII|XI|\bX\b)(?:-?\s?TKJ)?(?!\w)/);
  if (rev) return `${rev[2]}-TKJ${rev[1]}`;
  const late = name.match(/([1-9])-(?:12|XII)-TKJ/);
  if (late) return `XII-TKJ${late[1]}`;
  const rom = name.match(/(XII|XI|\bX\b)(?:-|\s|\.)([1-9])/);
  if (rom) return `${rom[1]}-TKJ${rom[2]}`;
  return null;
}

// Deteksi kelas utk satu kursus: prioritas dari nama kursus, fallback dari
// roster yang cocok exactly (kelas mayoritas siswa terdaftar di panel admin).
function detectCourseKelas(courseName, rosterMatch) {
  const fromName = detectKelasFromCourseName(courseName);
  if (fromName) return [fromName];
  const count = {};
  let max = 0;
  let best = null;
  for (const s of rosterMatch.values()) {
    if (!s.kelas) continue;
    count[s.kelas] = (count[s.kelas] || 0) + 1;
    if (count[s.kelas] > max) {
      max = count[s.kelas];
      best = s.kelas;
    }
  }
  return best ? [best] : [];
}

function getAuth(accessToken, refreshToken) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      try {
        const User = require('../models/User');
        const user = await User.findOne({ googleAccessToken: accessToken });
        if (user) {
          user.googleAccessToken = tokens.access_token;
          if (tokens.expiry_date) user.googleTokenExpiry = new Date(tokens.expiry_date);
          await user.save();
          console.log('[Google] Token refreshed and saved');
        }
      } catch (err) {
        console.error('[Google] Gagal simpan token baru:', err.message);
      }
    }
  });
  return oauth2Client;
}

async function getGoogleUser(userId) {
  let user = await User.findById(userId);
  if (user && user.googleAccessToken) return user;
  const adminUser = await User.findOne({ googleAccessToken: { $exists: true, $ne: null } });
  return adminUser || null;
}

// GET /api/classroom-realtime/grades - Real-time grades from Google Classroom
// ?cached=1 -> baca dari CourseworkCache (instan, data hasil sinkronisasi terakhir)
router.get('/grades', auth, staffOnly, async (req, res) => {
  try {
    const { kelas, subject } = req.query;
    const courseId = req.query.courseId;
    const useCache = req.query.cached === '1';

    const user = await User.findById(req.userId);
    if (!user || !user.googleAccessToken) {
      return res.status(400).json({ error: 'Google Classroom belum terhubung.' });
    }

    let students = [];
    const classroomIds = new Set();
    if (kelas) {
      students = await Student.find({ kelas, isActive: true }).sort({ nis: 1 }).lean();
      for (const s of students) if (s.classroomId) classroomIds.add(s.classroomId);
    }

    // Jalur cepat: tampilkan data cache hasil sinkronisasi tanpa memanggil API Google
    if (useCache) {
      const filter = { ownerId: user._id };
      if (courseId) filter.classroomCourseId = courseId;
      else if (subject) filter.courseAlias = subject;
      const coursework = await CourseworkCache.find(filter).sort({ dueDate: -1 }).lean();

      const results = coursework.map(cw => ({
        courseId: cw.classroomCourseId,
        courseName: cw.courseName,
        courseAlias: cw.courseAlias,
        courseworkId: cw.classroomWorkId,
        title: cw.title,
        workType: cw.workType || 'ASSIGNMENT',
        description: cw.description || '',
        dueDate: cw.dueDate,
        maxPoints: cw.maxPoints || 100,
        submissions: (cw.studentSubmissions || []).map(sub => ({
          classroomStudentId: sub.classroomStudentId,
          state: sub.state,
          late: sub.late,
          grade: sub.grade,
          submittedAt: sub.submittedAt,
        })),
      }));

      if (kelas) {
        const filteredResults = results.map(r => ({
          ...r,
          submissions: r.submissions.filter(s => classroomIds.has(s.classroomStudentId)),
        }));

        return res.json({
          data: filteredResults,
          students,
          totalCoursework: filteredResults.length,
          isRealtime: false,
          fromCache: true,
        });
      }

      return res.json({ data: results, totalCoursework: results.length, isRealtime: false, fromCache: true });
    }

    const authClient = getAuth(user.googleAccessToken, user.googleRefreshToken);
    const classroom = google.classroom({ version: 'v1', auth: authClient });

    const coursesRes = await apiWithRetry(() => classroom.courses.list({ pageSize: 100 }));
    const courses = coursesRes.data.courses || [];

    // Hanya proses kursus yang siswanya terdaftar di panel admin
    const matchMaps = await buildStudentMatchMaps();

    const results = [];

    await mapWithConcurrency(courses, COURSE_CONCURRENCY, async (course) => {
      const alias = detectSubjectAlias(course.name);
      if (!alias) return;
      if (courseId && course.id !== courseId) return;
      if (subject && alias !== subject) return;

      let courseResults = [];
      try {
        const rosterRes = await apiWithRetry(() =>
          classroom.courses.students.list({
            courseId: course.id,
            pageSize: 100,
            fields: ROSTER_FIELDS,
          })
        );
        const roster = rosterRes.data.students || [];
        if (roster.length > 0 && !courseHasMatchingStudent(roster, matchMaps)) return;

        const courseworkRes = await apiWithRetry(() =>
          classroom.courses.courseWork.list({
            courseId: course.id,
            orderBy: 'dueDate desc',
            pageSize: 100,
            fields: COURSEWORK_FIELDS,
          })
        );

        const courseworkList = courseworkRes.data.courseWork || [];

        courseResults = await mapWithConcurrency(courseworkList, WORK_CONCURRENCY, async (work) => {
          const submissionsRes = await apiWithRetry(() =>
            classroom.courses.courseWork.studentSubmissions.list({
              courseId: course.id,
              courseWorkId: work.id,
              pageSize: 100,
              fields: SUBMISSION_FIELDS,
            })
          );

          const submissions = submissionsRes.data.studentSubmissions || [];

          const dueDate = work.dueDate
            ? new Date(work.dueDate.year, work.dueDate.month - 1, work.dueDate.day,
              work.dueTime?.hours || 23, work.dueTime?.minutes || 59)
            : undefined;

          return {
            courseId: course.id,
            courseName: course.name,
            courseAlias: alias,
            courseworkId: work.id,
            title: work.title,
            workType: work.workType || 'ASSIGNMENT',
            description: work.description || '',
            dueDate,
            maxPoints: work.maxPoints || 100,
            submissions: submissions.map(sub => ({
              classroomStudentId: sub.userId,
              state: sub.state,
              late: sub.late,
              grade: sub.assignedGrade || sub.draftGrade || sub.shortAnswerSubmission?.grade || sub.multipleChoiceSubmission?.grade || undefined,
              submittedAt: sub.updateTime ? new Date(sub.updateTime) : undefined,
            })),
          };
        });
      } catch (err) {
        console.log(`[Realtime Grades] Error kursus ${course.name}: ${err.message}`);
      }
      results.push(...courseResults);
    });

    if (kelas) {
      const filteredResults = results.map(r => ({
        ...r,
        submissions: r.submissions.filter(s => classroomIds.has(s.classroomStudentId)),
      }));

      return res.json({
        data: filteredResults,
        students,
        totalCoursework: filteredResults.length,
        isRealtime: true,
      });
    }

    res.json({ data: results, totalCoursework: results.length, isRealtime: true });
  } catch (error) {
    console.error('Realtime grades error:', error);
    res.status(500).json({ error: 'Gagal mengambil data dari Google Classroom: ' + error.message });
  }
});

// POST /api/classroom-realtime/sync-students - Sync classroomId dari Google Classroom
router.post('/sync-students', auth, staffOnly, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || !user.googleAccessToken) {
      return res.status(400).json({ error: 'Google Classroom belum terhubung.' });
    }

    const authClient = getAuth(user.googleAccessToken, user.googleRefreshToken);
    const classroom = google.classroom({ version: 'v1', auth: authClient });

    const coursesRes = await apiWithRetry(() => classroom.courses.list({ pageSize: 100 }));
    const courses = coursesRes.data.courses || [];

    // Muat semua siswa sekali ke memori agar tidak ada query N+1 ke database
    const allStudents = await Student.find({ isActive: true }).lean();
    const byClassroomId = new Map();
    const byNisn = new Map();
    for (const s of allStudents) {
      if (s.classroomId) byClassroomId.set(s.classroomId, s);
      if (s.nisn) byNisn.set(String(s.nisn).trim().toLowerCase(), s);
    }
    const unlinked = allStudents.filter(s => !s.classroomId);
    const matchedIds = new Set();

    let synced = 0;
    let matched = 0;
    const details = [];
    const studentsToUpdate = [];

    await mapWithConcurrency(courses, COURSE_CONCURRENCY, async (course) => {
      try {
        const studentsRes = await apiWithRetry(() =>
          classroom.courses.students.list({
            courseId: course.id,
            pageSize: 100,
          })
        );

        const gcStudents = studentsRes.data.students || [];

        for (const gcStudent of gcStudents) {
          const gcUserId = gcStudent.userId;
          if (!gcUserId || matchedIds.has(gcUserId)) continue;

          const gcName = gcStudent.profile?.name?.fullName || '';
          const email = gcStudent.profile?.emailAddress || '';
          const emailPrefix = (email.split('@')[0] || '').trim().toLowerCase();

          // 1. Cari siswa yang sudah punya classroomId ini
          let dbStudent = byClassroomId.get(gcUserId);

          // 2. Match by email prefix (nisn)
          if (!dbStudent && emailPrefix) {
            dbStudent = byNisn.get(emailPrefix);
          }

          // 3. Fuzzy match by name (konten) - hanya di memori
          if (!dbStudent && gcName) {
            const cleanGcName = gcName.replace(/\d+$/, '').trim().toLowerCase();
            for (const s of unlinked) {
              if (matchedIds.has(String(s._id))) continue;
              const cleanDbName = s.nama.toLowerCase();
              if (cleanDbName.includes(cleanGcName) || cleanGcName.includes(cleanDbName.split(' ').pop())) {
                dbStudent = s;
                break;
              }
            }
          }

          if (dbStudent) {
            matchedIds.add(gcUserId);
            const isNew = !dbStudent.classroomId || dbStudent.classroomId !== gcUserId;
            if (isNew) {
              studentsToUpdate.push({
                updateOne: {
                  filter: { _id: dbStudent._id },
                  update: { $set: { classroomId: gcUserId } },
                },
              });
              details.push({ nama: dbStudent.nama, nisn: dbStudent.nisn, classroomId: gcUserId, course: course.name });
            }
            matched++;
          }
        }
        synced++;
      } catch (err) {
        console.log(`[Sync Students] Error course ${course.name}: ${err.message}`);
      }
    });

    if (studentsToUpdate.length > 0) {
      await Student.bulkWrite(studentsToUpdate);
    }

    res.json({
      message: `Sinkron selesai. ${matched} siswa dicocokkan dari ${synced} kelas.`,
      matched,
      synced,
      details,
    });
  } catch (error) {
    console.error('Sync students error:', error);
    res.status(500).json({ error: 'Gagal sinkron siswa: ' + error.message });
  }
});

// GET /api/classroom-realtime/students/:courseId - List students in a course
router.get('/students/:courseId', auth, staffOnly, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || !user.googleAccessToken) {
      return res.status(400).json({ error: 'Google Classroom belum terhubung.' });
    }

    const authClient = getAuth(user.googleAccessToken, user.googleRefreshToken);
    const classroom = google.classroom({ version: 'v1', auth: authClient });

    const studentsRes = await classroom.courses.students.list({
      courseId: req.params.courseId,
      pageSize: 100,
    });

    const students = (studentsRes.data.students || []).map(s => ({
      userId: s.userId,
      name: s.profile?.name?.fullName || '',
      email: s.profile?.emailAddress || '',
    }));

    res.json({ students });
  } catch (error) {
    console.error('Get course students error:', error);
    res.status(500).json({ error: 'Gagal mengambil siswa: ' + error.message });
  }
});

const coursesCache = new Map(); // userId -> { data, expiresAt }

// GET /api/classroom-realtime/courses - List all courses
router.get('/courses', auth, staffOnly, async (req, res) => {
  try {
    const force = req.query.force === 'true';
    const cachedEntry = coursesCache.get(req.userId);
    if (!force && cachedEntry && cachedEntry.expiresAt > Date.now()) {
      return res.json(cachedEntry.data);
    }

    const user = await getGoogleUser(req.userId);
    let courses = [];

    if (user && user.googleAccessToken) {
      try {
        const authClient = getAuth(user.googleAccessToken, user.googleRefreshToken);
        const classroom = google.classroom({ version: 'v1', auth: authClient });

        const coursesRes = await apiWithRetry(() => classroom.courses.list({ pageSize: 100 }));
        courses = coursesRes.data.courses || [];
      } catch (gErr) {
        console.warn('Google Classroom list courses warning:', gErr.message);
      }
    }

    if (courses.length > 0) {
      // Deteksi kelas (sesuai data siswa yang diinput admin) utk tiap kursus Google Classroom
      const matchMaps = await buildStudentMatchMaps();

      const result = [];
      await mapWithConcurrency(courses, COURSE_CONCURRENCY, async (course) => {
        const item = {
          id: course.id,
          name: course.name,
          alias: detectSubjectAlias(course.name),
          section: course.section,
          kelas: [],
        };
        let match = new Map();
        try {
          const authClient = getAuth(user.googleAccessToken, user.googleRefreshToken);
          const classroom = google.classroom({ version: 'v1', auth: authClient });
          const rosterRes = await apiWithRetry(() =>
            classroom.courses.students.list({
              courseId: course.id,
              pageSize: 1000,
              fields: ROSTER_FIELDS,
            })
          );
          const roster = rosterRes.data.students || [];
          match = buildExactRosterMatchMap(roster, matchMaps);
          item.kelas = detectCourseKelas(course.name, match);
        } catch (err) {
          console.log(`[Courses] Gagal ambil roster ${course.name}: ${err.message}`);
        }
        item.matchedStudents = match.size;
        result.push(item);
      });

      const responseData = { courses: result, isLive: true };
      coursesCache.set(req.userId, { data: responseData, expiresAt: Date.now() + 2 * 60 * 1000 });
      return res.json(responseData);
    }

    // Fallback dari database lokal jika Google Classroom belum terhubung / token expired
    const cached = await CourseworkCache.find({}).lean();
    const courseMap = new Map();
    for (const cw of cached) {
      if (!courseMap.has(cw.classroomCourseId)) {
        courseMap.set(cw.classroomCourseId, {
          id: cw.classroomCourseId,
          name: cw.courseName,
          alias: cw.courseAlias,
          section: 'TKJ',
          kelas: ['X-TKJ1', 'X-TKJ2', 'XI-TKJ1', 'XI-TKJ2', 'XII-TKJ1', 'XII-TKJ2'],
          matchedStudents: 36,
          isCached: true,
        });
      }
    }

    // Mapel default SMK TKJ jika cache belum ada
    if (courseMap.size === 0) {
      const defaultCourses = [
        { id: 'course-asj-001', name: 'Administrasi Sistem Jaringan (ASJ)', alias: 'ASJ' },
        { id: 'course-aij-001', name: 'Administrasi Infrastruktur Jaringan (AIJ)', alias: 'AIJ' },
        { id: 'course-tjbl-001', name: 'Teknologi Jaringan Berbasis Luas (TJBL)', alias: 'TJBL' },
        { id: 'course-pkdk-001', name: 'Produk Kreatif dan Kewirausahaan (PKDK)', alias: 'PKDK' },
        { id: 'course-tjkt-001', name: 'Dasar-Dasar TJKT', alias: 'TJKT' },
      ];
      for (const d of defaultCourses) {
        courseMap.set(d.id, {
          id: d.id,
          name: d.name,
          alias: d.alias,
          section: 'TKJ',
          kelas: ['X-TKJ1', 'X-TKJ2', 'XI-TKJ1', 'XI-TKJ2', 'XII-TKJ1', 'XII-TKJ2'],
          matchedStudents: 36,
          isCached: true,
        });
      }
    }

    const fallbackData = {
      courses: Array.from(courseMap.values()),
      isLive: false,
      googleAuthRequired: !user || !user.googleAccessToken,
    };
    coursesCache.set(req.userId, { data: fallbackData, expiresAt: Date.now() + 30 * 1000 });
    res.json(fallbackData);
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ error: 'Gagal mengambil daftar kelas.' });
  }
});

// POST /api/classroom-realtime/coursework - Create coursework in Google Classroom
router.post('/coursework', auth, staffOnly, async (req, res) => {
  try {
    const { courseId, title, description, workType, dueDate, maxPoints, state, kelas } = req.body;
    if (!courseId || !title) {
      return res.status(400).json({ error: 'courseId dan title wajib diisi.' });
    }

    const user = await getGoogleUser(req.userId);
    let createdCoursework = null;
    let googleError = null;

    if (user && user.googleAccessToken) {
      try {
        const authClient = getAuth(user.googleAccessToken, user.googleRefreshToken);
        const classroom = google.classroom({ version: 'v1', auth: authClient });

        const courseworkBody = {
          title,
          description: description || '',
          workType: workType || 'ASSIGNMENT',
          maxPoints: Number(maxPoints) || 100,
          state: state || 'PUBLISHED',
        };

        if (dueDate) {
          const d = new Date(dueDate);
          courseworkBody.dueDate = {
            year: d.getFullYear(),
            month: d.getMonth() + 1,
            day: d.getDate(),
          };
          courseworkBody.dueTime = {
            hours: d.getHours(),
            minutes: d.getMinutes(),
          };
        }

        const created = await apiWithRetry(() =>
          classroom.courses.courseWork.create({
            courseId,
            requestBody: courseworkBody,
          })
        );
        createdCoursework = created.data;
      } catch (err) {
        console.error('Create coursework Google Classroom API error:', err.message);
        googleError = err.message;
      }
    } else {
      googleError = 'Akun Google Classroom belum terhubung.';
    }

    // Selalu simpan tugas ke database lokal (CourseworkCache) agar langsung instan muncul di kalender, nilai, dan dashboard siswa
    const workId = createdCoursework ? createdCoursework.id : 'cw-' + Date.now();
    const alias = detectSubjectAlias(title) || 'ASJ';
    const targetKelas = kelas || 'X-TKJ1';
    const studentsInClass = await Student.find({ kelas: targetKelas, isActive: true });
    const submissions = studentsInClass.map(s => ({
      classroomStudentId: s.classroomId || String(s._id),
      studentId: s._id,
      state: 'NEW',
      grade: null,
      late: false,
      isGraded: false,
    }));

    await CourseworkCache.findOneAndUpdate(
      { classroomCourseId: courseId, classroomWorkId: workId },
      {
        ownerId: req.userId,
        classroomCourseId: courseId,
        classroomWorkId: workId,
        title,
        description: description || '',
        courseName: title,
        courseAlias: alias,
        dueDate: dueDate ? new Date(dueDate) : null,
        maxPoints: Number(maxPoints) || 100,
        workType: workType || 'ASSIGNMENT',
        studentSubmissions: submissions,
        lastSyncedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    if (createdCoursework) {
      return res.json({
        coursework: createdCoursework,
        message: 'Tugas berhasil dibuat dan otomatis terbit di Google Classroom!',
        googleSynced: true,
      });
    }

    return res.json({
      coursework: {
        id: workId,
        title,
        description,
        state: state || 'PUBLISHED',
      },
      message: `Tugas berhasil disimpan di sistem! Catatan: Belum terkirim ke server Google Classroom (${googleError}). Silakan hubungkan akun Google di menu Google Classroom.`,
      googleSynced: false,
    });
  } catch (error) {
    console.error('Create coursework error:', error);
    res.status(500).json({ error: 'Gagal membuat tugas: ' + error.message });
  }
});

// POST /api/classroom-realtime/coursework/:courseworkId/publish - Publish coursework
router.post('/coursework/:courseworkId/publish', auth, staffOnly, async (req, res) => {
  try {
    const { courseworkId } = req.params;
    const { courseId } = req.body;
    if (!courseId) {
      return res.status(400).json({ error: 'courseId wajib diisi.' });
    }

    const user = await User.findById(req.userId);
    if (!user || !user.googleAccessToken) {
      return res.status(400).json({ error: 'Google Classroom belum terhubung.' });
    }

    const authClient = getAuth(user.googleAccessToken, user.googleRefreshToken);
    const classroom = google.classroom({ version: 'v1', auth: authClient });

    const updated = await apiWithRetry(() =>
      classroom.courses.courseWork.patch({
        courseId,
        id: courseworkId,
        requestBody: { state: 'PUBLISHED' },
      })
    );

    res.json({ coursework: updated.data });
  } catch (error) {
    console.error('Publish coursework error:', error);
    res.status(500).json({ error: 'Gagal mempublikasikan: ' + error.message });
  }
});

// GET /api/classroom-realtime/coursework - List coursework for a course
router.get('/coursework', auth, staffOnly, async (req, res) => {
  try {
    const { courseId, state } = req.query;
    if (!courseId) {
      return res.status(400).json({ error: 'courseId wajib diisi.' });
    }

    const user = await User.findById(req.userId);
    if (!user || !user.googleAccessToken) {
      return res.status(400).json({ error: 'Google Classroom belum terhubung.' });
    }

    const authClient = getAuth(user.googleAccessToken, user.googleRefreshToken);
    const classroom = google.classroom({ version: 'v1', auth: authClient });

    const courseworkRes = await apiWithRetry(() =>
      classroom.courses.courseWork.list({
        courseId,
        orderBy: 'updateTime desc',
        pageSize: 100,
        fields: COURSEWORK_FIELDS,
      })
    );

    let coursework = courseworkRes.data.courseWork || [];
    if (state) {
      coursework = coursework.filter(cw => cw.state === state);
    }

    res.json({ coursework });
  } catch (error) {
    console.error('List coursework error:', error);
    res.status(500).json({ error: 'Gagal mengambil daftar tugas: ' + error.message });
  }
});

// DELETE /api/classroom-realtime/coursework/:courseworkId - Delete coursework
router.delete('/coursework/:courseworkId', auth, staffOnly, async (req, res) => {
  try {
    const { courseworkId } = req.params;
    const { courseId } = req.query;
    if (!courseId) {
      return res.status(400).json({ error: 'courseId wajib diisi.' });
    }

    const user = await User.findById(req.userId);
    if (!user || !user.googleAccessToken) {
      return res.status(400).json({ error: 'Google Classroom belum terhubung.' });
    }

    const authClient = getAuth(user.googleAccessToken, user.googleRefreshToken);
    const classroom = google.classroom({ version: 'v1', auth: authClient });

    await apiWithRetry(() =>
      classroom.courses.courseWork.delete({
        courseId,
        id: courseworkId,
      })
    );

    res.json({ message: 'Tugas dihapus.' });
  } catch (error) {
    console.error('Delete coursework error:', error);
    res.status(500).json({ error: 'Gagal menghapus: ' + error.message });
  }
});

module.exports = router;
