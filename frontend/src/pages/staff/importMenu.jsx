import { useStaff } from './staffStore';

export default function ImportMenu() {
  const { bulkResult, bulkText, exportCodesToCSV, exportedCodes, fetchPendingCodes, handleBulkImport, setBulkText } = useStaff();
  return (
<div className="space-y-4">
  <div className="card card-pad space-y-3">
    <h3 className="font-semibold text-ink">Import Siswa dari CSV</h3>
    <p className="text-xs text-muted">Format: NIS, NISN, Nama, Kelas (satu baris per siswa)</p>
    <textarea
      value={bulkText}
      onChange={(e) => setBulkText(e.target.value)}
      placeholder={"14707, 14707, Ahmad Reiza Fahmi, X-TKJ1\n14708, 14708, Aldhitya Ahmad Fahri, X-TKJ1"}
      className="input w-full font-mono h-40 resize-none"
    />
    <button
      onClick={handleBulkImport}
      className="btn-primary w-full py-2.5"
    >
      Import Sekarang
    </button>
    {bulkResult && (
      <div className="bg-success-soft text-success-ink px-4 py-3 rounded-lg text-sm">
        {bulkResult.message}
      </div>
    )}
    <p className="text-xs text-muted">Password default: 123456</p>
  </div>

  <div className="card card-pad space-y-3">
    <div className="flex items-center justify-between">
      <h3 className="font-semibold text-ink">Kode Aktivasi</h3>
      <div className="flex gap-2">
        <button
          onClick={fetchPendingCodes}
          className="btn-ghost px-3 py-1.5 text-xs"
        >
          Muat Semua
        </button>
        {exportedCodes.length > 0 && (
          <button
            onClick={exportCodesToCSV}
            className="btn-success px-3 py-1.5 text-xs"
          >
            Export CSV
          </button>
        )}
      </div>
    </div>

    {exportedCodes.length > 0 ? (
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr className="bg-surface2">
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted">Nama</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted">NISN</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted">Kode Siswa</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted">Kode Ortu</th>
            </tr>
          </thead>
          <tbody>
            {exportedCodes.map((c, i) => (
              <tr key={i} className="border-t border-line">
                <td className="px-3 py-2 text-xs">{c.nama}</td>
                <td className="px-3 py-2 text-xs font-mono">{c.nisn}</td>
                <td className="px-3 py-2 text-xs font-mono bg-success-soft">{c.studentCode}</td>
                <td className="px-3 py-2 text-xs font-mono bg-info-soft">{c.parentCode || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <p className="text-center text-muted text-sm py-4">
        Belum ada kode. Import siswa terlebih dahulu.
      </p>
    )}
  </div>
</div>
  );
}
