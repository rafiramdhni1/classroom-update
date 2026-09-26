const { google } = require('googleapis');
const CourseworkCache = require('../models/CourseworkCache');
const Student = require('../models/Student');
const User = require('../models/User');

const SUBJECT_ALIAS_MAP = {
  'ASJ': 'ASJ',
  'AIJ': 'AIJ',
  'TJBL': 'TJBL',
  'PKDK': 'PKDK',
  'TJKT': 'TJKT',
};

const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
];

// Batas request API Google Classroom secara paralel agar tidak kena rate limit
const COURSE_CONCURRENCY = 4;
const WORK_CONCURRENCY = 6;

// Batasi field yang diambil dari API agar payload kecil & parsing cepat
const COURSEWORK_FIELDS = 'courseWork(id,title,description,dueDate,dueTime,maxPoints,workType,updateTime)';
const SUBMISSION_FIELDS = 'studentSubmissions(userId,state,late,updateTime,draftGrade,assignedGrade,shortAnswerSubmission,multipleChoiceSubmission)';

// Re-sinkron submissions hanya jika data cache sudah "basi" lewat ambang ini
const SUBMISSION_FRESH_MS = 5 * 60 * 1000;

async function apiWithRetry(fn, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      const reason = err?.response?.data?.error?.errors?.[0]?.reason || '';
      const isRateLimit = err?.response?.status === 429 ||
        /RATE_LIMIT|rateLimitExceeded|userRateLimitExceeded|quotaExceeded|QUOTA/i
          .test(`${reason} ${err?.message || ''}`);
      if (isRateLimit && i < attempts - 1) {
        await new Promise(r => setTimeout(r, 400 * (i + 1)));
        continue;
      }
      throw err;
    }
  }
}

async function mapWithConcurrency(items, concurrency, fn) {
  const results = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length || 1) }, async () => {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function getAuthUrl(state) {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state: state || '',
  });
}

async function getTokensFromCode(code) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

function getAuth(accessToken, refreshToken) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return oauth2Client;
}

function detectSubjectAlias(courseName) {
  const name = courseName.toUpperCase();
  for (const alias of Object.keys(SUBJECT_ALIAS_MAP)) {
    if (name.includes(alias)) return alias;
  }
  return null;
}

function buildDueDate(work) {
  return work.dueDate
    ? new Date(work.dueDate.year, work.dueDate.month - 1, work.dueDate.day,
      work.dueTime?.hours || 23, work.dueTime?.minutes || 59)
    : undefined;
}

// Ambil referensi semua siswa aktif sekali agar bisa di-match secara in-memory
async function buildStudentMatchMaps() {
  const students = await Student.find({ isActive: true }).lean();
  const byClassroomId = new Map();
  const byNisn = new Map();
  for (const s of students) {
    if (s.classroomId) byClassroomId.set(s.classroomId, s);
    if (s.nisn) byNisn.set(String(s.nisn).trim().toLowerCase(), s);
  }
  return { students, byClassroomId, byNisn };
}

// Normalisasi nama agar perbandingan nama konsisten
function normalizeNameForMatch(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\d+$/, '')
    .trim();
}

// Nama GC dianggap sama dengan nama DB jika:
// - persis sama, atau
// - nama GC memuat SELURUH nama lengkap DB (misal GC menambah embel-embel kelas/semester)
function namesMatch(gcName, dbName) {
  const g = normalizeNameForMatch(gcName);
  const d = normalizeNameForMatch(dbName);
  if (!g || !d) return false;
  if (g === d) return true;
  return g.includes(d) && d.length >= 6;
}

