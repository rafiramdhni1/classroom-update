import { useState } from 'react';
import { useStudent } from './studentStore';
import { useTheme } from '../../contexts/ThemeContext';
import { Card, Avatar, Banner, Field, EmptyState, PageHeader } from '../../components/ui';
import { PushNotificationSubscription } from '../../components/PushNotificationSubscription';
import Icon from '../../components/icons';

export default function ProfilMenu() {
  const { user, student, changePassword, adminContact, logout, data } = useStudent();
  const { isDark, toggle, mode } = useTheme();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      await changePassword(cur, next);
      setMsg({ tone: 'success', text: 'Password berhasil diubah. Gunakan password baru saat login berikutnya.' });
      setCur('');
      setNext('');
    } catch (err) {
      setMsg({ tone: 'danger', text: err.response?.data?.error || 'Gagal mengubah password.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 animate-fadeUp">
      <PageHeader
        eyebrow="Akun siswa"
        title="Profil & Akun"
        subtitle="Data diri, keamanan akun, dan pengaturan tampilan."
      />

      <Card>
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <Avatar name={student?.nama || user?.nisn || '?'} className="h-20 w-20 text-2xl" />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-extrabold text-ink">{student?.nama || user?.nisn}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="badge-accent">NIS {student?.nis || user?.nis || user?.nisn || '-'}</span>
              {student?.nisn && student?.nisn !== student?.nis && (
                <span className="badge-neutral">NISN {student.nisn}</span>
              )}
              <span className="badge-neutral">{student?.kelas || 'Siswa'}</span>
              <span className="badge-neutral">Angkatan {student?.angkatan || '-'}</span>
              <span className="badge-success">{user?.role === 'parent' ? 'Orang Tua' : 'Siswa'}</span>
            </div>
            <p className="mt-2 text-xs text-muted">
              Rata-rata nilai:{' '}
              <span className="font-bold text-ink">
                {data?.overallAverage != null ? data.overallAverage.toFixed(1) : 'belum ada'}
              </span>{' '}
              • Peringkat kelas <span className="font-bold text-ink">{data?.classRank?.rank || '-'}</span>
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Ganti Password">
          {msg && <div className="mb-3"><Banner tone={msg.tone} onClose={() => setMsg(null)}>{msg.text}</Banner></div>}
          <form onSubmit={submit} className="space-y-3">
            <Field label="Password saat ini">
              <input
                type="password"
                className="input"
                value={cur}
                onChange={e => setCur(e.target.value)}
                placeholder="••••••••"
                required
              />
            </Field>
            <Field label="Password baru" hint="Minimal 6 karakter.">
              <input
                type="password"
                className="input"
                value={next}
                onChange={e => setNext(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                required
              />
            </Field>
            <button className="btn-primary w-full" disabled={busy}>
              <Icon name="key" className="h-4 w-4" />
              {busy ? 'Menyimpan...' : 'Simpan Password'}
            </button>
          </form>
        </Card>

        <div className="space-y-4">
          <Card title="Tampilan">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line/80 bg-surface2/70 p-3">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-soft text-accent">
                  <Icon name={isDark ? 'moon' : 'sun'} className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-ink">Mode {isDark ? 'Gelap' : 'Terang'}</p>
                  <p className="text-[11px] text-muted">Sedang aktif: {mode}</p>
                </div>
              </div>
              <button onClick={toggle} className={isDark ? 'btn-primary px-3 py-1.5 text-xs' : 'btn-ghost px-3 py-1.5 text-xs'}>
                {isDark ? 'Pakai terang' : 'Pakai gelap'}
              </button>
            </div>
          </Card>

          <Card title="Data & Bantuan">
            <div className="space-y-2">
              <a
                href="https://wa.me/6288233182147?text=Halo%20Admin%2C%20saya%20ingin%20bertanya%20tentang%20sistem%20akademik."
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost w-full justify-start text-xs font-semibold"
              >
                <Icon name="messages" className="h-4 w-4 text-success" />
                Chat WhatsApp Admin 1 (0882-3318-2147)
              </a>
              <a
                href="https://wa.me/6285641408175?text=Halo%20Admin%2C%20saya%20ingin%20bertanya%20tentang%20sistem%20akademik."
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost w-full justify-start text-xs font-semibold"
              >
                <Icon name="messages" className="h-4 w-4 text-success" />
                Chat WhatsApp Admin 2 (0856-4140-8175)
              </a>
              <button onClick={logout} className="btn-danger w-full justify-start">
                <Icon name="logout" className="h-4 w-4" />
                Keluar dari akun
              </button>
            </div>
          </Card>

          <PushNotificationSubscription />
        </div>
      </div>

      {!student && (
        <EmptyState icon="user" title="Data siswa belum terhubung" desc="Akun ini tidak terikat pada data siswa." />
      )}
    </div>
  );
}
