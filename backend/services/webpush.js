const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@smktkj.sch.id';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

async function subscribeStudent(studentId, subscription, userAgent = '') {
  try {
    const existing = await PushSubscription.findOne({ endpoint: subscription.endpoint });
    if (existing) {
      existing.studentId = studentId;
      existing.keys = subscription.keys;
      existing.userAgent = userAgent;
      existing.isActive = true;
      existing.lastUsed = new Date();
      await existing.save();
      return existing;
    }

    const sub = await PushSubscription.create({
      studentId,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      userAgent,
      isActive: true,
    });
    return sub;
  } catch (error) {
    console.error('[WebPush] Subscribe error:', error.message);
    throw error;
  }
}

async function unsubscribeStudent(studentId, endpoint) {
  try {
    await PushSubscription.updateOne(
      { studentId, endpoint },
      { $set: { isActive: false } }
    );
  } catch (error) {
    console.error('[WebPush] Unsubscribe error:', error.message);
    throw error;
  }
}

async function getActiveSubscriptions(studentId) {
  return PushSubscription.find({ studentId, isActive: true });
}

function createNotificationPayload(data) {
  return JSON.stringify({
    title: data.title || 'Sistem Akademik SMK TKJ',
    body: data.body || 'Anda memiliki tugas yang belum dikumpulkan.',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: {
      url: data.url || '/dashboard',
      taskCount: data.taskCount || 0,
      ...data,
    },
    actions: [
      { action: 'open', title: 'Buka Dashboard' },
      { action: 'dismiss', title: 'Tutup' },
    ],
    requireInteraction: true,
    tag: 'missing-tasks',
    renotify: true,
  });
}

async function sendPushNotification(subscription, payload) {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      payload
    );
    await PushSubscription.updateOne(
      { _id: subscription._id },
      { $set: { lastUsed: new Date() } }
    );
    return { success: true };
  } catch (error) {
    if (error.statusCode === 410 || error.statusCode === 404) {
      await PushSubscription.updateOne(
        { _id: subscription._id },
        { $set: { isActive: false } }
      );
      console.log('[WebPush] Subscription expired, marked inactive');
    }
    console.error('[WebPush] Send error:', error.message);
    return { success: false, error: error.message };
  }
}

async function sendMissingTasksNotification(studentId, missingTasks) {
  const subs = await getActiveSubscriptions(studentId);
  if (subs.length === 0) return { sent: 0, failed: 0 };

  const overdue = missingTasks.filter(t => t.overdue).length;
  const dueSoon = missingTasks.filter(t => !t.overdue && t.daysUntilDue !== null && t.daysUntilDue <= 3).length;
  const total = missingTasks.length;

  let body;
  if (overdue > 0 && dueSoon > 0) {
    body = `${overdue} tugas terlambat & ${dueSoon} tugas tenggat ≤ 3 hari. Total: ${total} tugas.`;
  } else if (overdue > 0) {
    body = `${overdue} tugas terlambat & ${total - overdue} tugas belum dikumpulkan.`;
  } else {
    body = `${total} tugas belum dikumpulkan (${dueSoon} tenggat ≤ 3 hari).`;
  }

  const payload = createNotificationPayload({
    title: '⏰ Tugas Belum Dikumpulkan',
    body,
    url: '/dashboard?tab=tugas',
    taskCount: total,
    overdue,
    dueSoon,
  });

  let sent = 0, failed = 0;
  for (const sub of subs) {
    const result = await sendPushNotification(sub, payload);
    if (result.success) sent++; else failed++;
  }
  return { sent, failed };
}

async function sendNotificationToAll(missingTasksMap) {
  let totalSent = 0, totalFailed = 0;
  for (const [studentId, tasks] of Object.entries(missingTasksMap)) {
    if (tasks.length > 0) {
      const result = await sendMissingTasksNotification(studentId, tasks);
      totalSent += result.sent;
      totalFailed += result.failed;
    }
  }
  return { sent: totalSent, failed: totalFailed };
}

module.exports = {
  subscribeStudent,
  unsubscribeStudent,
  getActiveSubscriptions,
  sendPushNotification,
  sendMissingTasksNotification,
  sendNotificationToAll,
  VAPID_PUBLIC_KEY,
};