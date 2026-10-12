import { useState, useEffect } from 'react';
import { useStaff } from './staffStore';
import api from '../../utils/api';
import Icon from '../../components/icons';

const PRIORITY_BADGES = {
  urgent: { label: 'Mendesak', cls: 'bg-rose-500/15 text-rose-400 border border-rose-500/30' },
  high: { label: 'Penting', cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
  normal: { label: 'Normal', cls: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30' },
  low: { label: 'Rendah', cls: 'bg-slate-700/50 text-slate-400 border border-slate-600/30' },
};

export default function MessagesMenu() {
  const {
    KELAS_LIST,
    deleteMessage,
    handleSendMessage,
    messageForm,
    messageSuccess,
    messages,
    setMessageForm,
    user,
  } = useStaff();

  const [targetType, setTargetType] = useState(messageForm.targetType || 'all');
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentFilterKelas, setStudentFilterKelas] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch lightweight student list for selector
  useEffect(() => {
    let isMounted = true;
    async function fetchStudents() {
      setLoadingStudents(true);
      try {
        const { data } = await api.get('/admin/students-selector');
        if (isMounted) {
          setStudents(data.students || []);
        }
      } catch (err) {
        console.warn('Gagal mengambil daftar siswa:', err);
      } finally {
        if (isMounted) setLoadingStudents(false);
      }
    }
    fetchStudents();
    return () => { isMounted = false; };
  }, []);

  const handleTargetTypeChange = (type) => {
    setTargetType(type);
    if (type === 'all') {
      setMessageForm(prev => ({
        ...prev,
        targetType: 'all',
        isGlobal: true,
        targetKelas: [],
        targetStudents: [],
      }));
      setSelectedStudent(null);
    } else if (type === 'kelas') {
      setMessageForm(prev => ({
        ...prev,
        targetType: 'kelas',
        isGlobal: false,
        targetKelas: prev.targetKelas.length ? prev.targetKelas : ['X-TKJ1'],
        targetStudents: [],
      }));
      setSelectedStudent(null);
    } else if (type === 'student') {
      setMessageForm(prev => ({
        ...prev,
        targetType: 'student',
        isGlobal: false,
        targetKelas: [],
        targetStudents: selectedStudent ? [selectedStudent._id] : [],
      }));
    }
  };

  const handleSelectStudent = (s) => {
    setSelectedStudent(s);
    setMessageForm(prev => ({
      ...prev,
      targetType: 'student',
      isGlobal: false,
      targetKelas: [],
      targetStudents: [s._id],
    }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (targetType === 'kelas' && (!messageForm.targetKelas || messageForm.targetKelas.length === 0)) {
      alert('Pilih minimal satu kelas tujuan!');
      return;
    }
    if (targetType === 'student' && (!messageForm.targetStudents || messageForm.targetStudents.length === 0)) {
      alert('Pilih satu siswa penerima pesan!');
      return;
    }

    setSubmitting(true);
    const ok = await handleSendMessage(e);
    setSubmitting(false);
    if (ok) {
      setSelectedStudent(null);
      setTargetType('all');
    }
  };

  const filteredStudents = students.filter(s => {
    if (studentFilterKelas && s.kelas !== studentFilterKelas) return false;
    if (studentSearch) {
      const q = studentSearch.toLowerCase();
      const matchNama = s.nama?.toLowerCase().includes(q);
      const matchNis = s.nis?.toLowerCase().includes(q);
      return matchNama || matchNis;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Notifikasi Berhasil */}
      {messageSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-medium flex items-center gap-2 animate-fadeUp">
          <Icon name="check" className="w-5 h-5 shrink-0" />
          <span>{messageSuccess}</span>
        </div>
      )}

      {/* Form Kirim Pesan */}
      <form onSubmit={onSubmit} className="card card-pad space-y-5 border border-border">
        <div>
          <h3 className="font-bold text-base text-ink flex items-center gap-2">
            <Icon name="messages" className="w-5 h-5 text-accent" />
            <span>Kirim Pesan & Pengumuman Baru</span>
          </h3>
          <p className="text-xs text-muted mt-0.5">
            Pesan akan muncul di Kotak Pesan Portal Siswa yang dituju.
          </p>
        </div>

        {/* 1. Pilih Target Penerima Pesan */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted uppercase tracking-wider block">
            Target Penerima Pesan:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Opsi 1: Semua Siswa */}
            <button
              type="button"
              onClick={() => handleTargetTypeChange('all')}
              className={`p-3 rounded-xl border text-left transition flex items-start gap-3 ${
                targetType === 'all'
                  ? 'bg-accent-soft border-accent text-ink ring-1 ring-accent'
                  : 'bg-surface2/60 border-border text-muted hover:text-ink hover:bg-surface2'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 font-bold">
                🌐
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-ink">Semua Siswa</p>
                <p className="text-[11px] text-muted mt-0.5">Broadcast pengumuman ke seluruh kelas</p>
              </div>
            </button>

            {/* Opsi 2: Kelas Tertentu */}
            <button
              type="button"
              onClick={() => handleTargetTypeChange('kelas')}
              className={`p-3 rounded-xl border text-left transition flex items-start gap-3 ${
                targetType === 'kelas'
                  ? 'bg-accent-soft border-accent text-ink ring-1 ring-accent'
                  : 'bg-surface2/60 border-border text-muted hover:text-ink hover:bg-surface2'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 font-bold">
                🏫
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-ink">Kelas Tertentu</p>
                <p className="text-[11px] text-muted mt-0.5">Pilih 1 atau beberapa rombel kelas</p>
              </div>
            </button>

            {/* Opsi 3: Satu Siswa Tertentu */}
            <button
              type="button"
              onClick={() => handleTargetTypeChange('student')}
              className={`p-3 rounded-xl border text-left transition flex items-start gap-3 ${
                targetType === 'student'
                  ? 'bg-accent-soft border-accent text-ink ring-1 ring-accent'
                  : 'bg-surface2/60 border-border text-muted hover:text-ink hover:bg-surface2'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 font-bold">
                👤
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-ink">Satu Siswa</p>
                <p className="text-[11px] text-muted mt-0.5">Kirim pesan personal ke spesifik siswa</p>
              </div>
            </button>
          </div>
        </div>

        {/* 2. Detail Pilihan Target Kelas */}
        {targetType === 'kelas' && (
          <div className="p-4 rounded-xl bg-surface2/60 border border-border space-y-2 animate-fadeUp">
            <span className="text-xs font-semibold text-ink block">Centang Kelas yang Dituju:</span>
            <div className="flex flex-wrap gap-2">
              {KELAS_LIST.map(k => {
                const checked = (messageForm.targetKelas || []).includes(k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      const updated = checked
                        ? messageForm.targetKelas.filter(x => x !== k)
                        : [...(messageForm.targetKelas || []), k];
                      setMessageForm({ ...messageForm, targetKelas: updated });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border flex items-center gap-1.5 ${
                      checked
                        ? 'bg-accent text-white border-accent shadow-sm'
                        : 'bg-surface border-border text-muted hover:text-ink'
                    }`}
                  >
                    <span>{k}</span>
                    {checked && <Icon name="check" className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>
            {(!messageForm.targetKelas || messageForm.targetKelas.length === 0) && (
              <p className="text-[11px] text-rose-400 mt-1">⚠️ Pilih minimal 1 kelas!</p>
            )}
          </div>
        )}

        {/* 3. Detail Pilihan Satu Siswa */}
        {targetType === 'student' && (
          <div className="p-4 rounded-xl bg-surface2/60 border border-border space-y-3 animate-fadeUp">
            <span className="text-xs font-semibold text-ink block">Pilih Siswa Penerima:</span>

            {selectedStudent ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                    👤
                  </div>
                  <div>
                    <p className="text-xs font-bold text-ink">{selectedStudent.nama}</p>
                    <p className="text-[11px] text-muted">
                      NIS: <span className="font-mono text-ink font-semibold">{selectedStudent.nis || '-'}</span> • Kelas: <span className="badge-accent text-[10px]">{selectedStudent.kelas}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStudent(null);
                    setMessageForm(prev => ({ ...prev, targetStudents: [] }));
                  }}
                  className="px-2.5 py-1 rounded bg-surface border border-border text-danger hover:bg-danger-soft text-xs font-medium transition"
                >
                  Ganti Siswa
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={studentFilterKelas}
                    onChange={(e) => setStudentFilterKelas(e.target.value)}
                    className="input text-xs"
                  >
                    <option value="">-- Semua Kelas ({students.length} Siswa) --</option>
                    {KELAS_LIST.map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Cari nama atau NIS siswa..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="input w-full text-xs pl-8"
                    />
                    <Icon name="search" className="w-4 h-4 text-muted absolute left-2.5 top-2.5" />
                  </div>
                </div>

                {/* List Siswa */}
                <div className="max-h-48 overflow-y-auto border border-border rounded-xl divide-y divide-border bg-surface">
                  {loadingStudents ? (
                    <p className="p-4 text-center text-xs text-muted">Memuat daftar siswa...</p>
                  ) : filteredStudents.length > 0 ? (
                    filteredStudents.map(s => (
                      <button
                        key={s._id}
                        type="button"
                        onClick={() => handleSelectStudent(s)}
                        className="w-full text-left p-2.5 hover:bg-surface2 flex items-center justify-between transition text-xs group"
                      >
                        <div>
                          <p className="font-semibold text-ink group-hover:text-accent transition">{s.nama}</p>
                          <p className="text-[11px] text-muted">NIS: {s.nis || '-'} • Kelas: {s.kelas}</p>
                        </div>
                        <span className="badge text-[10px] bg-surface2 border border-border text-muted group-hover:border-accent group-hover:text-accent">
                          Pilih Siswa →
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="p-4 text-center text-xs text-muted">Tidak ada siswa yang cocok dengan filter.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. Form Judul, Prioritas, & Konten Pesan */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-muted block mb-1">Judul Pesan:</label>
            <input
              type="text"
              placeholder="Contoh: Pengingat Praktikum Jaringan / Info Remidi"
              value={messageForm.title}
              onChange={(e) => setMessageForm({ ...messageForm, title: e.target.value })}
              className="input w-full text-xs"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted block mb-1">Prioritas:</label>
            <select
              value={messageForm.priority}
              onChange={(e) => setMessageForm({ ...messageForm, priority: e.target.value })}
              className="input w-full text-xs"
            >
              <option value="normal">Normal</option>
              <option value="high">Penting (Tinggi)</option>
              <option value="urgent">Mendesak (Urgent)</option>
              <option value="low">Rendah</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted block mb-1">Isi Pesan:</label>
          <textarea
            placeholder="Tuliskan pengumuman atau pesan Anda untuk siswa di sini..."
            value={messageForm.content}
            onChange={(e) => setMessageForm({ ...messageForm, content: e.target.value })}
            className="input w-full h-28 resize-none text-xs leading-relaxed"
            required
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-2 shadow-md"
        >
          <Icon name="messages" className="w-4 h-4" />
          <span>{submitting ? 'Mengirim...' : 'Kirim Pesan Sekarang'}</span>
        </button>
      </form>

      {/* Riwayat Pesan */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-muted uppercase tracking-wider">
            Riwayat Pesan Terkirim ({messages.length})
          </h3>
        </div>

        {messages.length === 0 ? (
          <div className="card card-pad text-center py-8 text-xs text-muted">
            Belum ada riwayat pesan yang dikirim.
          </div>
        ) : (
          messages.map(msg => {
            const p = PRIORITY_BADGES[msg.priority] || PRIORITY_BADGES.normal;
            return (
              <div key={msg._id} className="card p-4 border border-border hover:border-border-strong transition space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold text-sm text-ink">{msg.title}</h4>
                      <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${p.cls}`}>
                        {p.label}
                      </span>

                      {/* Badge Target */}
                      {msg.isGlobal ? (
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                          🌐 Semua Siswa
                        </span>
                      ) : msg.targetStudents && msg.targetStudents.length > 0 ? (
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          👤 Siswa: {msg.targetStudents.map(s => `${s.nama} (${s.kelas})`).join(', ')}
                        </span>
                      ) : msg.targetKelas && msg.targetKelas.length > 0 ? (
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                          🏫 Kelas: {msg.targetKelas.join(', ')}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-700 text-slate-300">
                          Spesifik
                        </span>
                      )}

                      {/* Pengirim */}
                      <span className="text-[11px] text-muted">
                        • Oleh: <strong className="text-ink">{msg.senderName || (msg.senderRole === 'admin' ? 'Admin' : 'Guru')}</strong>
                      </span>
                    </div>

                    <p className="text-xs text-muted whitespace-pre-line leading-relaxed">
                      {msg.content}
                    </p>
                    <p className="text-[11px] text-muted/70 pt-1">
                      {new Date(msg.createdAt).toLocaleString('id-ID', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>

                  {/* Tombol Hapus */}
                  {(user?.role === 'admin' || String(msg.sender) === String(user?.id || user?._id)) && (
                    <button
                      type="button"
                      onClick={() => deleteMessage(msg._id)}
                      className="px-2.5 py-1 text-xs rounded bg-surface2 hover:bg-rose-500/15 text-muted hover:text-rose-400 border border-border transition shrink-0"
                    >
                      Hapus
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
