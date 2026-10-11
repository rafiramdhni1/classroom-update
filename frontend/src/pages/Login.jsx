import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '../utils/api';
import Icon from '../components/icons';

export default function Login() {
  const [nisn, setNisn] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotNisn, setForgotNisn] = useState('');
  const [forgotStep, setForgotStep] = useState(0);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [success, setSuccess] = useState('');

  const { login } = useAuth();
  const { isDark, toggle, setRole } = useTheme();
  const navigate = useNavigate();

  const parseError = (err, fallback) => {
    const errData = err.response?.data?.error;
    if (!errData) return fallback;
    if (typeof errData === 'string') {
      if (errData.trim().startsWith('[') || errData.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(errData);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map(p => p.message || p).join(', ');
          }
          if (parsed.message) return parsed.message;
        } catch {}
      }
      return errData;
    }
    return fallback;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(nisn, password);
      if (data?.user?.role) setRole(data.user.role);
      navigate(data?.user?.role === 'admin' || data?.user?.role === 'guru' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(parseError(err, 'Gagal login. Periksa NIS dan password.'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { nis: forgotNisn, nisn: forgotNisn });
      setSuccess('OTP berhasil dikirim ke Telegram Anda.');
      setForgotStep(1);
    } catch (err) {
      if (err.response?.data?.fallback) {
        setForgotStep(2);
        setError('');
      } else {
        setError(parseError(err, 'Gagal mengirim OTP.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFallbackVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const orangTuaNama = e.target.orangTuaNama?.value;
      await api.post('/auth/fallback-verify', { nis: forgotNisn, nisn: forgotNisn, orangTuaNama });
      setSuccess('Verifikasi berhasil. OTP dikirim ke Telegram.');
      setForgotStep(1);
    } catch (err) {
      setError(parseError(err, 'Verifikasi gagal.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/verify-otp', { nis: forgotNisn, nisn: forgotNisn, otp, newPassword });
      setSuccess('Password berhasil direset! Silakan login.');
      setShowForgot(false);
      setForgotStep(0);
      setForgotNisn('');
      setOtp('');
      setNewPassword('');
    } catch (err) {
      setError(parseError(err, 'Gagal reset password.'));
    } finally {
      setLoading(false);
    }
  };

  const field = 'input py-3';

  return (
    <div className="min-h-screen bg-bg lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Panel kiri: brand */}
      <div className="relative hidden overflow-hidden p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: 'linear-gradient(140deg, rgb(var(--hero-1)), rgb(var(--hero-2)) 78%)' }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(rgb(255 255 255 / 0.16) 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }}
        />
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-white/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-10 h-96 w-96 rounded-full blur-3xl" style={{ background: 'rgb(var(--hero-glow) / 0.45)' }} />
        <div className="pointer-events-none absolute right-24 top-1/3 h-40 w-40 rounded-full border border-white/25" />
        <div className="pointer-events-none absolute right-40 top-1/2 h-24 w-24 rounded-full border border-white/20" />

        <div className="relative flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.4)] ring-1 ring-white/30 backdrop-blur">
            <Icon name="book" className="h-6 w-6" strokeWidth={1.8} />
          </span>
          <div>
            <p className="font-display text-sm font-extrabold">SMK TKJ Akademik</p>
            <p className="text-xs text-white/75">Sistem Informasi Akademik</p>
          </div>
        </div>

        <div className="relative max-w-md animate-fadeUp">
          <p className="hero-eyebrow">Satu portal, tiga peran</p>
          <h1 className="mt-3 font-display text-4xl font-extrabold leading-tight">
            Nilai, peringkat, dan tugas dalam satu tempat.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/85">
            Terhubung langsung dengan Google Classroom dan notifikasi Telegram,
            sehingga siswa, guru, dan orang tua selalu mendapat informasi terbaru.
          </p>

          <div className="mt-8 grid gap-3">
            {[
              { ico: 'students', title: 'Siswa & Orang Tua', desc: 'Pantau nilai, peringkat, dan tugas harian.' },
              { ico: 'teachers', title: 'Guru', desc: 'Input nilai dan pantau progres per kelas.' },
              { ico: 'shield', title: 'Admin', desc: 'Kelola siswa, pesan, backup, dan monitoring.' },
            ].map(f => (
              <div
                key={f.title}
                className="flex items-start gap-3 rounded-2xl border border-white/25 bg-white/12 p-3.5 backdrop-blur-md transition hover:bg-white/20"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/25">
                  <Icon name={f.ico} className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-display text-sm font-bold">{f.title}</p>
                  <p className="text-xs text-white/75">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-white/60">© {new Date().getFullYear()} SMK TKJ • Sistem Akademik</p>
      </div>

      {/* Panel kanan: form */}
      <div className="flex min-h-screen flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white shadow-glow">
              <Icon name="book" className="h-5 w-5" />
            </span>
            <span className="font-display text-sm font-extrabold text-ink">SMK TKJ Akademik</span>
          </div>
          <span className="hidden text-xs font-semibold text-muted lg:block">Masuk ke akunmu</span>
          <button onClick={toggle} className="btn-ghost h-9 w-9 rounded-xl p-0" title="Ganti tema">
            <Icon name={isDark ? 'sun' : 'moon'} className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-sm animate-fadeUp">
            {!showForgot ? (
              <div className="card relative overflow-hidden p-6 sm:p-7">
                <span className="absolute left-0 right-0 top-0 h-1 bg-brand" />
                <div className="mb-5">
                  <p className="section-title">Selamat datang kembali</p>
                  <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-ink">Masuk</h2>
                  <p className="mt-1 text-xs text-muted">
                    Gunakan NIS untuk siswa, akhiran <code className="rounded bg-surface2 px-1 font-bold">-OT</code> untuk orang tua,
                    atau username untuk guru/admin.
                  </p>
                </div>

                {error && (
                  <div className="mb-4 rounded-xl border border-danger/35 bg-danger-soft px-4 py-3 text-sm text-danger-ink">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="mb-4 rounded-xl border border-success/35 bg-success-soft px-4 py-3 text-sm text-success-ink">
                    {success}
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="label">NIS / Username</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
                        <Icon name="user" className="h-4 w-4" />
                      </span>
                      <input
                        type="text"
                        value={nisn}
                        onChange={(e) => setNisn(e.target.value)}
                        className={`${field} pl-10`}
                        placeholder="240001 / admin"
                        autoComplete="username"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">Password</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
                        <Icon name="key" className="h-4 w-4" />
                      </span>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`${field} pl-10`}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        required
                      />
                    </div>
                  </div>

                  <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                    {loading ? 'Masuk...' : 'Masuk'}
                    {!loading && <Icon name="chevron" className="h-4 w-4" />}
                  </button>
                </form>

                <button
                  onClick={() => { setShowForgot(true); setError(''); setSuccess(''); setForgotStep(0); }}
                  className="mt-4 w-full text-center text-sm font-semibold text-accent hover:underline"
                >
                  Lupa password?
                </button>
              </div>
            ) : (
              <div className="card relative overflow-hidden p-6 sm:p-7">
                <span className="absolute left-0 right-0 top-0 h-1 bg-brand" />
                {forgotStep === 0 && (
                  <>
                    <p className="section-title">Pulihkan akses</p>
                    <h2 className="mt-1 font-display text-xl font-extrabold text-ink">Lupa Password</h2>
                    <p className="mb-4 mt-1 text-sm text-muted">Masukkan NIS atau NISN Anda untuk menerima OTP via Telegram.</p>
                    {error && <div className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-ink">{error}</div>}
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <input
                        type="text"
                        value={forgotNisn}
                        onChange={(e) => setForgotNisn(e.target.value)}
                        className="input py-3"
                        placeholder="Masukkan NIS / NISN"
                        required
                      />
                      <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                        {loading ? 'Mengirim...' : 'Kirim OTP'}
                      </button>
                    </form>
                    <div className="mt-4 border-t border-line/60 pt-3 text-center">
                      <p className="text-[11px] text-muted">Belum terhubung ke Telegram? Hubungi Admin:</p>
                      <div className="mt-1.5 flex flex-col gap-1 text-xs font-semibold">
                        <a
                          href="https://wa.me/6288233182147?text=Halo%20Admin%20Sekolah%2C%20saya%20memerlukan%20bantuan%20reset%20password%20akun%20saya"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1 text-accent hover:underline"
                        >
                          <Icon name="chat" className="h-3.5 w-3.5 text-success" />
                          <span>WhatsApp Admin 1 (0882-3318-2147)</span>
                        </a>
                        <a
                          href="https://wa.me/6285641408175?text=Halo%20Admin%20Sekolah%2C%20saya%20memerlukan%20bantuan%20reset%20password%20akun%20saya"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1 text-accent hover:underline"
                        >
                          <Icon name="chat" className="h-3.5 w-3.5 text-success" />
                          <span>WhatsApp Admin 2 (0856-4140-8175)</span>
                        </a>
                      </div>
                    </div>
                    <button
                      onClick={() => { setShowForgot(false); setError(''); setSuccess(''); }}
                      className="mt-3 w-full text-center text-xs font-semibold text-muted hover:text-ink"
                    >
                      ← Kembali ke login
                    </button>
                  </>
                )}

                {forgotStep === 1 && (
                  <>
                    <p className="section-title">Langkah 2</p>
                    <h2 className="mt-1 font-display text-xl font-extrabold text-ink">Masukkan OTP</h2>
                    <p className="mb-4 mt-1 text-sm text-muted">Kode OTP telah dikirim ke Telegram Anda.</p>
                    {error && <div className="mb-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-ink">{error}</div>}
                    {success && <div className="mb-3 rounded-xl bg-success-soft px-4 py-3 text-sm text-success-ink">{success}</div>}
                    <form onSubmit={handleResetPassword} className="space-y-4">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className="input py-3 text-center text-lg font-bold tracking-[0.5em]"
                        placeholder="000000"
                        maxLength={6}
                        required
                      />
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="input py-3"
                        placeholder="Password baru (min. 6 karakter)"
                        required
                      />
                      <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                        {loading ? 'Memproses...' : 'Reset Password'}
                      </button>
                    </form>
                  </>
                )}

                {forgotStep === 2 && (
                  <>
                    <p className="section-title">Verifikasi cadangan</p>
                    <h2 className="mt-1 font-display text-xl font-extrabold text-ink">Verifikasi Identitas</h2>
                    <p className="mb-4 mt-1 text-sm text-muted">Lengkapi data berikut untuk verifikasi.</p>
                    {error && <div className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-ink">{error}</div>}
                    <form onSubmit={handleFallbackVerify} className="space-y-4">
                      <div>
                        <label className="label">Nama Orang Tua</label>
                        <input
                          type="text"
                          name="orangTuaNama"
                          className="input py-3"
                          placeholder="Nama lengkap orang tua"
                          required
                        />
                      </div>
                      <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                        {loading ? 'Memverifikasi...' : 'Verifikasi'}
                      </button>
                    </form>
                    <button
                      onClick={() => { setForgotStep(0); setError(''); }}
                      className="mt-4 w-full text-center text-sm font-semibold text-muted hover:text-ink"
                    >
                      ← Kembali
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              {[
                { role: 'Siswa', hint: 'NIS', ico: 'students' },
                { role: 'Orang Tua', hint: 'NIS-OT', ico: 'user' },
                { role: 'Guru/Admin', hint: 'username', ico: 'shield' },
              ].map(r => (
                <div key={r.role} className="row-card rounded-xl py-2.5 text-center">
                  <Icon name={r.ico} className="mx-auto h-4 w-4 text-accent" />
                  <p className="mt-1 text-[11px] font-bold text-ink">{r.role}</p>
                  <p className="text-[10px] text-muted">{r.hint}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-2 text-center text-xs text-muted">
          <p>Lupa akun atau butuh bantuan reset password?</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <a
              href="https://wa.me/6288233182147?text=Halo%20Admin%20Sekolah%2C%20saya%20memerlukan%20bantuan%20terkait%20akun%20Sistem%20Akademik"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface2 px-3 py-1.5 text-xs font-semibold text-accent transition hover:border-accent hover:bg-accent/10"
            >
              <Icon name="chat" className="h-3.5 w-3.5 text-success" />
              <span>Admin 1: 0882-3318-2147</span>
            </a>
            <a
              href="https://wa.me/6285641408175?text=Halo%20Admin%20Sekolah%2C%20saya%20memerlukan%20bantuan%20terkait%20akun%20Sistem%20Akademik"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface2 px-3 py-1.5 text-xs font-semibold text-accent transition hover:border-accent hover:bg-accent/10"
            >
              <Icon name="chat" className="h-3.5 w-3.5 text-success" />
              <span>Admin 2: 0856-4140-8175</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