// Petakan siswa di roster Google Classroom ke siswa yang terdaftar di panel admin.
// Return Map: classroomUserId -> document siswa admin (hanya siswa yang cocok).
function buildRosterMatchMap(rosterStudents, maps) {
  const matchMap = new Map();
  for (const gc of rosterStudents) {
    const gcUserId = gc.userId;
    if (!gcUserId) continue;

    let student = maps.byClassroomId.get(gcUserId);
    if (student) {
      matchMap.set(gcUserId, student);
      continue;
    }

    const emailPrefix = (gc.profile?.emailAddress?.split('@')[0] || '').trim().toLowerCase();
    if (emailPrefix && maps.byNisn.has(emailPrefix)) {
      matchMap.set(gcUserId, maps.byNisn.get(emailPrefix));
      continue;
    }

    const gcName = gc.profile?.name?.fullName || '';
    if (!gcName) continue;
    for (const s of maps.students) {
      if (namesMatch(gcName, s.nama)) {
        matchMap.set(gcUserId, s);
        break;
      }
    }
  }
  return matchMap;
}

// Cek apakah minimal ada 1 siswa di roster kursus yang cocok dengan data siswa admin
function courseHasMatchingStudent(rosterStudents, maps) {
  return buildRosterMatchMap(rosterStudents, maps).size > 0;
}

const ROSTER_FIELDS = 'students(userId,profile(name(fullName),emailAddress))';

async function getSubmissionsForWork(classroom, courseId, workId, allowedStudentIds, rosterStudentMap) {
  let submissions = [];
  let rawCount = 0;
  try {
    const submissionsRes = await apiWithRetry(() =>
      classroom.courses.courseWork.studentSubmissions.list({
        courseId,
        courseWorkId: workId,
        pageSize: 100,
        fields: SUBMISSION_FIELDS,
      })
    );
    const rawSubs = submissionsRes.data.studentSubmissions || [];
    rawCount = rawSubs.length;

    // Hanya simpan submission milik siswa yang terdaftar di panel admin
    const candidateSubs = allowedStudentIds instanceof Set
      ? rawSubs.filter(sub => allowedStudentIds.has(sub.userId))
      : rawSubs;

    const classroomUserIds = candidateSubs.map(sub => sub.userId).filter(Boolean);
    const linkedStudents = await Student.find({ classroomId: { $in: classroomUserIds } }).lean();
    const classroomToStudent = new Map();
    for (const ls of linkedStudents) {
      classroomToStudent.set(ls.classroomId, ls._id);
    }

    submissions = candidateSubs.map(sub => ({
      classroomStudentId: sub.userId,
      studentId: classroomToStudent.get(sub.userId) || rosterStudentMap?.get(sub.userId)?._id || null,
      state: sub.state,
      late: sub.late,
      grade: sub.assignedGrade || sub.draftGrade || sub.shortAnswerSubmission?.grade || sub.multipleChoiceSubmission?.grade || undefined,
      submittedAt: sub.updateTime ? new Date(sub.updateTime) : undefined,
      isGraded: (sub.state === 'TURNED_IN' || sub.state === 'RETURNED') && (sub.assignedGrade !== undefined && sub.assignedGrade !== null || sub.draftGrade !== undefined && sub.draftGrade !== null || sub.shortAnswerSubmission?.grade !== undefined || sub.multipleChoiceSubmission?.grade !== undefined),
      gradeComponents: [],
    }));
  } catch (subErr) {
    console.log(`[Classroom Sync] Gagal ambil submissions: ${subErr.message}`);
  }
  return { submissions, rawCount };
}

async function upsertCoursework(ownerId, course, alias, work, submissions) {
  await CourseworkCache.findOneAndUpdate(
    { ownerId, classroomCourseId: course.id, classroomWorkId: work.id },
    {
      ownerId,
      classroomCourseId: course.id,
      classroomWorkId: work.id,
      title: work.title,
      description: work.description || '',
      courseName: course.name,
      courseAlias: alias,
      dueDate: buildDueDate(work),
      maxPoints: work.maxPoints || 100,
      workType: work.workType,
      studentSubmissions: submissions,
      lastSyncedAt: new Date(),
    },
    { upsert: true, new: true }
  );
}

