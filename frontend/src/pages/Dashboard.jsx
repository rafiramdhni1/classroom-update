import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

const SUBJECT_LABELS = {
  ASJ: 'Administrasi Sistem Jaringan',
  AIJ: 'Administrasi Infrastruktur Jaringan',
  TJBL: 'Tata Jaringan Berbasis Luas',
  PKDK: 'Pemodelan dan Komunikasi Data',
  TJKT: 'Teknologi Jaringan Komputer dan Telekomunikasi',
};

export default function Dashboard() {
  const { user, student, logout } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedSubject, setExpandedSubject] = useState(null);
  const [rankMode, setRankMode] = useState('class');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const { data } = await api.get('/dashboard');
      setData(data);
    } catch (err) {
      setError('Gagal memuat data dashboard.');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (messageId) => {
    try {
      await api.put(`/dashboard/messages/${messageId}/read`);
      setData(prev => ({
        ...prev,
        messages: prev.messages.map(m =>
          m._id === messageId
            ? { ...m, isReadBy: [...(m.isReadBy || []), { studentId: user.student?.id, readAt: new Date() }] }
            : m
        ),
      }));
    } catch (err) {
      console.error('Gagal menandai pesan dibaca:', err);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    setPasswordLoading(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword: newPasswordInput });
      setPasswordSuccess('Password berhasil diubah!');
      setCurrentPassword('');
      setNewPasswordInput('');
      setTimeout(() => { setShowChangePassword(false); setPasswordSuccess(''); }, 2000);
    } catch (err) {
      setPasswordError(err.response?.data?.error || 'Gagal mengubah password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={fetchDashboard} className="text-primary-600 underline">Coba lagi</button>
        </div>
      </div>
    );
  }

  const rank = rankMode === 'class' ? data.classRank : data.angkatanRank;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-gradient-to-r from-primary-600 via-primary-700 to-primary-800 text-white shadow-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold truncate">{data.student?.nama}</h1>
            <p className="text-primary-100 text-xs sm:text-sm">{data.student?.kelas} • Angkatan {data.student?.angkatan}</p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 self-end sm:self-auto">
            <a
              href="/api/dashboard/export-csv"
              className="bg-white/15 hover:bg-white/25 active:scale-95 px-2.5 py-1.5 rounded-lg transition text-xs sm:text-sm font-medium flex items-center gap-1.5"
              title="Export Nilai CSV"
            >
              <span>📥</span>
              <span className="hidden md:inline">Export</span>
            </a>
            {data.adminContact && (
              <a
                href={data.adminContact}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white/15 hover:bg-white/25 active:scale-95 px-2.5 py-1.5 rounded-lg transition text-xs sm:text-sm font-medium flex items-center gap-1.5"
                title="Hubungi Admin"
              >
                <span>💬</span>
                <span className="hidden md:inline">Bantuan</span>
              </a>
            )}
            <button
              onClick={() => setShowChangePassword(true)}
              className="bg-white/15 hover:bg-white/25 active:scale-95 px-2.5 py-1.5 rounded-lg transition text-xs sm:text-sm font-medium flex items-center gap-1.5"
              title="Ganti Password"
            >
              <span>🔑</span>
              <span className="hidden md:inline">Password</span>
            </button>
            <button
              onClick={logout}
              className="bg-white/15 hover:bg-red-500/80 active:scale-95 px-2.5 py-1.5 rounded-lg transition text-xs sm:text-sm font-medium flex items-center gap-1.5"
              title="Logout"
            >
              <span>🚪</span>
              <span className="hidden md:inline">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Pesan dari Admin */}
        {data.messages && data.messages.length > 0 && (
          <section className="space-y-2.5">
            <h2 className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wider">Pesan dari Admin</h2>
            <div className="grid grid-cols-1 gap-3">
              {data.messages.map((msg) => {
                const isRead = msg.isReadBy?.some(r => r.studentId === user.student?.id);
                return (
                  <div
                    key={msg._id}
                    className={`rounded-xl p-4 shadow-sm border-l-4 transition cursor-pointer ${
                      msg.priority === 'urgent' ? 'bg-red-50 border-red-500' :
                      msg.priority === 'high' ? 'bg-orange-50 border-orange-500' :
                      'bg-white border-primary-500'
                    } ${!isRead ? 'ring-2 ring-primary-200' : ''} hover:shadow-md`}
                    onClick={() => !isRead && markAsRead(msg._id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-gray-800 text-sm sm:text-base">{msg.title}</h3>
                      {!isRead && <span className="bg-primary-500 text-white text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium shrink-0">Baru</span>}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1.5 whitespace-pre-line">{msg.content}</p>
                    <p className="text-[11px] text-gray-400 mt-2">
                      {new Date(msg.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Stats Grid: Ranking & Rata-rata */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Ranking */}
          <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-gray-100 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wider">Peringkat</h2>
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setRankMode('class')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                    rankMode === 'class' ? 'bg-primary-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Kelas
                </button>
                <button
                  onClick={() => setRankMode('angkatan')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                    rankMode === 'angkatan' ? 'bg-primary-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Angkatan
                </button>
              </div>
            </div>
            <div className="text-center py-2 sm:py-3">
              <div className="text-4xl sm:text-5xl font-extrabold text-primary-600 tracking-tight">{rank?.rank || '-'}</div>
              <div className="text-xs sm:text-sm text-gray-500 mt-1">dari <span className="font-semibold">{rank?.total || 0}</span> siswa</div>
            </div>
          </div>

          {/* Rata-rata */}
          <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-gray-100 flex flex-col justify-between text-center">
            <h2 className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 text-left">Rata-rata Nilai</h2>
            <div className="py-2 sm:py-3">
              <div className="text-4xl sm:text-5xl font-extrabold text-gray-800 tracking-tight">
                {data.overallAverage !== null ? data.overallAverage.toFixed(1) : '-'}
              </div>
              <div className="text-xs sm:text-sm text-gray-500 mt-1">Skala 0 - 100</div>
            </div>
          </div>
        </section>

        {/* Mata Pelajaran */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wider">Mata Pelajaran</h2>
            <span className="text-xs text-gray-400 font-medium">
              {Object.keys(data.subjectGrades || {}).length} Mapel
            </span>
          </div>

          <div className="space-y-2.5">
            {Object.entries(data.subjectGrades || {}).map(([alias, info]) => (
              <div
                key={alias}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition hover:border-gray-200"
              >
                <button
                  onClick={() => setExpandedSubject(expandedSubject === alias ? null : alias)}
                  className="w-full p-3.5 sm:p-4 flex items-center justify-between hover:bg-gray-50/80 transition text-left"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-sm sm:text-base font-bold text-white shrink-0 shadow-xs ${
                      info.average >= 80 ? 'bg-green-500' :
                      info.average >= 60 ? 'bg-yellow-500' :
                      info.average !== null ? 'bg-red-500' : 'bg-gray-400'
                    }`}>
                      {info.average !== null ? info.average.toFixed(0) : '-'}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-800 text-sm sm:text-base leading-tight">{alias}</h3>
                      <p className="text-xs text-gray-500 truncate mt-0.5 max-w-[180px] sm:max-w-md">{SUBJECT_LABELS[alias] || alias}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 sm:gap-4 shrink-0 text-right">
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md hidden sm:inline-block">
                      {info.gradedCount}/{info.totalAssignments} dinilai
                    </span>
                    <span className="text-xs text-gray-400 sm:hidden">
                      {info.gradedCount}/{info.totalAssignments}
                    </span>
                    <div className={`text-xs sm:text-sm font-medium transition-transform duration-200 ${
                      expandedSubject === alias ? 'rotate-180 text-primary-600' : 'text-gray-400'
                    }`}>
                      ▼
                    </div>
                  </div>
                </button>

                {expandedSubject === alias && (
                  <div className="border-t border-gray-100 bg-gray-50/50 p-3 sm:p-4 space-y-2">
                    {info.components.map((comp, idx) => (
                      <div
                        key={idx}
                        className="bg-white rounded-lg p-3 shadow-2xs border border-gray-100 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-medium text-gray-800 truncate">{comp.title}</p>
                          <p className="text-[11px] text-gray-400 capitalize mt-0.5">{comp.type?.toLowerCase()?.replace('_', ' ')}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          {comp.isGraded ? (
                            <span className={`inline-block px-2 py-0.5 rounded text-xs sm:text-sm font-bold ${
                              comp.score >= 80 ? 'bg-green-50 text-green-700' :
                              comp.score >= 60 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'
                            }`}>
                              {comp.score}
                            </span>
                          ) : (
                            <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                              Belum dinilai
                            </span>
                          )}
                        </div>
                      </div>
                    ))}

                    {info.components.length === 0 && (
                      <p className="text-xs sm:text-sm text-gray-400 text-center py-3">Belum ada tugas/ujian untuk mata pelajaran ini.</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      {showChangePassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-semibold text-gray-800">Ganti Password</h3>
            {passwordError && <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm">{passwordError}</div>}
            {passwordSuccess && <div className="bg-green-50 text-green-700 px-3 py-2 rounded-lg text-sm">{passwordSuccess}</div>}
            <form onSubmit={handleChangePassword} className="space-y-3">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Password saat ini"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                required
              />
              <input
                type="password"
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                placeholder="Password baru (min. 6 karakter)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                minLength={6}
                required
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowChangePassword(false)} className="flex-1 bg-gray-200 py-2 rounded-lg text-sm">Batal</button>
                <button type="submit" disabled={passwordLoading} className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm disabled:opacity-50">
                  {passwordLoading ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
