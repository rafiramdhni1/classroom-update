import { useEffect, useState } from 'react';
import api from '../../utils/api';
import { Card, PageHeader, Field, Button, Banner, EmptyState, LoadingBlock, Tabs, Badge, Select } from '../../components/ui';
import Icon from '../../components/icons';
import { useStaff } from './staffStore';

const WORK_TYPES = [
  { value: 'ASSIGNMENT', label: 'Tugas', icon: 'import' },
  { value: 'QUIZ', label: 'Kuis', icon: 'edit' },
  { value: 'SHORT_ANSWER_QUESTION', label: 'Jawaban Singkat', icon: 'edit' },
  { value: 'MATERIAL', label: 'Materi', icon: 'book' },
];

const KELAS_LIST = ['X-TKJ1', 'X-TKJ2', 'XI-TKJ1', 'XI-TKJ2', 'XII-TKJ1', 'XII-TKJ2'];

export default function AssignmentsMenu() {
  const { googleAuth, googleEmail, setTab: setStoreTab } = useStaff();
  const [tab, setTab] = useState('create');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    workType: 'ASSIGNMENT',
    kelas: '',
    courseId: '',
    dueDate: '',
    dueTime: '23:59',
    maxPoints: 100,
    state: 'PUBLISHED',
  });
  const [drafts, setDrafts] = useState([]);
  const [published, setPublished] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadCourses = async () => {
    try {
      const res = await api.get('/classroom-realtime/courses');
      const filtered = (res.data.courses || [])
        .filter(c => c.alias)
        .map(c => ({
          id: c.id,
          name: c.name,
          alias: c.alias,
          kelas: Array.isArray(c.kelas) ? c.kelas : [],
          matchedStudents: Number(c.matchedStudents) || 0,
        }));
      setCourses(filtered);
    } catch (err) {
      console.error('Gagal memuat kursus:', err);
    }
  };

  useEffect(() => { loadCourses(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.courseId || !form.kelas) {
      setError('Judul, kelas, dan mata pelajaran wajib diisi');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = {
        courseId: form.courseId,
        title: form.title.trim(),
        description: form.description.trim(),
        workType: form.workType,
        dueDate: form.dueDate ? new Date(form.dueDate + 'T' + form.dueTime).toISOString() : null,
        maxPoints: Number(form.maxPoints) || 100,
        state: form.state,
        kelas: form.kelas,
      };
      const res = await api.post('/classroom-realtime/coursework', payload);
      setSuccess(res.data.message || 'Tugas berhasil dibuat di Google Classroom!');
      setForm({ ...form, title: '', description: '', dueDate: '', dueTime: '23:59', state: 'PUBLISHED' });
      setSelectedCourse(form.courseId);
      loadPublished(form.courseId);
      loadDrafts(form.courseId);
      setTimeout(() => setSuccess(''), 7000);
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal membuat tugas');
    } finally {
      setLoading(false);
    }
  };

  const loadDrafts = async (courseId = selectedCourse) => {
    if (!courseId) return;
    try {
      const res = await api.get(`/classroom-realtime/coursework?courseId=${courseId}&state=DRAFT`);
      setDrafts(res.data.coursework || []);
    } catch (err) {
      console.error('Gagal memuat draf:', err);
    }
  };

  const loadPublished = async (courseId = selectedCourse) => {
    if (!courseId) return;
    try {
      const res = await api.get(`/classroom-realtime/coursework?courseId=${courseId}&state=PUBLISHED`);
      setPublished(res.data.coursework || []);
    } catch (err) {
      console.error('Gagal memuat published:', err);
    }
  };

  const publishWork = async (courseworkId) => {
    if (!confirm('Publikasikan tugas ini ke siswa?')) return;
    try {
      await api.post(`/classroom-realtime/coursework/${courseworkId}/publish`, { courseId: selectedCourse });
      setSuccess('Tugas dipublikasikan!');
      loadDrafts();
      loadPublished();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Gagal mempublikasikan: ' + (err.response?.data?.error || err.message));
    }
  };

  const deleteWork = async (courseworkId) => {
    if (!confirm('Hapus tugas ini?')) return;
    try {
      await api.delete(`/classroom-realtime/coursework/${courseworkId}`);
      setSuccess('Tugas dihapus!');
      loadDrafts();
      loadPublished();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Gagal menghapus: ' + (err.response?.data?.error || err.message));
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-5 animate-fadeUp">
      <PageHeader
        eyebrow="Google Classroom"
        title="Buat Tugas & Kuis"
        subtitle="Buat tugas, kuis, atau materi langsung ke Google Classroom tanpa keluar dari panel guru."
      />

      {(error || success) && (
        <Banner tone={error ? 'danger' : 'success'} onClose={() => { setError(''); setSuccess(''); }}>
          {error || success}
        </Banner>
      )}

      <Tabs
        items={[
          { key: 'create', label: 'Buat Baru' },
          { key: 'drafts', label: 'Draf' },
          { key: 'published', label: 'Dipublikasikan' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'create' && (
        <Card title="Form Tugas Baru">
          {googleAuth ? (
            <div className="mb-4 flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-medium">
              <Icon name="check" className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>Google Classroom Terhubung {googleEmail ? `(${googleEmail})` : ''} — Setiap tugas yang dibuat otomatis dikirim &amp; diterbitkan ke akun Google Classroom.</span>
            </div>
          ) : (
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-xl text-xs">
              <div className="flex items-center gap-2">
                <Icon name="google" className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>Akun Google Classroom guru belum terhubung. Tugas tetap tersimpan di sistem internal.</span>
              </div>
              <button
                type="button"
                onClick={() => setStoreTab('google')}
                className="underline font-semibold hover:opacity-80 text-left sm:text-right shrink-0"
              >
                Hubungkan Akun Google ➔
              </button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Judul Tugas">
              <input
                type="text"
                className="input"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Contoh: Tugas 1 - Konfigurasi Router"
                required
              />
            </Field>

            <Field label="Deskripsi">
              <textarea
                className="input"
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Instruksi pengerjaan, link referensi, dsb."
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Jenis">
                <Select
                  icon="edit"
                  value={form.workType}
                  onChange={(v) => setForm({ ...form, workType: v })}
                  options={WORK_TYPES.map(w => ({ value: w.value, label: w.label }))}
                  placeholder="Pilih Jenis"
                />
              </Field>

              <Field label="Maksimal Nilai">
                <input
                  type="number"
                  className="input"
                  value={form.maxPoints}
                  onChange={(e) => setForm({ ...form, maxPoints: e.target.value })}
                  min={1}
                  max={1000}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Kelas" htmlFor="kelas">
                <Select
                  id="kelas"
                  icon="classroom"
                  value={form.kelas}
                  onChange={(v) => setForm({ ...form, kelas: v })}
                  options={KELAS_LIST.map(k => ({ value: k, label: k }))}
                  placeholder="Pilih Kelas"
                />
              </Field>

              <Field label="Mata Pelajaran (Course)">
                <Select
                  icon="google"
                  value={form.courseId}
                  onChange={(v) => setForm({ ...form, courseId: v })}
                  options={courses.map(c => ({
                    value: c.id,
                    label: `${c.alias} - ${c.name} (${c.kelas.join(', ')} / ${c.matchedStudents} siswa)`,
                  }))}
                  placeholder="Pilih Course Google Classroom"
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Tenggat (opsional)">
                <input
                  type="date"
                  className="input"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                />
              </Field>
              <Field label="Jam">
                <input
                  type="time"
                  className="input"
                  value={form.dueTime}
                  onChange={(e) => setForm({ ...form, dueTime: e.target.value })}
                />
              </Field>
              <Field label="Status">
                <Select
                  icon="check"
                  value={form.state}
                  onChange={(v) => setForm({ ...form, state: v })}
                  options={[
                    { value: 'DRAFT', label: 'Draf' },
                    { value: 'PUBLISHED', label: 'Publikasikan' },
                  ]}
                  placeholder="Pilih Status"
                />
              </Field>
            </div>

            <div className="flex gap-2">
              <Button type="submit" variant="primary" disabled={loading}>
                {loading ? 'Membuat...' : 'Buat Tugas'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setForm({ ...form, title: '', description: '', dueDate: '' })}>
                Reset
              </Button>
            </div>
          </form>
        </Card>
      )}

      {tab === 'drafts' && (
        <Card title="Draf Tugas">
          <div className="mb-4">
            <Select
              className="w-full sm:w-80"
              icon="google"
              value={selectedCourse}
              onChange={(v) => { setSelectedCourse(v); loadDrafts(v); loadPublished(v); }}
              options={courses.map(c => ({ value: c.id, label: `${c.alias} - ${c.name}` }))}
              placeholder="Pilih Course"
            />
          </div>
          {selectedCourse ? (
            drafts.length === 0 ? (
              <EmptyState icon="import" title="Tidak ada draf" desc="Draf tugas untuk course ini akan tampil di sini." />
            ) : (
              <div className="space-y-3">
                {drafts.map(cw => (
                  <Card key={cw.id} pad={false} hover className="border-warn/40">
                    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge tone="warn">DRAFT</Badge>
                          <span className="badge-accent">{cw.courseAlias || cw.courseName}</span>
                          <span className="badge-neutral">{WORK_TYPES.find(w => w.value === cw.workType)?.label || cw.workType}</span>
                        </div>
                        <p className="mt-1.5 truncate text-sm font-bold text-ink">{cw.title}</p>
                        <p className="text-[11px] text-muted">{cw.description?.slice(0, 100) || 'Tanpa deskripsi'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted">{cw.dueDate ? `Tenggat: ${formatDate(cw.dueDate)}` : 'Tanpa batas waktu'}</p>
                        <Button variant="primary" size="sm" onClick={() => publishWork(cw.id)}>
                          <Icon name="check" className="h-3.5 w-3.5" /> Publikasikan
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => deleteWork(cw.id)}>
                          <Icon name="trash" className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )
          ) : (
            <p className="text-center text-muted py-4">Pilih course untuk melihat draf</p>
          )}
        </Card>
      )}

      {tab === 'published' && (
        <Card title="Tugas Dipublikasikan">
          <div className="mb-4">
            <Select
              className="w-full sm:w-80"
              icon="google"
              value={selectedCourse}
              onChange={(v) => { setSelectedCourse(v); loadDrafts(v); loadPublished(v); }}
              options={courses.map(c => ({ value: c.id, label: `${c.alias} - ${c.name}` }))}
              placeholder="Pilih Course"
            />
          </div>
          {selectedCourse ? (
            published.length === 0 ? (
              <EmptyState icon="check" title="Belum ada yang dipublikasikan" desc="Publikasikan dari tab Draf untuk muncul di sini." />
            ) : (
              <div className="space-y-3">
                {published.map(cw => (
                  <Card key={cw.id} pad={false} hover className="border-success/40">
                    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge tone="success">PUBLISHED</Badge>
                          <span className="badge-accent">{cw.courseAlias || cw.courseName}</span>
                          <span className="badge-neutral">{WORK_TYPES.find(w => w.value === cw.workType)?.label || cw.workType}</span>
                        </div>
                        <p className="mt-1.5 truncate text-sm font-bold text-ink">{cw.title}</p>
                        <p className="text-[11px] text-muted">{cw.description?.slice(0, 100) || 'Tanpa deskripsi'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted">{cw.dueDate ? `Tenggat: ${formatDate(cw.dueDate)}` : 'Tanpa batas waktu'}</p>
                        <Button variant="ghost" size="sm" onClick={() => deleteWork(cw.id)}>
                          <Icon name="trash" className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )
          ) : (
            <p className="text-center text-muted py-4">Pilih course untuk melihat tugas dipublikasikan</p>
          )}
        </Card>
      )}
    </div>
  );
}