async function syncAllCourses(userId) {
  let user = userId ? await User.findById(userId) : null;
  if (!user && !userId) {
    user = await User.findOne({ googleAccessToken: { $exists: true, $ne: null } });
  }
  if (!user || !user.googleAccessToken) {
    throw new Error('Google token tidak ditemukan. Silakan login Google terlebih dahulu.');
  }

  const auth = getAuth(user.googleAccessToken, user.googleRefreshToken);
  const classroom = google.classroom({ version: 'v1', auth });

  console.log('[Classroom Sync] Mulai sinkronisasi...');

  const coursesRes = await classroom.courses.list({ pageSize: 100 });
  const courses = coursesRes.data.courses || [];

  console.log(`[Classroom Sync] Ditemukan ${courses.length} kursus`);

  // Muat daftar siswa admin & cache sekali agar sinkronisasi cepat dan
  // hanya memproses kursus yang siswanya terdaftar di panel admin
  const matchMaps = await buildStudentMatchMaps();
  const cachedAll = await CourseworkCache.find({ ownerId: user._id }).lean();
  const cachedByKey = new Map();
  for (const c of cachedAll) {
    cachedByKey.set(`${c.classroomCourseId}:${c.classroomWorkId}`, c);
  }

  let synced = 0;
  let skipped = 0;
  const metadataUpdates = [];

  await mapWithConcurrency(courses, COURSE_CONCURRENCY, async (course) => {
    const alias = detectSubjectAlias(course.name);
    if (!alias) {
      console.log(`[Classroom Sync] Skipping kursus tanpa alias: ${course.name}`);
      return;
    }

    try {
      // Filter: cukup sinkron kursus yang siswanya cocok dengan data siswa admin.
      // Hanya submission milik siswa yang terdaftar di panel admin yang disimpan.
      const rosterRes = await apiWithRetry(() =>
        classroom.courses.students.list({
          courseId: course.id,
          pageSize: 100,
          fields: ROSTER_FIELDS,
        })
      );
      const roster = rosterRes.data.students || [];
      const rosterMatch = buildRosterMatchMap(roster, matchMaps);
      if (roster.length > 0 && rosterMatch.size === 0) {
        console.log(`[Classroom Sync] Skipping kursus tanpa siswa terdaftar di admin: ${course.name}`);
        skipped++;
        return;
      }
      const allowedStudentIds = new Set(rosterMatch.keys());

      console.log(`[Classroom Sync] Sinkron kursus: ${course.name} (${alias})`);

      const courseworkRes = await apiWithRetry(() =>
        classroom.courses.courseWork.list({
          courseId: course.id,
          orderBy: 'dueDate desc',
          pageSize: 100,
          fields: COURSEWORK_FIELDS,
        })
      );

      const courseworkList = courseworkRes.data.courseWork || [];

      await mapWithConcurrency(courseworkList, WORK_CONCURRENCY, async (work) => {
        const key = `${course.id}:${work.id}`;
        const cached = cachedByKey.get(key);

        const workUpdated = work.updateTime ? new Date(work.updateTime) : null;
        const cacheFresh = cached &&
          Array.isArray(cached.studentSubmissions) &&
          cached.studentSubmissions.length > 0 &&
          (!workUpdated || (cached.lastSyncedAt && cached.lastSyncedAt >= workUpdated)) &&
          (Date.now() - new Date(cached.lastSyncedAt).getTime()) < SUBMISSION_FRESH_MS;

        if (cacheFresh) {
          metadataUpdates.push({
            updateOne: {
              filter: { _id: cached._id },
              update: {
                $set: {
                  title: work.title,
                  description: work.description || '',
                  courseName: course.name,
                  courseAlias: alias,
                  dueDate: buildDueDate(work),
                  maxPoints: work.maxPoints || 100,
                },
              },
            },
          });
          return;
        }

        const { submissions, rawCount } = await getSubmissionsForWork(
          classroom,
          course.id,
          work.id,
          allowedStudentIds,
          rosterMatch
        );
        const safeSubmissions = rawCount === 0 && cached && Array.isArray(cached.studentSubmissions)
          ? cached.studentSubmissions
          : submissions;
        await upsertCoursework(user._id, course, alias, work, safeSubmissions);
      });

      synced++;
    } catch (err) {
      console.log(`[Classroom Sync] Error kursus ${course.name}: ${err.message}`);
    }
  });

  if (metadataUpdates.length > 0) {
    await CourseworkCache.bulkWrite(metadataUpdates);
  }

  console.log(`[Classroom Sync] Selesai. ${synced}/${courses.length} kursus berhasil, ${skipped} dilewati (tanpa siswa terdaftar).`);
  return { coursesFound: courses.length, synced, skipped };
}

