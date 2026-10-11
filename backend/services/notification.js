const ChatId = require('../models/ChatId');
const Student = require('../models/Student');
const PushSubscription = require('../models/PushSubscription');
const { findUnsubmittedWork } = require('./classroom');
const { sendTelegramMessageWithButton } = require('./telegram');
const { sendMissingTasksNotification, sendNotificationToAll } = require('./webpush');

const DASHBOARD_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const PUSH_INTERVAL_DAYS = parseInt(process.env.PUSH_INTERVAL_DAYS, 10) || 1;
const PUSH_MIN_TASKS = parseInt(process.env.PUSH_MIN_TASKS, 10) || 1;

async function getStudentsNeedingPushNotification() {
  const now = new Date();
  const cutoffHours = PUSH_INTERVAL_DAYS <= 1 ? 20 : PUSH_INTERVAL_DAYS * 24;
  const cutoff = new Date(now.getTime() - cutoffHours * 60 * 60 * 1000);

  const students = await Student.find({ isActive: true }).lean();

  const result = [];
  for (const student of students) {
    const lastSent = await PushSubscription.findOne({
      studentId: student._id,
      lastUsed: { $exists: true, $ne: null },
    }).sort({ lastUsed: -1 }).select('lastUsed').lean();

    if (!lastSent || lastSent.lastUsed < cutoff) {
      result.push(student);
    }
  }

  return result;
}

async function sendPeriodicPushNotifications() {
  console.log('[Push Notifikasi] Mulai cek notifikasi periodik...');

  const students = await getStudentsNeedingPushNotification();

  if (students.length === 0) {
    console.log('[Push Notifikasi] Tidak ada siswa yang butuh notifikasi push.');
    return;
  }

  console.log(`[Push Notifikasi] Ditemukan ${students.length} siswa butuh notifikasi push.`);

  const missingTasksMap = {};

  for (const student of students) {
    const unsubmitted = await findUnsubmittedWorkForStudent(student._id);

    if (unsubmitted.length >= PUSH_MIN_TASKS) {
      missingTasksMap[student._id.toString()] = unsubmitted;
    }
  }

  if (Object.keys(missingTasksMap).length === 0) {
    console.log('[Push Notifikasi] Tidak ada siswa dengan tugas kurang cukup untuk notifikasi.');
    return;
  }

  const result = await sendNotificationToAll(missingTasksMap);

  console.log(`[Push Notifikasi] Selesai. Terkirim: ${result.sent}, Gagal: ${result.failed}`);
}

async function findUnsubmittedWorkForStudent(studentId) {
  const coursework = await require('../models/CourseworkCache').find({
    'studentSubmissions.studentId': studentId,
  }).sort({ lastSyncedAt: -1 });

  const seen = new Set();
  const deduped = [];
  for (const cw of coursework) {
    if (seen.has(cw.classroomWorkId)) continue;
    seen.add(cw.classroomWorkId);
    deduped.push(cw);
  }

  const now = new Date();
  const unsubmitted = [];

  for (const cw of deduped) {
    const sub = cw.studentSubmissions.find(
      s => s.studentId?.toString() === studentId.toString()
    );

    const isSubmitted = sub && ['TURNED_IN', 'RETURNED'].includes(sub.state);

    if (!isSubmitted) {
      const dueDate = cw.dueDate ? new Date(cw.dueDate) : null;
      const isOverdue = dueDate && dueDate < now;
      const daysUntilDue = dueDate ? Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24)) : null;

      unsubmitted.push({
        title: cw.title,
        courseAlias: cw.courseAlias,
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

  return unsubmitted;
}

async function sendDailyNotifications() {
  console.log('[Notifikasi] Mulai cek tugas kurang...');

  const unsubmitted = await findUnsubmittedWork();

  if (unsubmitted.length === 0) {
    console.log('[Notifikasi] Semua siswa sudah mengumpulkan tugas.');
    return;
  }

  console.log(`[Notifikasi] Ditemukan ${unsubmitted.length} siswa dengan tugas kurang.`);

  for (const entry of unsubmitted) {
    const chatIds = await ChatId.find({ studentId: entry.studentId, isActive: true });

    if (chatIds.length === 0) {
      console.log(`[Notifikasi] Tidak ada chatId aktif untuk ${entry.nama}`);
      continue;
    }

    const message = formatNotification(entry);

    const dashboardUrl = `${DASHBOARD_URL}/login?nis=${entry.nis}`;

    for (const chat of chatIds) {
      try {
        await sendTelegramMessageWithButton(chat.chatId, message, '📊 Buka Dashboard', dashboardUrl);
        console.log(`[Notifikasi] Terkirim ke ${entry.nama} (${chat.chatType})`);
      } catch (error) {
        console.error(`[Notifikasi] Gagal kirim ke chatId ${chat.chatId}:`, error.message);
      }
    }
  }

  console.log('[Notifikasi] Selesai.');
}

function formatNotification(entry) {
  const grouped = {};
  for (const item of entry.unsubmitted) {
    if (!grouped[item.courseAlias]) {
      grouped[item.courseAlias] = [];
    }
    grouped[item.courseAlias].push(item);
  }

  const totalTasks = entry.unsubmitted.length;

  let text = `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📋 TUGAS BELUM DIKUMPULKAN\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
  text += `👤 Siswa: ${entry.nama}\n`;
  text += `🏫 Kelas: ${entry.kelas}\n`;
  text += `📝 Total kurang: ${totalTasks} tugas\n\n`;

  for (const [subject, items] of Object.entries(grouped)) {
    text += `📚 ${subject}:\n`;
    for (const item of items) {
      const dueStr = item.dueDate
        ? `⏰ ${new Date(item.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}`
        : '⏰ Tidak ada tenggat';
      const status = item.isLate ? ' ⚠️ TERLAMBAT' : '';
      text += `  ▸ ${item.title} ${dueStr}${status}\n`;
    }
    text += '\n';
  }

  text += `💡 Login dengan NIS: ${entry.nis}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `Sistem Akademik SMK TKJ`;

  return text;
}

module.exports = { sendDailyNotifications, formatNotification, sendPeriodicPushNotifications, findUnsubmittedWorkForStudent };
