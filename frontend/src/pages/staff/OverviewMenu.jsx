import { useEffect, useState } from 'react';
import api from '../../utils/api';
import { useStaff } from './staffStore';
import { Card, Stat, Section, LoadingBlock, PageHeader, EmptyState, ScoreBadge } from '../../components/ui';
import { ColumnChart, Donut, LineChart, BarList, Progress } from '../../components/charts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export default function OverviewMenu() {
  const { stats, isAdmin } = useStaff();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api.get('/analytics/overview')
      .then(res => alive && setData(res.data))
      .catch(() => alive && setError('Gagal memuat analitik.'));
    return () => { alive = false; };
  }, []);

  if (error) {
    return (
      <EmptyState
        icon="monitoring"
        title="Analitik belum tersedia"
        desc={error}
        action={<button className="btn-soft" onClick={() => window.location.reload()}>Muat ulang</button>}
      />
    );
  }
  if (!data) return <LoadingBlock label="Menyiapkan analitik..." />;

  const { totals, perKelas, perSubject, distribution, trend, topStudents, activity } = data;

  return (
    <div className="space-y-5 animate-fadeUp">
      <PageHeader
        eyebrow="Dashboard"
        title="Ringkasan Akademik"
        subtitle={`Diperbarui ${new Date(data.generatedAt).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}`}
        actions={<span className="hero-chip">Live analytics</span>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total Siswa" value={stats?.totalStudents ?? totals.totalStudents} icon="students" tone="accent" hint="siswa aktif" />
        <Stat label="Teraktivasi" value={stats?.activatedChats ?? totals.activatedChats} icon="link" tone="success" hint="chat Telegram aktif" />
        <Stat label="Kode Pending" value={stats?.pendingCodes ?? totals.pendingCodes} icon="key" tone="warn" hint="belum dipakai" />
        <Stat label="Rata-rata" value={totals.overallAverage ?? '-'} icon="star" tone="info" hint="rata-rata seluruh siswa" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Rata-rata per Kelas" className="lg:col-span-2">
          <ColumnChart
            height={170}
            data={perKelas.map(k => ({
              label: k.kelas.replace('-TKJ', ''),
              value: k.average ?? 0,
              display: k.average === null ? 'n/a' : k.average.toFixed(1),
              color: k.average >= 85 ? 'rgb(var(--c-success))' : k.average >= 75 ? 'rgb(var(--c-warn))' : 'rgb(var(--c-danger))',
            }))}
          />
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3 sm:grid-cols-3">
            {perKelas.map(k => (
              <div key={k.kelas} className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-ink">{k.kelas}</span>
                <span className="text-muted">{k.graded}/{k.students} dinilai</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Distribusi Nilai">
          <Donut
            size={140}
            centerLabel="Siswa"
            centerValue={totals.totalStudents}
            data={[
              { label: '90 - 100', value: distribution[0].count, color: 'rgb(var(--c-success))' },
              { label: '80 - 89', value: distribution[1].count, color: 'rgb(var(--c-accent))' },
              { label: '70 - 79', value: distribution[2].count, color: 'rgb(var(--c-warn))' },
              { label: '< 70', value: distribution[3].count, color: 'rgb(var(--c-danger))' },
              { label: 'Belum dinilai', value: distribution[4].count, color: 'rgb(var(--c-muted) / 0.45)' },
            ]}
          />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Rata-rata per Mata Pelajaran">
          <BarList
            suffix=" pts"
            data={perSubject.map(s => ({
              label: s.subject,
              value: s.average ?? 0,
              display: s.average === null ? 'belum ada' : `${s.average.toFixed(1)}`,
            }))}
          />
        </Card>

        <Card title="Tren Nilai Manual">
          {trend.length ? (
            <LineChart
              suffix=""
              points={trend.map(t => ({
                label: MONTHS[Number(t.month.slice(5, 7)) - 1],
                value: t.average,
              }))}
            />
          ) : (
            <EmptyState icon="chart" title="Belum ada data tren" desc="Nilai manual yang diinput akan muncul di sini." />
          )}
          <p className="mt-3 border-t border-line pt-3 text-[11px] text-muted">
            Rata-rata nilai yang diinput manual, dikelompokkan per bulan.
          </p>
        </Card>

        <Card title="Top 10 Siswa" pad={false}>
          <ul className="divide-y divide-line">
            {topStudents.map(s => (
              <li key={s.nis} className="flex items-center gap-3 px-4 py-2.5">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-extrabold ${
                  s.rank <= 3 ? 'bg-warn-soft text-warn-ink' : 'bg-surface2 text-muted'
                }`}>{s.rank}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{s.nama}</span>
                  <span className="block text-[11px] text-muted">{s.kelas} • {s.nis}</span>
                </span>
                <ScoreBadge score={s.average} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Aktivitas 7 Hari Terakhir">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Siswa baru', value: activity.newStudents7d, icon: 'students' },
              { label: 'Nilai diinput', value: activity.newGrades7d, icon: 'grades' },
              { label: 'Pesan dikirim', value: activity.newMessages7d, icon: 'messages' },
              { label: 'Kode dibuat', value: activity.newCodes7d, icon: 'codes' },
            ].map(a => (
              <div key={a.label} className="rounded-xl border border-line/80 bg-surface2/70 p-3">
                <p className="section-title">{a.label}</p>
                <p className="mt-1 text-xl font-extrabold text-ink">{a.value}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Pesan Terbaru"
          actions={isAdmin ? <span className="badge-accent">{activity.messages.length} pesan</span> : null}
        >
          {activity.messages.length === 0 ? (
            <EmptyState icon="messages" title="Belum ada pesan" desc="Pesan yang dikirim ke siswa akan tampil di sini." />
          ) : (
            <ul className="space-y-2.5">
              {activity.messages.map(m => (
                <li key={m.id} className="rounded-xl border border-line/80 bg-surface/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-sm font-semibold text-ink">{m.title}</p>
                    <span className={m.priority === 'urgent' || m.priority === 'high' ? 'badge-danger' : 'badge-neutral'}>
                      {m.priority}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <Progress
                      value={m.readCount}
                      max={Math.max(1, totals.totalStudents)}
                      tone="success"
                      label={`Dibaca ${m.readCount} siswa`}
                      right={`${Math.round((m.readCount / Math.max(1, totals.totalStudents)) * 100)}%`}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted">
                    {new Date(m.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Section title="Distribusi per Kelas">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {perKelas.map(k => (
            <Card key={k.kelas} pad hover>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-ink">{k.kelas}</p>
                <span className={k.average >= 85 ? 'badge-success' : k.average >= 75 ? 'badge-warn' : 'badge-danger'}>
                  {k.average === null ? 'belum' : k.average.toFixed(1)}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                <Progress label="Sudah dinilai" value={k.graded} max={k.students} right={`${k.graded}/${k.students}`} />
                <div className="flex gap-1">
                  {[
                    { n: k.dist.a, c: 'bg-success' },
                    { n: k.dist.b, c: 'bg-accent' },
                    { n: k.dist.c, c: 'bg-warn' },
                    { n: k.dist.d, c: 'bg-danger' },
                    { n: k.dist.belum, c: 'bg-muted/40' },
                  ].map((seg, i) => (
                    <span
                      key={i}
                      className={`h-1.5 flex-1 rounded-full ${seg.c}`}
                      style={{ flexGrow: Math.max(1, seg.n) }}
                      title={`${seg.n} siswa`}
                    />
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Section>
    </div>
  );
}
