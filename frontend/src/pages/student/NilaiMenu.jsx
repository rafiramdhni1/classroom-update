import { useMemo, useState } from 'react';
import { useStudent } from './studentStore';
import { Card, ScoreBadge, EmptyState, Tabs, Banner, PageHeader } from '../../components/ui';
import { Donut, Progress } from '../../components/charts';
import Icon from '../../components/icons';

const SUBJECT_LABELS = {
  ASJ: 'Administrasi Sistem Jaringan',
  AIJ: 'Administrasi Infrastruktur Jaringan',
  TJBL: 'Tata Jaringan Berbasis Luas',
  PKDK: 'Pemodelan dan Komunikasi Data',
  TJKT: 'Teknologi Jaringan Komputer dan Telekomunikasi',
};
const TYPE_LABEL = { tugas: 'Tugas', quiz: 'Kuis', uts: 'UTS', uas: 'UAS', ASSIGNMENT: 'Tugas', QUIZ: 'Kuis', SHORT_ANSWER_QUESTION: 'Jawaban singkat', MATERIAL: 'Materi', POST: 'Diskusi' };

export default function NilaiMenu() {
  const { data } = useStudent();
  const [subject, setSubject] = useState('semua');
  const [openComp, setOpenComp] = useState(null);

  const subjects = Object.entries(data?.subjectGrades || {});
  const visible = subject === 'semua' ? subjects : subjects.filter(([a]) => a === subject);

  const stats = useMemo(() => {
    const graded = subjects.reduce((acc, [, v]) => acc + v.gradedCount, 0);
    const total = subjects.reduce((acc, [, v]) => acc + v.totalAssignments, 0);
    const best = subjects.reduce((b, [a, v]) => (v.average !== null && (!b || v.average > b.avg) ? { alias: a, avg: v.average } : b), null);
    return { graded, total, best };
  }, [subjects]);

  if (!subjects.length) {
    return <EmptyState icon="grades" title="Belum ada nilai" desc="Nilai akan muncul setelah guru menginput atau sinkronisasi Google Classroom." />;
  }

  return (
    <div className="space-y-5 animate-fadeUp">
      <PageHeader
        eyebrow="Rekap nilai"
        title="Nilai Saya"
        subtitle="Rincian nilai setiap komponen tugas, kuis, dan ujian."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card pad className="text-center">
          <p className="section-title">Rata-rata</p>
          <p className="mt-1 text-3xl font-extrabold text-accent">
            {data?.overallAverage != null ? data.overallAverage.toFixed(1) : '-'}
          </p>
        </Card>
        <Card pad className="text-center">
          <p className="section-title">Sudah Dinilai</p>
          <p className="mt-1 text-3xl font-extrabold text-success">{stats.graded}</p>
          <p className="text-[11px] text-muted">dari {stats.total} komponen</p>
        </Card>
        <Card pad className="text-center">
          <p className="section-title">Mapel Terbaik</p>
          <p className="mt-1 text-3xl font-extrabold text-warn">{stats.best?.alias || '-'}</p>
          <p className="text-[11px] text-muted">{stats.best ? stats.best.avg.toFixed(1) : 'belum ada'}</p>
        </Card>
        <Card pad className="text-center">
          <p className="section-title">Komponen Kosong</p>
          <p className="mt-1 text-3xl font-extrabold text-danger">{stats.total - stats.graded}</p>
          <p className="text-[11px] text-muted">menunggu penilaian</p>
        </Card>
      </div>

      <Tabs
        className="w-full"
        value={subject}
        onChange={setSubject}
        items={[{ key: 'semua', label: 'Semua Mapel' }, ...subjects.map(([a]) => ({ key: a, label: a }))]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {visible.map(([alias, info]) => {
            const pct = info.totalAssignments ? Math.round((info.gradedCount / info.totalAssignments) * 100) : 0;
            return (
              <Card key={alias} pad={false} hover>
                <button
                  onClick={() => setOpenComp(openComp === alias ? null : alias)}
                  className="flex w-full items-center gap-4 p-4 text-left"
                >
                  <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-base font-extrabold text-white ${
                    (info.average ?? 0) >= 85 ? 'bg-success' : (info.average ?? 0) >= 70 ? 'bg-warn' : info.average == null ? 'bg-muted/50' : 'bg-danger'
                  }`}>
                    {info.average != null ? info.average.toFixed(0) : '-'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ink">{alias}</p>
                    <p className="truncate text-xs text-muted">{SUBJECT_LABELS[alias] || alias}</p>
                    <div className="mt-2">
                      <Progress value={pct} max={100} tone={pct === 100 ? 'success' : 'accent'} />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold text-ink">{info.gradedCount}/{info.totalAssignments}</p>
                    <p className="text-[11px] text-muted">komponen</p>
                    <Icon name="chevronDown" className={`mt-1 h-4 w-4 text-muted transition ${openComp === alias ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {openComp === alias && (
                  <div className="border-t border-line/80 bg-surface2/60 p-4">
                    {info.components.length === 0 ? (
                      <p className="py-3 text-center text-xs text-muted">Belum ada tugas/ujian untuk mata pelajaran ini.</p>
                    ) : (
                      <ul className="space-y-2">
                        {info.components.map((comp, idx) => (
                          <li key={idx} className="row-card flex items-center justify-between gap-3 p-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-ink">{comp.title}</p>
                              <p className="text-[11px] uppercase tracking-wide text-muted">{TYPE_LABEL[comp.type] || comp.type}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              {comp.isGraded ? (
                                <ScoreBadge score={comp.score} />
                              ) : (
                                <span className="badge-neutral">Belum dinilai</span>
                              )}
                              <p className="mt-0.5 text-[11px] text-muted">maks {comp.maxScore}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <div className="space-y-4">
          <Card title="Sebaran Nilai Saya">
            <Donut
              size={130}
              centerLabel="Mapel"
              centerValue={subjects.length}
              data={subjects.map(([alias, info]) => ({
                label: alias,
                value: info.average ?? 0,
                color:
                  (info.average ?? 0) >= 85 ? 'rgb(var(--c-success))' :
                  (info.average ?? 0) >= 70 ? 'rgb(var(--c-warn))' : 'rgb(var(--c-danger))',
              }))}
            />
          </Card>

          <Card title="Catatan">
            <ul className="space-y-2 text-xs text-muted">
              <li className="flex gap-2"><span className="text-success">•</span> Nilai ≥ 85 dihitung sangat baik.</li>
              <li className="flex gap-2"><span className="text-warn">•</span> Nilai 70 - 84 tergolong baik.</li>
              <li className="flex gap-2"><span className="text-danger">•</span> Nilai &lt; 70 perlu perbaikan.</li>
            </ul>
            <div className="mt-3">
              <Banner tone="info">Nilai Google Classroom diperbarui setiap sinkronisasi harian pukul 07.00.</Banner>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
