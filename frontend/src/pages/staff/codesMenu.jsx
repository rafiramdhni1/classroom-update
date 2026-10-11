import { useStaff } from './staffStore';

export default function CodesMenu() {
  const { bulkGenerateCodes, codes } = useStaff();
  return (
<div>
  <div className="flex gap-2 mb-4">
    <button
      onClick={() => bulkGenerateCodes('student')}
      className="btn-primary flex-1 py-2.5"
    >
      Generate Semua (Siswa)
    </button>
    <button
      onClick={() => bulkGenerateCodes('parent')}
      className="flex-1 bg-success text-white py-2 rounded-lg text-sm font-medium hover:brightness-95"
    >
      Generate Semua (Ortu)
    </button>
  </div>

  <div className="space-y-2">
    {codes.length === 0 ? (
      <p className="text-center text-muted text-sm py-8">Belum ada kode aktivasi.</p>
    ) : (
      codes.slice(0, 100).map(c => (
        <div key={c._id} className="row-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-sm font-bold text-ink">{c.code}</p>
              <p className="text-xs text-muted">
                {c.studentId?.nama} - {c.studentId?.kelas} ({c.chatType === 'parent' ? 'Orang Tua' : 'Siswa'})
              </p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${
              c.isUsed ? 'bg-surface2 text-muted' :
              new Date(c.expiresAt) < new Date() ? 'bg-danger-soft text-danger' :
              'bg-success-soft text-success'
            }`}>
              {c.isUsed ? 'Terpakai' : new Date(c.expiresAt) < new Date() ? 'Kadaluarsa' : 'Aktif'}
            </span>
          </div>
        </div>
      ))
    )}
  </div>
</div>
  );
}
