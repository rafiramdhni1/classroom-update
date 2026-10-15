import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useStaff } from './staffStore';
import api from '../../utils/api';
import toast from '../../components/Toaster';
import { Card, PageHeader, Field, Banner, Avatar, LoadingBlock } from '../../components/ui';
import Icon from '../../components/icons';

export default function AccountMenu() {
  const { user: authUser, updateUser } = useAuth();
  const { user: staffUser } = useStaff();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  // Form Username & Nama
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [userCurrentPassword, setUserCurrentPassword] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [userMsg, setUserMsg] = useState(null);

  // Form Password
  const [pwdCurrentPassword, setPwdCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwdCurrent, setShowPwdCurrent] = useState(false);
  const [showPwdNew, setShowPwdNew] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [pwdMsg, setPwdMsg] = useState(null);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/profile');
      if (res.data?.user) {
        setProfile(res.data.user);
        setUsername(res.data.user.nisn || '');
        setName(res.data.user.name || '');
      }
    } catch (err) {
      console.warn('Gagal memuat profil admin:', err);
      // Fallback ke data auth user
      const u = staffUser || authUser;
      if (u) {
        setUsername(u.nisn || '');
        setName(u.name || u.nisn || '');
        setProfile({
          id: u.id,
          nis: u.nis,
          nisn: u.nisn,
          name: u.name || u.nisn,
          role: u.role,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleUpdateUsername = async (e) => {
    e.preventDefault();
    setUserMsg(null);

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setUserMsg({ tone: 'danger', text: 'Username login tidak boleh kosong.' });
      return;
    }
    if (cleanUsername.length < 3) {
      setUserMsg({ tone: 'danger', text: 'Username minimal 3 karakter.' });
      return;
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
      setUserMsg({ tone: 'danger', text: 'Username hanya boleh berisi huruf, angka, titik, strip, atau underscore.' });
      return;
    }
    if (!userCurrentPassword) {
      setUserMsg({ tone: 'danger', text: 'Masukkan password saat ini untuk konfirmasi keamanan.' });
      return;
    }

    setSavingUsername(true);
    try {
      const res = await api.put('/admin/profile', {
        username: cleanUsername,
        name: name.trim(),
        currentPassword: userCurrentPassword,
      });

      const updated = res.data.user;
      setProfile(prev => ({ ...prev, ...updated }));
      if (updateUser) {
        updateUser({ nisn: updated.nisn, name: updated.name, nis: updated.nis });
      }

      setUserCurrentPassword('');
      const successText = 'Username login dan nama admin berhasil diperbarui.';
      setUserMsg({ tone: 'success', text: successText });
      toast.success(successText);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Gagal memperbarui profil admin.';
      setUserMsg({ tone: 'danger', text: errorMsg });
      toast.error(errorMsg);
    } finally {
      setSavingUsername(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPwdMsg(null);

    if (!pwdCurrentPassword) {
      setPwdMsg({ tone: 'danger', text: 'Password saat ini harus diisi.' });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPwdMsg({ tone: 'danger', text: 'Password baru minimal 6 karakter.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdMsg({ tone: 'danger', text: 'Konfirmasi password tidak cocok dengan password baru.' });
      return;
    }

    setSavingPassword(true);
    try {
      const res = await api.put('/admin/profile', {
        currentPassword: pwdCurrentPassword,
        newPassword: newPassword,
      });

      setPwdCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      const successText = 'Password admin berhasil diubah! Gunakan password baru saat login berikutnya.';
      setPwdMsg({ tone: 'success', text: successText });
      toast.success(successText);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Gagal mengubah password admin.';
      setPwdMsg({ tone: 'danger', text: errorMsg });
      toast.error(errorMsg);
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading && !profile) {
    return <LoadingBlock label="Memuat pengaturan akun..." hint="Mengambil kredensial login admin" />;
  }

  const currentName = profile?.name || profile?.nisn || 'Administrator';
  const currentUsername = profile?.nisn || '-';
  const roleName = profile?.role === 'admin' ? 'Administrator' : profile?.role === 'guru' ? 'Guru' : profile?.role;

  return (
    <div className="space-y-6 animate-fadeUp">
      <PageHeader
        eyebrow="Sistem & Keamanan"
        title="Pengaturan Akun Admin"
        subtitle="Kelola username login dan kata sandi untuk akun administrator Anda."
      />

      {/* Info Akun Saat Ini */}
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar name={currentName} className="h-16 w-16 text-xl bg-accent text-white" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-ink truncate">{currentName}</h2>
              <span className="badge-accent uppercase tracking-wider text-[10px] font-extrabold">{roleName}</span>
              {profile?.hasGoogleAuth && (
                <span className="badge-success text-[10px] flex items-center gap-1">
                  <Icon name="check" className="h-3 w-3" />
                  Google Terhubung
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>Username Login saat ini: <strong className="font-mono text-ink">{currentUsername}</strong></span>
              {profile?.googleEmail && (
                <span>Email Google: <strong className="text-ink">{profile.googleEmail}</strong></span>
              )}
              {profile?.lastLogin && (
                <span>Login Terakhir: {new Date(profile.lastLogin).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              )}
            </p>
          </div>
        </div>
      </Card>

      {/* Grid 2 Form: Edit Username & Edit Password */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form 1: Ubah Username & Profil */}
        <Card title="Ubah Username Login & Nama">
          {userMsg && (
            <div className="mb-4">
              <Banner tone={userMsg.tone} onClose={() => setUserMsg(null)}>
                {userMsg.text}
              </Banner>
            </div>
          )}

          <form onSubmit={handleUpdateUsername} className="space-y-4">
            <Field
              label="Username Login"
              hint="Digunakan saat login ke panel admin. Minimal 3 karakter (huruf, angka, ., -, _)."
            >
              <input
                type="text"
                className="input font-mono"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="misal: admin, admin_tkj, superadmin"
                required
              />
            </Field>

            <Field
              label="Nama Tampilan (Display Name)"
              hint="Nama yang ditampilkan di dashboard dan kartu profil."
            >
              <input
                type="text"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="misal: Administrator Utama"
              />
            </Field>

            <div className="pt-2 border-t border-line/70">
              <Field
                label="Konfirmasi Password Saat Ini"
                hint="Masukkan password akun Anda saat ini untuk mengizinkan perubahan username."
              >
                <input
                  type="password"
                  className="input"
                  value={userCurrentPassword}
                  onChange={(e) => setUserCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </Field>
            </div>

            <button
              type="submit"
              disabled={savingUsername}
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
            >
              <Icon name="edit" className="h-4 w-4" />
              {savingUsername ? 'Menyimpan Perubahan...' : 'Simpan Username Baru'}
            </button>
          </form>
        </Card>

        {/* Form 2: Ganti Password */}
        <Card title="Ganti Password Login">
          {pwdMsg && (
            <div className="mb-4">
              <Banner tone={pwdMsg.tone} onClose={() => setPwdMsg(null)}>
                {pwdMsg.text}
              </Banner>
            </div>
          )}

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <Field label="Password Saat Ini" hint="Password lama yang sedang aktif.">
              <div className="relative">
                <input
                  type={showPwdCurrent ? 'text' : 'password'}
                  className="input pr-10"
                  value={pwdCurrentPassword}
                  onChange={(e) => setPwdCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwdCurrent(!showPwdCurrent)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-1"
                  tabIndex={-1}
                >
                  <Icon name="eye" className="h-4 w-4" />
                </button>
              </div>
            </Field>

            <Field label="Password Baru" hint="Minimal 6 karakter. Kombinasi huruf dan angka disarankan.">
              <div className="relative">
                <input
                  type={showPwdNew ? 'text' : 'password'}
                  className="input pr-10"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwdNew(!showPwdNew)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-1"
                  tabIndex={-1}
                >
                  <Icon name="eye" className="h-4 w-4" />
                </button>
              </div>
            </Field>

            <Field
              label="Konfirmasi Password Baru"
              hint={
                confirmPassword && newPassword !== confirmPassword
                  ? '⚠️ Password konfirmasi tidak cocok!'
                  : 'Ketik ulang password baru.'
              }
            >
              <input
                type="password"
                className={`input ${confirmPassword && newPassword !== confirmPassword ? 'border-danger focus:border-danger' : ''}`}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                required
              />
            </Field>

            <button
              type="submit"
              disabled={savingPassword}
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
            >
              <Icon name="key" className="h-4 w-4" />
              {savingPassword ? 'Memperbarui Password...' : 'Simpan Password Baru'}
            </button>
          </form>
        </Card>
      </div>

      {/* Catatan Keamanan */}
      <div className="rounded-2xl border border-line bg-surface p-4 text-xs text-muted flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <Icon name="shield" className="h-4 w-4" />
        </span>
        <div className="space-y-1">
          <p className="font-semibold text-ink">Catatan Penting Keamanan Akun</p>
          <p>
            Pastikan Anda mengingat username dan kata sandi baru Anda. Setelah diperbarui, Anda dapat langsung menggunakannya pada halaman login berikutnya. Jangan membagikan informasi login administrator kepada pihak yang tidak berwenang.
          </p>
        </div>
      </div>
    </div>
  );
}
