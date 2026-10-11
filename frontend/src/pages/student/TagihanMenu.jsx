import { useMemo, useState } from 'react';
import { useStudent } from './studentStore';
import { Card, PageHeader, Stat, LoadingBlock, EmptyState, Tabs, ScoreBadge } from '../../components/ui';
import Icon from '../../components/icons';

const WORK_LABEL = {
  ASSIGNMENT: 'Tugas',
  QUIZ: 'Kuis',
  SHORT_ANSWER_QUESTION: 'Jawaban singkat',
  MATERIAL: 'Materi',
  POST: 'Diskusi',
};

const STATE_LABEL = {
  NEW: 'Belum dikerjakan',
  CREATED: 'Draf tersimpan',
  TURNED_IN: 'Sudah dikumpulkan',
  RETURNED: 'Sudah dinilai',
  RECLAIMED: 'Ditarik guru',
  STUDENT_EDITED: 'Revisi siswa',
};

const invNo = (id) => `INV-${String(id).slice(-6).toUpperCase()}`;

function dueInfo(dueDate) {
  const due = new Date(dueDate);
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((startOfDay(due) - startOfDay(now)) / 86400000);
  if (Number.isNaN(diff)) return { text: 'Tanpa batas waktu', tone: 'neutral', days: 0 };
  if (diff < 0) return { text: `Lewat ${Math.abs(diff)} hari`, tone: 'danger', days: diff };
  if (diff === 0) return { text: 'Jatuh tempo hari ini', tone: 'warn', days: 0 };
  if (diff <= 3) return { text: `${diff} hari lagi`, tone: 'warn', days: diff };
  return { text: `${diff} hari lagi`, tone: 'neutral', days: diff };
}

const STAMP = {
  lunas: 'border-success/60 bg-success-soft/70 text-success-ink',
  telat: 'border-danger/60 bg-danger-soft/70 text-danger-ink',
  belum: 'border-warn/60 bg-warn-soft/70 text-warn-ink',
};

