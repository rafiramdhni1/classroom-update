import { useEffect, useState } from 'react';
import api from '../../utils/api';
import { useStudent } from './studentStore';
import { Card, Tabs, LoadingBlock, EmptyState, Avatar, ScoreBadge, PageHeader } from '../../components/ui';
import Icon from '../../components/icons';

const SCOPES = [
  { key: 'class', label: 'Se-Kelas' },
  { key: 'angkatan', label: 'Se-Angkatan' },
  { key: 'school', label: 'Sekolah' },
];

const MEDAL = ['bg-warn text-white', 'bg-muted/40 text-ink', 'bg-warn/60 text-white'];

export default function RankMenu() {
  const { student } = useStudent();
  const [scope, setScope] = useState('class');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setData(null);
    api.get(`/analytics/leaderboard?scope=${scope}&limit=50`)
      .then(res => alive && setData(res.data))
      .catch(() => alive && setError('Gagal memuat peringkat.'));
    return () => { alive = false; };
  }, [scope]);

  if (error) return <EmptyState icon="trophy" title="Peringkat tidak tersedia" desc={error} />;
  if (!data) return <LoadingBlock label="Menghitung peringkat..." />;

  const { entries, me, total } = data;

  return (
    <div className="space-y-5 animate-fadeUp">
      <PageHeader
        eyebrow="Kompetisi kelas"
        title="Peringkat"
        subtitle="Diurutkan berdasarkan rata-rata seluruh komponen nilai."
      />

      <Tabs items={SCOPES} value={scope} onChange={setScope} />

      <div className="relative overflow-hidden rounded-[24px] border border-accent/35 bg-brand-soft p-5">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={me?.nama || student?.nama || '?'} className="h-14 w-14 text-lg" />
            <div>
              <p className="section-title">Posisi Kamu</p>
              <p className="text-lg font-extrabold text-ink">{me?.nama || student?.nama || '-'}</p>
              <p className="text-xs text-muted">{me?.kelas || student?.kelas}</p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-center">
            <div>
              <p className="text-3xl font-extrabold text-accent">{me?.rank ?? '-'}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Peringkat</p>
            </div>
            <div className="h-10 w-px bg-line" />
            <div>
              <p className="text-3xl font-extrabold text-ink">{me?.average != null ? me.average.toFixed(1) : '-'}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Rata-rata</p>
            </div>
            <div className="h-10 w-px bg-line" />
            <div>
              <p className="text-3xl font-extrabold text-ink">{total}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Peserta</p>
            </div>
          </div>
        </div>
      </div>

      <Card pad={false}>
        {entries.length === 0 ? (
          <EmptyState icon="trophy" title="Belum ada data" desc="Belum ada siswa yang dinilai pada lingkup ini." />
        ) : (
          <ul className="divide-y divide-line">
            {entries.map((e, i) => (
              <li
                key={e.nis + i}
                className={`flex items-center gap-3 px-4 py-3 transition ${e.isMe ? 'bg-accent-soft' : 'hover:bg-surface2'}`}
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-extrabold ${
                  e.rank <= 3 ? MEDAL[e.rank - 1] : 'bg-surface2 text-muted'
                }`}>
                  {e.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-bold text-ink">
                    {e.nama}
                    {e.isMe && <span className="badge-accent">Kamu</span>}
                  </p>
                  <p className="truncate text-[11px] text-muted">{e.kelas} • NIS {e.nis}</p>
                </div>
                <div className="hidden w-24 shrink-0 sm:block">
                  <ScoreBadge score={e.average} />
                </div>
                <Icon name={e.rank <= 3 ? 'trophy' : 'star'} className={`h-4 w-4 shrink-0 ${e.rank <= 3 ? 'text-warn' : 'text-muted/60'}`} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-center text-[11px] text-muted">
        Menampilkan {entries.length} dari {total} siswa • Peringkat dihitung ulang setiap nilai diperbarui.
      </p>
    </div>
  );
}
