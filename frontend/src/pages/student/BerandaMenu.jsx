import { useStudent } from './studentStore';
import { Card, Stat, ScoreBadge, Avatar, EmptyState } from '../../components/ui';
import { BarList, Progress, Sparkline } from '../../components/charts';
import { MissingTasksCard } from '../../components/MissingTasksCard';
import Icon from '../../components/icons';

const SUBJECT_LABELS = {
  ASJ: 'Administrasi Sistem Jaringan',
  AIJ: 'Administrasi Infrastruktur Jaringan',
  TJBL: 'Tata Jaringan Berbasis Luas',
  PKDK: 'Pemodelan dan Komunikasi Data',
  TJKT: 'Teknologi Jaringan Komputer dan Telekomunikasi',
};

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
}

export default function BerandaMenu() {
  const { data, student, setTab, unread, overdue, tasks, isRead, markAsRead, adminContact, billsOpen, missingTasksSummary } = useStudent();

  const subjects = Object.entries(data?.subjectGrades || {});
  const recent = (data?.messages || []).slice(0, 3);
  const upcoming = (tasks?.tasks || []).filter(t => !t.isGraded).slice(0, 3);

  return (
    <div className="space-y-5 animate-fadeUp">
      {/* Hero */}
      <div className="hero p-5 sm:p-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{ backgroundImage: 'radial-gradient(rgb(255 255 255 / 0.22) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />
        <div className="pointer-events-none absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-black/15 blur-2xl" />
        <div className="relative z-[1] flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="hero-eyebrow">{greeting()}</p>
            <h1 className="hero-title truncate">{student?.nama || 'Siswa'}</h1>
            <p className="mt-1 text-sm text-white/85">
              {student?.kelas} • Angkatan {student?.angkatan}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => setTab('peringkat')} className="hero-chip">
                <Icon name="trophy" className="h-4 w-4" />
                Peringkat {data?.classRank?.rank || '-'}
              </button>
              <button onClick={() => setTab('tagihan')} className="hero-chip">
                <Icon name="receipt" className="h-4 w-4" />
                {billsOpen} tagihan
              </button>
              <button onClick={() => setTab('tugas')} className="hero-chip">
                <Icon name="calendar" className="h-4 w-4" />
                {overdue} tugas terlambat
              </button>
              <button onClick={() => setTab('pesan')} className="hero-chip">
                <Icon name="bell" className="h-4 w-4" />
                {unread} pesan baru
              </button>
            </div>
          </div>
          <Avatar name={student?.nama || 'S'} className="hidden h-14 w-14 text-lg bg-white/25 text-white ring-white/50 sm:grid avatar-on-brand" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Peringkat Kelas"
          value={data?.classRank?.rank || '-'}
          hint={`dari ${data?.classRank?.total || 0} siswa`}
          icon="ranking"
          tone="accent"
        />
        <Stat
          label="Peringkat Angkatan"
          value={data?.angkatanRank?.rank || '-'}
          hint={`dari ${data?.angkatanRank?.total || 0} siswa`}
          icon="trophy"
          tone="warn"
        />
        <Stat
          label="Rata-rata"
          value={data?.overallAverage !== null && data?.overallAverage !== undefined ? data.overallAverage.toFixed(1) : '-'}
          hint="skala 0 - 100"
          icon="star"
          tone="success"
        />
        <Stat
          label="Belum Dinilai"
          value={subjects.reduce((acc, [, v]) => acc + (v.totalAssignments - v.gradedCount), 0)}
          hint="komponen nilai"
          icon="clock"
          tone="danger"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Nilai per Mata Pelajaran"
          actions={<button onClick={() => setTab('nilai')} className="btn-ghost px-3 py-1.5 text-xs">Lihat semua</button>}
        >
          {subjects.length === 0 ? (
            <EmptyState icon="chart" title="Belum ada nilai" desc="Nilai akan muncul setelah guru menginput." />
          ) : (
            <BarList
              suffix=" pts"
              data={subjects.map(([alias, info]) => ({
                label: `${alias} • ${SUBJECT_LABELS[alias] || alias}`,
                value: info.average ?? 0,
                display: info.average === null ? 'belum' : info.average.toFixed(1),
                color:
                  (info.average ?? 0) >= 85
                    ? 'rgb(var(--c-success))'
                    : (info.average ?? 0) >= 70
                      ? 'rgb(var(--c-warn))'
                      : 'rgb(var(--c-danger))',
              }))}
            />
          )}
          <div className="mt-4 rounded-xl border border-line/80 bg-surface2/70 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink">Rata-rata keseluruhan</span>
              <ScoreBadge score={data?.overallAverage} />
            </div>
            <div className="mt-2">
              <Progress value={data?.overallAverage || 0} max={100} tone="accent" />
            </div>
          </div>
        </Card>

        <Card
          title="Tugas Terdekat"
          actions={<button onClick={() => setTab('tugas')} className="btn-ghost px-3 py-1.5 text-xs">Kalender</button>}
          pad={false}
        >
          {upcoming.length === 0 ? (
            <EmptyState icon="calendar" title="Tidak ada tugas" desc="Semua tugas sudah dinilai." />
          ) : (
            <ul className="divide-y divide-line">
              {upcoming.map(t => (
                <li key={t.id} className="flex items-start gap-3 p-4">
                  <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${t.overdue ? 'bg-danger' : 'bg-accent'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{t.title}</p>
                    <p className="text-[11px] text-muted">
                      {t.subject} • {new Date(t.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <span className={t.overdue ? 'badge-danger' : 'badge-neutral'}>
                    {t.overdue ? 'Telat' : 'Menunggu'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <MissingTasksCard />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          pad={false}
          title="Pesan dari Admin"
          actions={<button onClick={() => setTab('pesan')} className="btn-ghost px-3 py-1.5 text-xs">Inbox</button>}
        >
          {recent.length === 0 ? (
            <EmptyState icon="messages" title="Belum ada pesan" desc="Pengumuman dari admin akan tampil di sini." />
          ) : (
            <ul className="divide-y divide-line">
              {recent.map(msg => {
                const read = isRead(msg);
                return (
                  <li
                    key={msg._id}
                    onClick={() => !read && markAsRead(msg._id)}
                    className={`flex cursor-pointer items-start gap-3 p-4 transition hover:bg-surface2 ${read ? '' : 'bg-accent-soft/50'}`}
                  >
                    <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                      msg.priority === 'urgent' ? 'bg-danger-soft text-danger' : msg.priority === 'high' ? 'bg-warn-soft text-warn' : 'bg-accent-soft text-accent'
                    }`}>
                      <Icon name="bell" className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="min-w-0 truncate text-sm font-bold text-ink">{msg.title}</p>
                        {!read && <span className="badge-accent shrink-0">Baru</span>}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted">{msg.content}</p>
                      <p className="mt-1 text-[11px] text-muted/80">
                        {new Date(msg.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Progres Tugas">
          <div className="space-y-4">
            <div className="rounded-xl border border-line/80 bg-surface/60 p-3">
              <p className="section-title">Tenggat 7 hari</p>
              <p className="mt-1 text-2xl font-extrabold text-info">{tasks?.summary?.dueThisWeek ?? 0}</p>
              <div className="mt-2">
                <Progress value={tasks?.summary?.dueThisWeek ?? 0} max={Math.max(1, tasks?.summary?.total ?? 1)} tone="info" />
              </div>
            </div>
            <div className="rounded-xl border border-line/80 bg-surface/60 p-3">
              <p className="section-title">Terlambat</p>
              <p className="mt-1 text-2xl font-extrabold text-danger">{overdue}</p>
              <div className="mt-2">
                <Progress value={overdue} max={Math.max(1, tasks?.summary?.total ?? 1)} tone="danger" />
              </div>
            </div>
            <div className="rounded-xl border border-line/80 bg-surface/60 p-3">
              <p className="section-title">Nilai terakhir</p>
              <div className="mt-2">
                <Sparkline
                  height={44}
                  values={subjects.map(([, v]) => v.average || 0)}
                />
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="row-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-success-soft text-success">
            <Icon name="messages" className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold text-ink">Butuh bantuan?</p>
            <p className="text-xs text-muted">Hubungi Admin Sekolah via WhatsApp</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="https://wa.me/6288233182147?text=Halo%20Admin%2C%20saya%20ingin%20bertanya%20tentang%20sistem%20akademik."
            target="_blank"
            rel="noopener noreferrer"
            className="btn-soft px-3 py-1.5 text-xs inline-flex items-center gap-1.5 font-semibold text-accent hover:bg-accent/10 border-line"
          >
            <Icon name="chat" className="h-3.5 w-3.5 text-success" />
            <span>Admin 1 (0882-3318-2147)</span>
          </a>
          <a
            href="https://wa.me/6285641408175?text=Halo%20Admin%2C%20saya%20ingin%20bertanya%20tentang%20sistem%20akademik."
            target="_blank"
            rel="noopener noreferrer"
            className="btn-soft px-3 py-1.5 text-xs inline-flex items-center gap-1.5 font-semibold text-accent hover:bg-accent/10 border-line"
          >
            <Icon name="chat" className="h-3.5 w-3.5 text-success" />
            <span>Admin 2 (0856-4140-8175)</span>
          </a>
        </div>
      </div>
    </div>
  );
}
