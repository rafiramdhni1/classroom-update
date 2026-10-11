import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Card, Button, Badge, LoadingBlock, Banner } from './ui';
import Icon from './icons';

export function PushNotificationSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [vapidKey, setVapidKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    async function init() {
      try {
        const res = await api.get('/dashboard/push/vapid-key');
        setVapidKey(res.data.publicKey);
      } catch (err) {
        console.error('Failed to fetch VAPID key:', err);
      }
      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        setSubscription(sub);
      });
    });
  }, []);

  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribe = async () => {
    if (!vapidKey) return;
    setSaving(true);
    setMessage(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      await api.post('/dashboard/push/subscribe', { subscription: sub.toJSON() });
      setSubscription(sub);
      setMessage({ type: 'success', text: 'Berlangganan notifikasi berhasil!' });
    } catch (err) {
      console.error('Subscribe error:', err);
      setMessage({ type: 'error', text: err.response?.data?.error || 'Gagal berlangganan notifikasi.' });
    } finally {
      setSaving(false);
    }
  };

  const unsubscribe = async () => {
    if (!subscription) return;
    setSaving(true);
    setMessage(null);
    try {
      await subscription.unsubscribe();
      await api.delete('/dashboard/push/unsubscribe', { data: { endpoint: subscription.endpoint } });
      setSubscription(null);
      setMessage({ type: 'success', text: 'Berhenti berlangganan notifikasi.' });
    } catch (err) {
      console.error('Unsubscribe error:', err);
      setMessage({ type: 'error', text: 'Gagal berhenti berlangganan.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingBlock label="Memuat notifikasi..." />;

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return (
      <Card title="Notifikasi Push" pad={false}>
        <Banner tone="warn">
          Browser Anda tidak mendukung notifikasi push. Gunakan browser modern (Chrome, Firefox, Edge) untuk mengaktifkan fitur ini.
        </Banner>
      </Card>
    );
  }

  return (
    <Card title="Notifikasi Push (HP/Web)">
      {message && <Banner tone={message.type} onClose={() => setMessage(null)}>{message.text}</Banner>}

      <div className="space-y-4">
        <div className="rounded-xl border border-line/80 bg-surface2/70 p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
              <Icon name="bell" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-ink">Notifikasi Tugas Otomatis</p>
              <p className="text-sm text-muted mt-0.5">
                Terima notifikasi di HP/komputer setiap hari untuk tugas yang belum dikumpulkan.
                Notifikasi muncul tanpa perlu buka Telegram.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-medium text-ink">Status</p>
            <p className="text-sm text-muted">
              {subscription ? 'Aktif - Notifikasi akan dikirim' : 'Tidak aktif'}
            </p>
          </div>
          {subscription ? (
            <Button variant="danger" onClick={unsubscribe} disabled={saving}>
              {saving ? 'Memproses...' : 'Matikan Notifikasi'}
            </Button>
          ) : (
            <Button variant="primary" onClick={subscribe} disabled={saving || !vapidKey}>
              {saving ? 'Memproses...' : 'Aktifkan Notifikasi'}
            </Button>
          )}
        </div>

        {subscription && (
          <details className="text-xs text-muted">
            <summary className="cursor-pointer mb-1">Detail subscription</summary>
            <pre className="bg-surface p-2 rounded overflow-auto">{JSON.stringify(subscription.toJSON(), null, 2)}</pre>
          </details>
        )}
      </div>
    </Card>
  );
}

export default PushNotificationSubscription;