export default function TagihanMenu() {
  const { bills, billsOpen, isBillLunas, student } = useStudent();
  const [filter, setFilter] = useState('semua');

  const all = useMemo(() => bills?.tasks || [], [bills]);

  const stats = useMemo(() => {
    let lunas = 0;
    let telat = 0;
    let jatuhTempo = 0;
    all.forEach(t => {
      if (isBillLunas(t)) {
        lunas += 1;
        return;
      }
      if (t.overdue) telat += 1;
      else if (dueInfo(t.dueDate).days <= 3) jatuhTempo += 1;
    });
    return { lunas, telat, jatuhTempo, total: all.length };
  }, [all, isBillLunas]);

  const list = useMemo(() => {
    const open = (t) => !isBillLunas(t);
    let arr = all;
    if (filter === 'belum') arr = all.filter(t => open(t) && !t.overdue);
    else if (filter === 'telat') arr = all.filter(t => open(t) && t.overdue);
    else if (filter === 'lunas') arr = all.filter(t => !open(t));
    else if (filter === 'dikerjakan') arr = all.filter(t => open(t) && t.state === 'CREATED');
    return [...arr].sort((a, b) => {
      const ao = open(a) ? 0 : 1;
      const bo = open(b) ? 0 : 1;
      if (ao !== bo) return ao - bo;
      if (open(a) && a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
  }, [all, filter, isBillLunas]);

  if (!bills) return <LoadingBlock label="Menyiapkan tagihan tugas..." />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Rincian tagihan"
        title="Tagihan Tugas"
        subtitle={`Daftar tugas ${student?.kelas ? `kelas ${student.kelas} ` : ''}yang masih harus dikerjakan beserta status pelunasan.`}
        actions={
          <span className="hero-chip">
            <Icon name="receipt" className="h-4 w-4" />
            {billsOpen} belum lunas
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total Tagihan" value={stats.total} hint="tugas tercatat" icon="receipt" tone="info" />
        <Stat label="Belum Lunas" value={billsOpen} hint="perlu dikerjakan" icon="clock" tone="warn" />
        <Stat label="Terlambat" value={stats.telat} hint="lewat tenggat" icon="bell" tone="danger" />
        <Stat label="Sudah Lunas" value={stats.lunas} hint="terkumpul/dinilai" icon="check" tone="success" />
      </div>

      <Tabs
        items={[
          { key: 'semua', label: `Semua (${stats.total})` },
          { key: 'belum', label: 'Belum' },
          { key: 'telat', label: `Terlambat (${stats.telat})` },
          { key: 'dikerjakan', label: 'Dikerjakan' },
          { key: 'lunas', label: `Lunas (${stats.lunas})` },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {list.length === 0 ? (
        <EmptyState
          icon="receipt"
          title={filter === 'lunas' ? 'Belum ada tagihan lunas' : 'Semua tagihan lunas'}
          desc={
            filter === 'lunas'
              ? 'Tagihan yang sudah dikumpulkan atau dinilai akan muncul di sini.'
              : 'Kerjakan tugas tepat waktu supaya tagihanmu selalu lunas.'
          }
        />
      ) : (
        <div className="space-y-3">
          {list.map(t => {
            const lunas = isBillLunas(t);
            const due = dueInfo(t.dueDate);
            const stampKey = lunas ? 'lunas' : t.overdue ? 'telat' : 'belum';
            const stampText = lunas ? 'Lunas' : t.overdue ? 'Terlambat' : 'Belum Lunas';
            return (
              <Card key={t.id} pad={false} hover className="relative overflow-hidden">
                <div className="flex items-start gap-3 p-4">
                  <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-accent ring-1 ring-accent/30">
                    <Icon name={lunas ? 'check' : t.workType === 'QUIZ' ? 'edit' : 'receipt'} className="h-5 w-5" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="chip font-mono tracking-wider text-accent">{invNo(t.id)}</span>
                      <span className="badge-accent">{t.subject}</span>
                      <span className="badge-neutral">{WORK_LABEL[t.workType] || t.workType}</span>
                    </div>
                    <p className="mt-1.5 truncate text-sm font-bold text-ink">{t.title}</p>
                    <p className="truncate text-[11px] text-muted">{t.courseName}</p>
                  </div>

                  <span
                    className={`shrink-0 select-none rounded-lg border-2 px-2 py-1 font-display text-[10px] font-extrabold uppercase tracking-[0.18em] animate-stamp ${STAMP[stampKey]}`}
                    style={{ transform: 'rotate(-9deg)' }}
                  >
                    {stampText}
                  </span>
                </div>

                <div className="divider-dash mx-4" />

                <div className="grid grid-cols-2 gap-3 px-4 py-3 sm:grid-cols-4">
                  <div>
                    <p className="section-title">Tenggat</p>
                    <p className="mt-0.5 text-xs font-bold text-ink">
                      {new Date(t.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <p className={`text-[11px] font-semibold ${
                      due.tone === 'danger' ? 'text-danger' : due.tone === 'warn' ? 'text-warn' : 'text-muted'
                    }`}>
                      {lunas ? 'Sudah dikumpulkan' : due.text}
                    </p>
                  </div>

                  <div>
                    <p className="section-title">Status</p>
                    <p className="mt-0.5 text-xs font-bold text-ink">{lunas ? 'Lunas' : 'Belum lunas'}</p>
                    <p className="truncate text-[11px] text-muted">{STATE_LABEL[t.state] || t.state}</p>
                  </div>

                  <div>
                    <p className="section-title">Diterbitkan</p>
                    <p className="mt-0.5 text-xs font-bold text-ink">
                      {new Date(t.postedAt || t.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </p>
                    <p className="text-[11px] text-muted">{lunas && t.submittedAt
                      ? `Dikumpulkan ${new Date(t.submittedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`
                      : 'Belum ada kiriman'}</p>
                  </div>

                  <div className="text-right">
                    <p className="section-title">Nilai</p>
                    <div className="mt-1">
                      {t.isGraded ? <ScoreBadge score={t.grade} /> : <span className="badge-neutral">—</span>}
                    </div>
                    <p className="text-[11px] text-muted">{t.isGraded ? 'sudah dinilai' : 'belum dinilai'}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-center text-[11px] text-muted">
        Tagihan dihitung dari tugas Google Classroom 90 hari terakhir hingga 120 hari ke depan.
      </p>
    </div>
  );
}