async function syncCourseWork(classroom, course, alias, ownerId) {
  const courseworkRes = await classroom.courses.courseWork.list({
    courseId: course.id,
    orderBy: 'dueDate desc',
    pageSize: 100,
  });

  const courseworkList = courseworkRes.data.courseWork || [];

  await mapWithConcurrency(courseworkList, WORK_CONCURRENCY, async (work) => {
    const { submissions } = await getSubmissionsForWork(classroom, course.id, work.id);
    await upsertCoursework(ownerId, course, alias, work, submissions);
  });
}

async function getStudentSubmissions(studentId) {
  const student = await Student.findById(studentId);
  if (!student) return null;

  const classroomStudents = await Student.find({
    kelas: student.kelas,
    classroomId: { $exists: true, $ne: null },
  });

  const classroomStudent = classroomStudents.find(s => s._id.toString() === studentId.toString());

  const allCoursework = await CourseworkCache.find({
    'studentSubmissions.classroomStudentId': classroomStudent?.classroomId,
  }).sort({ lastSyncedAt: -1 });

  const deduped = [];
  const seen = new Set();
  for (const cw of allCoursework) {
    if (seen.has(cw.classroomWorkId)) continue;
    seen.add(cw.classroomWorkId);
    deduped.push(cw);
  }

  return deduped.map(cw => ({
    courseworkId: cw.classroomWorkId,
    title: cw.title,
    courseAlias: cw.courseAlias,
    dueDate: cw.dueDate,
    submission: cw.studentSubmissions.find(
      s => s.classroomStudentId === classroomStudent?.classroomId
    ),
  }));
}

async function getUnsubmittedForStudent(student) {
  const coursework = await CourseworkCache.find({
    'studentSubmissions.studentId': student._id,
  }).sort({ lastSyncedAt: -1 });

  const deduped = [];
  const seen = new Set();
  for (const cw of coursework) {
    if (seen.has(cw.classroomWorkId)) continue;
    seen.add(cw.classroomWorkId);
    deduped.push(cw);
  }

  const unsubmitted = [];
  for (const cw of deduped) {
    const sub = cw.studentSubmissions.find(
      s => s.studentId?.toString() === student._id.toString()
    );

    if (!sub || sub.state !== 'TURNED_IN') {
      unsubmitted.push({
        title: cw.title,
        courseAlias: cw.courseAlias,
        dueDate: cw.dueDate,
        isLate: sub?.late || false,
      });
    }
  }

  return unsubmitted;
}

async function findUnsubmittedWork() {
  const results = [];

  const students = await Student.find({ isActive: true });

  for (const student of students) {
    const unsubmitted = await getUnsubmittedForStudent(student);

    if (unsubmitted.length > 0) {
      results.push({
        studentId: student._id,
        nama: student.nama,
        nis: student.nis,
        kelas: student.kelas,
        unsubmitted,
      });
    }
  }

  return results;
}

module.exports = { getOAuth2Client, getAuthUrl, getTokensFromCode, syncAllCourses, getStudentSubmissions, findUnsubmittedWork, getUnsubmittedForStudent, mapWithConcurrency, apiWithRetry, buildStudentMatchMaps, buildRosterMatchMap, courseHasMatchingStudent, ROSTER_FIELDS, SCOPES };