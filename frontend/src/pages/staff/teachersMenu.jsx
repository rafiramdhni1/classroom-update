import { useStaff } from './staffStore';
import { LoadingBlock } from '../../components/ui';

export default function TeachersMenu() {
  const { createTeacher, deleteTeacher, googleEmail, loadTeachers, setTeacherForm, teacherForm, teacherMsg, teachers, teachersLoading } = useStaff();
  return (
<div className="space-y-4">
  <div className="card card-pad space-y-3">
    <h3 className="font-semibold text-ink">Tambah Akun Guru</h3>
    <p className="text-xs text-muted">
      Setiap guru login dashboard dengan NISN &amp; password masing-masing, lalu menghubungkan akun Google sendiri.
    </p>
    <form onSubmit={createTeacher} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <input
        type="text"
        placeholder="Nama Guru"
        value={teacherForm.nama}
        onChange={(e) => setTeacherForm({ ...teacherForm, nama: e.target.value })}
        className="input"
        required
      />
      <input
        type="text"
        placeholder="NISN (username login)"
        value={teacherForm.nisn}
        onChange={(e) => setTeacherForm({ ...teacherForm, nisn: e.target.value })}
        className="input"
        required
      />
      <input
        type="text"
        placeholder="Password (default 123456)"
        value={teacherForm.password}
        onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })}
        className="input"
      />
      <button
        type="submit"
        className="btn-primary py-2.5"
      >
        Buat Akun Guru
      </button>
    </form>
    {teacherMsg && (
      <div className={`px-4 py-3 rounded-lg text-sm ${teacherMsg.ok ? 'bg-success-soft text-success-ink' : 'bg-danger-soft text-danger-ink'}`}>
        {teacherMsg.text}
      </div>
    )}
  </div>

  <div className="card card-pad space-y-3">
    <div className="flex items-center justify-between">
      <h3 className="font-semibold text-ink">Daftar Guru</h3>
      <button
        onClick={loadTeachers}
        disabled={teachersLoading}
        className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-50"
      >
        Muat Ulang
      </button>
    </div>
    {teachersLoading ? (
      <LoadingBlock label="Memuat akun guru..." hint="Mengambil daftar tenaga pengajar" className="min-h-[180px]" />
    ) : teachers.length === 0 ? (
      <p className="text-center text-muted text-sm py-4">Belum ada akun guru.</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr className="bg-surface2">
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted">Nama</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted">NISN</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted">Google Terhubung</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map(t => (
              <tr key={t.id} className="border-t border-line">
                <td className="px-3 py-2 text-xs font-medium text-ink">{t.nama}</td>
                <td className="px-3 py-2 text-xs font-mono">{t.nisn}</td>
                <td className="px-3 py-2 text-xs">
                  {t.hasGoogleAuth ? (
                    <span className="text-success">{t.googleEmail || 'Terhubung'}</span>
                  ) : (
                    <span className="text-muted">Belum</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">
                  <button
                    onClick={() => deleteTeacher(t.id)}
                    className="text-danger hover:text-danger"
                  >
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
</div>
  );
}
