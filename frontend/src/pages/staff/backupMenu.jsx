import { useStaff } from './staffStore';

export default function BackupMenu() {
  const { backups, createBackupNow, creatingBackup, deleteBackupNow, restoreBackupNow } = useStaff();
  return (
<div className="space-y-4">
  <div className="card card-pad space-y-3">
    <h3 className="font-semibold text-ink">Backup Database</h3>
    <p className="text-xs text-muted">Backup otomatis setiap jam 02:00. Manual backup juga tersedia.</p>
    <button
      onClick={createBackupNow}
      disabled={creatingBackup}
      className="btn-primary w-full py-2.5"
    >
      {creatingBackup ? 'Membuat Backup...' : 'Backup Sekarang'}
    </button>
  </div>

  <div className="space-y-2">
    <h3 className="text-sm font-semibold text-muted uppercase">Riwayat Backup</h3>
    {backups.length === 0 ? (
      <p className="text-center text-muted text-sm py-4">Belum ada backup.</p>
    ) : (
      backups.map(b => (
        <div key={b.name} className="row-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm text-ink">{b.name}</p>
              <p className="text-xs text-muted">
                {b.collections?.length || 0} koleksi • {new Date(b.createdAt).toLocaleString('id-ID')}
              </p>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => restoreBackupNow(b.name)}
                className="btn-warn px-2 py-1 text-xs"
              >
                Restore
              </button>
              <button
                onClick={() => deleteBackupNow(b.name)}
                className="btn-danger px-2 py-1 text-xs"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      ))
    )}
  </div>
</div>
  );
}
