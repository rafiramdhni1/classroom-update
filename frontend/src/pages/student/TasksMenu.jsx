import { useMemo, useState } from 'react';
import { useStudent } from './studentStore';
import { Card, LoadingBlock, EmptyState, Tabs, ScoreBadge, PageHeader } from '../../components/ui';
import { Progress } from '../../components/charts';
import { MissingTasksCard } from '../../components/MissingTasksCard';
import Icon from '../../components/icons';

const STATE_LABEL = {
  NEW: 'Belum dikerjakan',
  CREATED: 'Draf tersimpan',
  TURNED_IN: 'Sudah dikumpulkan',
  RETURNED: 'Sudah dinilai',
  RECLAIMED: 'Ditarik guru',
  STUDENT_EDITED: 'Revisi siswa',
};
const WORK_LABEL = { ASSIGNMENT: 'Tugas', QUIZ: 'Kuis', SHORT_ANSWER_QUESTION: 'Jawaban singkat', MATERIAL: 'Materi', POST: 'Diskusi' };

export default function TasksMenu() {
  const { tasks, student } = useStudent();
  const [filter, setFilter] = useState('semua');

  const list = useMemo(() => {
    const arr = tasks?.tasks || [];
    if (filter === 'terlambat') return arr.filter(t => t.overdue && t.state !== 'TURNED_IN' && t.state !== 'RETURNED');
    if (filter === 'menunggu') return arr.filter(t => !t.isGraded);
    if (filter === 'selesai') return arr.filter(t => t.isGraded);
    return arr;
  }, [tasks, filter]);

  if (!tasks) return <LoadingBlock label="Memuat tugas..." />;

  const summary = tasks.summary;
  const done = (tasks.tasks || []).filter(t => t.isGraded).length;
  const submitted = (tasks.tasks || []).filter(t => t.state === 'TURNED_IN' || t.state === 'RETURNED').length;

  return (
    <div className="space-y-5 animate-fadeUp">
      <PageHeader
        eyebrow="Google Classroom"
        title="Tugas Saya"
        subtitle={`Semua tugas ${student?.kelas ? `kelas ${student.kelas}` : 'sekolah'} beserta tenggat dan status pengerjaan.`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card pad className="text-center">
          <p className="section-title">Total</p>
          <p className="mt-1 text-2xl font-extrabold text-accent">{summary.total}</p>
        </Card>
        <Card pad className="text-center">
          <p className="section-title">7 Hari ke Depan</p>
          <p className="mt-1 text-2xl font-extrabold text-info">{summary.dueThisWeek}</p>
        </Card>
        <Card pad className="text-center">
          <p className="section-title">Belum Terkumpul</p>
          <p className="mt-1 text-2xl font-extrabold text-danger">{summary.myOverdue}</p>
        </Card>
        <Card pad className="text-center">
          <p className="section-title">Sudah Dinilai</p>
          <p className="mt-1 text-2xl font-extrabold text-success">{done}</p>
        </Card>
      </div>

      <MissingTasksCard />

      <Card title="Progres Pengerjaan">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Progress
              label="Terkumpul"
              right={`${submitted}/${summary.total}`}
              value={submitted}
              max={Math.max(1, summary.total)}
              tone="success"
            />
          </div>
          <div>
            <Progress
              label="Sudah dinilai"
              right={`${done}/${summary.total}`}
              value={done}
              max={Math.max(1, summary.total)}
              tone="accent"
            />
          </div>
        </div>
      </Card>

      <Tabs
        items={[
          { key: 'semua', label: 'Semua' },
          { key: 'menunggu', label: 'Menunggu Nilai' },
          { key: 'terlambat', label: 'Terlambat' },
          { key: 'selesai', label: 'Selesai' },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {list.length === 0 ? (
        <EmptyState icon="check" title="Tidak ada tugas" desc="Semua tugas pada kategori ini sudah beres." />
      ) : (
        <div className="space-y-3">
          {[...list]
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
            .map(t => {
              const graded = t.isGraded;
              const doneState = t.state === 'TURNED_IN' || t.state === 'RETURNED';
              return (
                <Card key={t.id} pad={false} hover>
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                      graded ? 'bg-success-soft text-success' : t.overdue ? 'bg-danger-soft text-danger' : 'bg-accent-soft text-accent'
                    }`}>
                      <Icon name={graded ? 'check' : t.workType === 'QUIZ' ? 'edit' : 'import'} className="h-5 w-5" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="badge-accent">{t.subject}</span>
                        <span className="badge-neutral">{WORK_LABEL[t.workType] || t.workType}</span>
                        {t.overdue && !graded && <span className="badge-danger">Lewat tenggat</span>}
                      </div>
                      <p className="mt-1.5 truncate text-sm font-bold text-ink">{t.title}</p>
                      <p className="truncate text-[11px] text-muted">{t.courseName}</p>
                    </div>

                    <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
                      {t.dueDate ? (
                        <p className="text-xs font-semibold text-ink">
                          {new Date(t.dueDate).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                          <span className="ml-1 font-normal text-muted">
                            {new Date(t.dueDate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </p>
                      ) : (
                        <p className="text-xs text-muted">Tanpa batas waktu</p>
                      )}
                      <div className="flex items-center gap-2">
                        <span className={`badge ${graded ? 'badge-success' : doneState ? 'badge-accent' : t.overdue ? 'badge-danger' : 'badge-neutral'}`}>
                          {graded ? 'Dinilai' : STATE_LABEL[t.state] || t.state}
                        </span>
                        {graded && <ScoreBadge score={t.grade} />}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
        </div>
      )}
    </div>
  );
}
