import { useEffect, useState } from 'react';
import { useStudent } from '../pages/student/studentStore';
import api from '../utils/api';
import { Card, EmptyState, Badge, LoadingBlock } from './ui';
import { Progress } from './charts';
import Icon from './icons';

export function MissingTasksCard() {
  const { student } = useStudent();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function fetchMissing() {
      try {
        const res = await api.get('/dashboard/missing-tasks');
        if (mounted) {
          setData(res.data);
          setError('');
        }
      } catch (err) {
        if (mounted) setError('Gagal memuat data tugas kurang.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchMissing();
    return () => { mounted = false; };
  }, []);

  if (loading) return <LoadingBlock label="Memuat tugas kurang..." />;

  if (error) {
    return (
      <Card title="Tugas Belum Dikumpulkan" pad={false}>
        <EmptyState icon="alert" title="Gagal memuat" desc={error} />
      </Card>
    );
  }

  if (!data || data.missing.length === 0) {
    return (
      <Card title="Tugas Belum Dikumpulkan">
        <EmptyState icon="check" title="Tidak ada tugas kurang" desc="Semua tugas sudah terkumpul atau dinilai." />
      </Card>
    );
  }

  const { missing, summary } = data;

  const overdue = missing.filter(t => t.overdue);
  const dueSoon = missing.filter(t => !t.overdue && t.daysUntilDue !== null && t.daysUntilDue <= 3);
  const noDueDate = missing.filter(t => !t.hasDueDate);

  const getStatusBadge = (task) => {
    if (task.overdue) return <Badge tone="danger">Terlambat</Badge>;
    if (!task.hasDueDate) return <Badge tone="warn">Tanpa batas waktu</Badge>;
    if (task.daysUntilDue !== null && task.daysUntilDue <= 3) return <Badge tone="warn">{task.daysUntilDue} hari</Badge>;
    return <Badge tone="info">{task.daysUntilDue} hari</Badge>;
  };

  return (
    <Card title="Tugas Belum Dikumpulkan" pad={false}>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 p-4 border-b border-line/80">
        <div className="text-center">
          <p className="section-title">Total</p>
          <p className="mt-1 text-xl font-extrabold text-ink">{summary.total}</p>
        </div>
        <div className="text-center">
          <p className="section-title">Terlambat</p>
          <p className="mt-1 text-xl font-extrabold text-danger">{summary.overdue}</p>
        </div>
        <div className="text-center">
          <p className="section-title">≤ 3 Hari</p>
          <p className="mt-1 text-xl font-extrabold text-warn">{summary.dueSoon}</p>
        </div>
        <div className="text-center">
          <p className="section-title">Tanpa Batas Waktu</p>
          <p className="mt-1 text-xl font-extrabold text-muted">{summary.noDueDate}</p>
        </div>
      </div>

      <div className="p-4 border-b border-line/80">
        <Progress
          label={`Terkumpul: ${missing.filter(t => !t.overdue && t.hasDueDate).length} / ${summary.total}`}
          value={missing.filter(t => !t.overdue && t.hasDueDate).length}
          max={Math.max(1, summary.total)}
          tone="success"
        />
      </div>

      <ul className="divide-y divide-line p-4 max-h-96 overflow-y-auto">
        {missing
          .sort((a, b) => {
            if (a.overdue && !b.overdue) return -1;
            if (!a.overdue && b.overdue) return 1;
            if (a.daysUntilDue !== null && b.daysUntilDue !== null) return a.daysUntilDue - b.daysUntilDue;
            if (a.hasDueDate && !b.hasDueDate) return -1;
            if (!a.hasDueDate && b.hasDueDate) return 1;
            return 0;
          })
          .map(t => (
            <li key={t.id} className="flex items-start justify-between gap-3 p-3 hover:bg-surface2 rounded-xl transition">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <Badge tone="accent" size="sm">{t.subject}</Badge>
                  <Badge tone="neutral" size="sm">{t.workType}</Badge>
                  {getStatusBadge(t)}
                </div>
                <p className="truncate text-sm font-semibold text-ink">{t.title}</p>
                <p className="text-[11px] text-muted">{t.courseName}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-right">
                {t.hasDueDate && (
                  <p className="text-xs font-semibold text-ink whitespace-nowrap">
                    {new Date(t.dueDate).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                    <span className="ml-1 font-normal text-muted">
                      {new Date(t.dueDate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </p>
                )}
                {t.overdue && (
                  <span className="badge-danger shrink-0">LEWAT</span>
                )}
              </div>
            </li>
          ))}
      </ul>
    </Card>
  );
}

export default MissingTasksCard;