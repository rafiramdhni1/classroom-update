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

// GET /api/classroom-realtime/courses - List all courses
router.get('/courses', auth, staffOnly, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || !user.googleAccessToken) {
      return res.status(400).json({ error: 'Google Classroom belum terhubung.' });
    }

    const authClient = getAuth(user.googleAccessToken, user.googleRefreshToken);
    const classroom = google.classroom({ version: 'v1', auth: authClient });

    const coursesRes = await apiWithRetry(() => classroom.courses.list({ pageSize: 100 }));
    const courses = coursesRes.data.courses || [];

    // Deteksi kelas (sesuai data siswa yang diinput admin) utk tiap kursus Google Classroom
    // dengan mencocokkan roster kursus terhadap data siswa di panel admin.
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

    res.json({ courses: result });
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ error: 'Gagal mengambil daftar kelas.' });
  }
});

module.exports = router;
