import { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import { Card, LoadingBlock, EmptyState, ScoreBadge, Banner, PageHeader } from '../../components/ui';
import { Progress } from '../../components/charts';
import Icon from '../../components/icons';

const STATE_LABEL = {
  NEW: 'Belum dikerjakan',
  CREATED: 'Draf',
  TURNED_IN: 'Terkumpul',
  RETURNED: 'Sudah dinilai',
  RECLAIMED: 'Ditarik',
  STUDENT_EDITED: 'Revisi',
};
const WORK_LABEL = { ASSIGNMENT: 'Tugas', QUIZ: 'Kuis', SHORT_ANSWER_QUESTION: 'Jawaban singkat', MATERIAL: 'Materi', POST: 'Diskusi' };

function dayKey(d) {
  const date = new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function CalendarMenu() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [subject, setSubject] = useState('');
  const [onlyLate, setOnlyLate] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get('/analytics/tasks?days=45')
      .then(res => alive && setData(res.data))
      .catch(() => alive && setError('Gagal memuat kalender tugas.'));
    return () => { alive = false; };
  }, []);

  const groups = useMemo(() => {
    if (!data) return [];
    const map = new Map();
    for (const t of data.tasks) {
      if (subject && t.subject !== subject) continue;
      if (onlyLate && !t.overdue) continue;
      const key = dayKey(t.dueDate);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [data, subject, onlyLate]);

  if (error) return <EmptyState icon="calendar" title="Kalender tidak tersedia" desc={error} />;
  if (!data) return <LoadingBlock label="Memuat kalender tugas..." />;

  const { summary, tasks } = data;
  const staffView = tasks.length > 0 && tasks[0].totalStudents !== undefined;

  return (
    <div className="space-y-5 animate-fadeUp">
      <PageHeader
        eyebrow="Jadwal tenggat"
        title="Kalender Tugas"
        subtitle={
          staffView
            ? 'Tenggat & progres pengerjaan tugas Google Classroom seluruh siswa.'
            : 'Jadwal tugas, kuis, dan materi dari Google Classroom milikmu.'
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <Card pad className="text-center">
          <p className="section-title">Total</p>
          <p className="mt-1 text-2xl font-extrabold text-accent">{summary.total}</p>
        </Card>
        <Card pad className="text-center">
          <p className="section-title">7 Hari ke Depan</p>
          <p className="mt-1 text-2xl font-extrabold text-info">{summary.dueThisWeek}</p>
        </Card>
        <Card pad className="text-center">
          <p className="section-title">{staffView ? 'Terlambat' : 'Belum Dikumpul'}</p>
          <p className="mt-1 text-2xl font-extrabold text-danger">{staffView ? tasks.filter(t => t.overdue).length : summary.myOverdue}</p>
        </Card>
      </div>

      <Card
        title="Filter"
        actions={
          <div className="flex flex-wrap gap-1.5">
            <button className={`btn px-3 py-1.5 text-xs ${!subject && !onlyLate ? 'bg-accent text-white' : 'bg-surface2 text-muted border border-line'}`}
              onClick={() => { setSubject(''); setOnlyLate(false); }}>
              Semua
            </button>
            {['ASJ', 'AIJ', 'TJBL', 'PKDK', 'TJKT'].map(s => (
              <button key={s}
                className={`btn px-3 py-1.5 text-xs ${subject === s ? 'bg-accent text-white' : 'bg-surface2 text-muted border border-line'}`}
                onClick={() => setSubject(subject === s ? '' : s)}>
                {s}
              </button>
            ))}
            <button className={`btn px-3 py-1.5 text-xs ${onlyLate ? 'bg-danger text-white' : 'bg-surface2 text-muted border border-line'}`}
              onClick={() => setOnlyLate(v => !v)}>
              Terlambat
            </button>
          </div>
        }
      >
        <p className="text-xs text-muted">
          Menampilkan <span className="font-bold text-ink">{groups.reduce((a, g) => a + g[1].length, 0)}</span> tugas
          dalam 45 hari terakhir dan mendatang.
        </p>
      </Card>

      {groups.length === 0 ? (
        <EmptyState icon="calendar" title="Tidak ada tugas" desc="Ubah filter atau tunggu guru memposting tugas baru." />
      ) : (
        <div className="space-y-5">
          {groups.map(([key, items]) => {
            const date = new Date(key + 'T00:00:00');
            const today = dayKey(new Date()) === key;
            return (
              <section key={key}>
                <div className="mb-2 flex items-center gap-3">
                  <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl border text-center leading-none ${
                    today ? 'border-accent bg-accent text-white' : 'border-line bg-surface text-ink'
                  }`}>
                    <span className="pt-1 text-base font-extrabold">{date.getDate()}</span>
                    <span className="pb-1 text-[9px] font-bold uppercase tracking-wider opacity-80">
                      {date.toLocaleDateString('id-ID', { month: 'short' })}
                    </span>
                  </span>
                  <div>
                    <p className="text-sm font-bold text-ink">
                      {date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-[11px] text-muted">{items.length} tugas{date < new Date() ? ' • lewat tenggat' : ''}</p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {items.map(t => (
                    <Card key={t.id} pad={false} hover>
                      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                          <Icon name={t.workType === 'QUIZ' ? 'edit' : t.workType === 'MATERIAL' ? 'book' : 'import'} className="h-5 w-5" />
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="badge-accent">{t.subject}</span>
                            <span className="badge-neutral">{WORK_LABEL[t.workType] || t.workType}</span>
                            {t.overdue && <span className="badge-danger">Lewat tenggat</span>}
                          </div>
                          <p className="mt-1.5 truncate text-sm font-bold text-ink">{t.title}</p>
                          <p className="truncate text-[11px] text-muted">{t.courseName}</p>
                        </div>

                        <div className="shrink-0 sm:w-52">
                          {staffView ? (
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-[11px] font-semibold text-muted">
                                <span>Dikumpulkan</span>
                                <span className="tabular-nums text-ink">{t.submitted}/{t.totalStudents}</span>
                              </div>
                              <Progress value={t.submitted} max={Math.max(1, t.totalStudents)} tone="success" />
                              <div className="flex justify-between text-[11px] text-muted">
                                <span>Dinilai {t.graded}</span>
                                <span>{new Date(t.dueDate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2 sm:justify-end">
                              <div className="text-right">
                                <p className="text-[11px] text-muted">{STATE_LABEL[t.state] || t.state}</p>
                                <p className="text-xs font-semibold text-ink">
                                  {t.isGraded ? 'Nilai ' : 'Status '}
                                  {t.isGraded && <ScoreBadge score={t.grade} />}
                                </p>
                              </div>
                              <span className={`grid h-9 w-9 place-items-center rounded-full ${
                                t.state === 'TURNED_IN' || t.state === 'RETURNED'
                                  ? 'bg-success-soft text-success'
                                  : t.overdue
                                    ? 'bg-danger-soft text-danger'
                                    : 'bg-surface2 text-muted'
                              }`}>
                                <Icon name={t.state === 'TURNED_IN' || t.state === 'RETURNED' ? 'check' : 'clock'} className="h-4 w-4" />
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {staffView && (
        <Banner tone="info">
          Progres dihitung dari status pengumpulan siswa di Google Classroom. Klik menu <b>Nilai Classroom</b> untuk detail per siswa.
        </Banner>
      )}
    </div>
  );
}
