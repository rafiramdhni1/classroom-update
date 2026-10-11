import { useState } from 'react';
import { useStaff } from './staffStore';
import Icon from '../../components/icons';

export default function StudentsMenu() {
  const {
    KELAS_LIST,
    deleteStudent,
    editStudent,
    editingStudent,
    setEditingStudent,
    editForm,
    setEditForm,
    saveStudent,
    filterKelas,
    filteredStudents,
    generateCode,
    generatingCode,
    handleSearch,
    page,
    searchInput,
    setFilterKelas,
    setPage,
    totalPages,
    classroomStatus,
    setClassroomStatus,
    classroomStats,
    unlinkedRoster,
    unlinkedRosterLoading,
    loadUnlinkedRoster,
  } = useStaff();

  const [saving, setSaving] = useState(false);
  const [showRosterPicker, setShowRosterPicker] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');

  const editingName = (editingStudent?.nama || '').toLowerCase();
  const nameParts = editingName.split(/\s+/).filter((p) => p.length >= 3);

  const processedRoster = unlinkedRoster.map((r) => {
    const rName = (r.nama || '').toLowerCase();
    const rEmail = (r.email || '').toLowerCase();
    const isExactMatch = editingName && (rName.includes(editingName) || editingName.includes(rName));
    const partialMatch = nameParts.length > 0 && nameParts.some((p) => rName.includes(p) || rEmail.includes(p));
    return {
      ...r,
      isMatch: isExactMatch || partialMatch,
      priority: isExactMatch ? 2 : partialMatch ? 1 : 0,
    };
  });

  const displayRoster = processedRoster
    .filter((r) => {
      if (!rosterSearch) return true;
      const q = rosterSearch.toLowerCase();
      return (
        (r.nama || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q) ||
        r.userId.includes(q)
      );
    })
    .sort((a, b) => b.priority - a.priority || a.nama.localeCompare(b.nama));

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveStudent();
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEdit = (student, focusClassroom = false) => {
    editStudent(student);
    setShowRosterPicker(focusClassroom);
    setRosterSearch('');
  };

  return (
    <div className="space-y-4">
      {/* Kartu Ringkasan Status Classroom */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div
          onClick={() => { setClassroomStatus(''); setPage(1); }}
          className={`card card-pad cursor-pointer transition hover:border-accent/40 ${
            classroomStatus === '' ? 'ring-2 ring-accent/60 bg-accent/5' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Total Siswa</p>
              <p className="text-2xl font-extrabold text-ink mt-1">{classroomStats.total || 0}</p>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-surface2 flex items-center justify-center text-muted">
              <Icon name="students" className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[11px] text-muted mt-2">Semua siswa aktif di database</p>
        </div>

        <div
          onClick={() => { setClassroomStatus('unlinked'); setPage(1); }}
          className={`card card-pad cursor-pointer transition hover:border-danger/40 ${
            classroomStatus === 'unlinked' ? 'ring-2 ring-danger/70 bg-danger/5' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-danger">Belum Terhubung (NO ID)</p>
              <p className="text-2xl font-extrabold text-danger mt-1">{classroomStats.unlinked || 0}</p>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-danger-soft flex items-center justify-center text-danger">
              <Icon name="link" className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[11px] text-danger/80 mt-2">Perlu diisi ID Classroom manual/sync</p>
        </div>

        <div
          onClick={() => { setClassroomStatus('linked'); setPage(1); }}
          className={`card card-pad cursor-pointer transition hover:border-success/40 ${
            classroomStatus === 'linked' ? 'ring-2 ring-success/70 bg-success/5' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-success">Sudah Terhubung</p>
              <p className="text-2xl font-extrabold text-success mt-1">{classroomStats.linked || 0}</p>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-success-soft flex items-center justify-center text-success">
              <Icon name="check" className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[11px] text-success/80 mt-2">Nilai tugas otomatis terbaca</p>
        </div>
      </div>

      {/* Banner Peringatan Siswa Belum Terhubung */}
      {classroomStats.unlinked > 0 && classroomStatus !== 'unlinked' && (
        <div className="rounded-2xl border border-warn/40 bg-warn-soft/60 p-4 text-xs text-warn-ink flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-warn text-white font-bold">
              !
            </span>
            <div>
              <p className="font-bold text-ink">
                Ada {classroomStats.unlinked} siswa yang belum terhubung dengan Google Classroom!
              </p>
              <p className="text-muted">
                Siswa tersebut berstatus <strong>NO ID</strong> pada rekap nilai. Anda bisa melihatnya dan menghubungkannya satu per satu.
              </p>
            </div>
          </div>
          <button
            onClick={() => { setClassroomStatus('unlinked'); setPage(1); }}
            className="btn-warn px-3 py-1.5 text-xs whitespace-nowrap shrink-0"
          >
            Lihat {classroomStats.unlinked} Siswa Belum Terhubung
          </button>
        </div>
      )}

      {/* Filter Tab & Controls */}
      <div className="card card-pad space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => { setClassroomStatus(''); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                classroomStatus === ''
                  ? 'bg-accent text-white shadow-sm'
                  : 'btn-ghost text-muted'
              }`}
            >
              Semua ({classroomStats.total || 0})
            </button>
            <button
              onClick={() => { setClassroomStatus('unlinked'); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                classroomStatus === 'unlinked'
                  ? 'bg-danger text-white shadow-sm'
                  : 'btn-ghost text-danger hover:bg-danger-soft'
              }`}
            >
              <span>Belum Terhubung</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/25">
                {classroomStats.unlinked || 0}
              </span>
            </button>
            <button
              onClick={() => { setClassroomStatus('linked'); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                classroomStatus === 'linked'
                  ? 'bg-success text-white shadow-sm'
                  : 'btn-ghost text-success hover:bg-success-soft'
              }`}
            >
              <span>Sudah Terhubung</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/25">
                {classroomStats.linked || 0}
              </span>
            </button>
          </div>

          <span className="chip">
            Halaman {page} dari {totalPages || 1}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Cari nama, NIS, atau NISN siswa..."
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
              className="input pl-9"
            />
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              <Icon name="search" className="h-4 w-4" />
            </span>
          </div>
          <select
            value={filterKelas}
            onChange={(e) => { setFilterKelas(e.target.value); setPage(1); }}
            className="select sm:w-48"
          >
            <option value="">Semua Kelas</option>
            {KELAS_LIST.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
      </div>

      {/* List Siswa */}
      <div className="space-y-2.5">
        {filteredStudents.length === 0 ? (
          <div className="card card-pad text-center py-12 text-muted text-sm space-y-2">
            <p className="font-semibold text-ink">Tidak ada siswa yang ditemukan</p>
            <p className="text-xs">
              {classroomStatus === 'unlinked'
                ? 'Semua siswa di kelas ini sudah terhubung dengan ID Google Classroom!'
                : 'Tidak ada data siswa yang cocok dengan filter atau kata kunci pencarian.'}
            </p>
            {classroomStatus && (
              <button
                onClick={() => setClassroomStatus('')}
                className="btn-soft px-3 py-1.5 text-xs inline-block mt-2"
              >
                Tampilkan Semua Siswa
              </button>
            )}
          </div>
        ) : (
          filteredStudents.map((s) => {
            const hasClassroomId = !!s.classroomId;
            return (
              <div
                key={s._id}
                className={`row-card transition ${
                  !hasClassroomId ? 'border-danger/30 hover:border-danger/60' : ''
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-ink text-sm truncate">{s.nama}</p>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-accent/10 text-accent border border-accent/20">
                        {s.kelas}
                      </span>
                      {!hasClassroomId && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-danger-soft text-danger border border-danger/30">
                          <span className="h-1.5 w-1.5 rounded-full bg-danger animate-pulse"></span>
                          NO ID (Belum Terhubung)
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <span>NIS: <strong className="text-ink font-mono">{s.nis}</strong></span>
                      {s.nisn && <span>• NISN: <strong className="text-ink font-mono">{s.nisn}</strong></span>}
                      {s.orangTuaNama && (
                        <span>• Wali: <span className="text-ink">{s.orangTuaNama}</span> ({s.orangTuaTelepon || '-'})</span>
                      )}
                    </div>

                    <div className="mt-1.5 flex items-center gap-2">
                      {hasClassroomId ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-success-soft text-success-ink border border-success/30">
                          <span className="h-1.5 w-1.5 rounded-full bg-success"></span>
                          Google Classroom ID: <span className="font-mono font-bold">{s.classroomId}</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted italic">
                          Nilai tugas Google Classroom belum dapat disinkronkan untuk siswa ini
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    {!hasClassroomId ? (
                      <button
                        onClick={() => handleOpenEdit(s, true)}
                        className="btn-primary px-3 py-1.5 text-xs shadow-sm flex items-center gap-1"
                        title="Masukkan ID Google Classroom siswa secara manual"
                      >
                        <Icon name="link" className="h-3.5 w-3.5" />
                        <span>Hubungkan ID</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenEdit(s, false)}
                        className="btn-warn px-2.5 py-1 text-xs flex items-center gap-1"
                        title="Edit data dan ID Classroom siswa"
                      >
                        <Icon name="edit" className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </button>
                    )}

                    <button
                      onClick={() => generateCode(s._id, 'student')}
                      disabled={generatingCode === s._id + 'student'}
                      className="btn-soft px-2.5 py-1 text-xs"
                      title="Buat kode aktivasi Telegram Siswa"
                    >
                      {generatingCode === s._id + 'student' ? '...' : 'Kode Siswa'}
                    </button>
                    <button
                      onClick={() => generateCode(s._id, 'parent')}
                      disabled={generatingCode === s._id + 'parent'}
                      className="btn-success px-2.5 py-1 text-xs"
                      title="Buat kode aktivasi Telegram Orang Tua"
                    >
                      {generatingCode === s._id + 'parent' ? '...' : 'Kode Ortu'}
                    </button>
                    <button
                      onClick={() => deleteStudent(s._id)}
                      className="btn-danger px-2 py-1 text-xs"
                      title="Hapus data siswa"
                    >
                      <Icon name="trash" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-ghost px-3.5 py-1.5 text-xs disabled:opacity-50"
          >
            Sebelumnya
          </button>
          <span className="text-xs text-muted font-medium">
            Halaman {page} dari {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn-ghost px-3.5 py-1.5 text-xs disabled:opacity-50"
          >
            Berikutnya
          </button>
        </div>
      )}

      {/* Modal Dialog Edit / Hubungkan Siswa */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="card card-pad w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="font-bold text-ink text-base flex items-center gap-2">
                  <span>Edit Data Siswa</span>
                  {!editingStudent.classroomId && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-danger-soft text-danger">
                      NO ID
                    </span>
                  )}
                </h3>
                <p className="text-xs text-muted">
                  Perbarui profil atau hubungkan ID Google Classroom untuk {editingStudent.nama}
                </p>
              </div>
              <button
                onClick={() => setEditingStudent(null)}
                className="text-muted hover:text-ink p-1 rounded-lg hover:bg-surface2 transition"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="label">Nama Lengkap</label>
                <input
                  type="text"
                  value={editForm.nama || ''}
                  onChange={(e) => setEditForm({ ...editForm, nama: e.target.value })}
                  className="input"
                  placeholder="Nama Siswa"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">NIS</label>
                  <input
                    type="text"
                    value={editForm.nis || ''}
                    onChange={(e) => setEditForm({ ...editForm, nis: e.target.value })}
                    className="input font-mono"
                    placeholder="NIS"
                  />
                </div>
                <div>
                  <label className="label">NISN</label>
                  <input
                    type="text"
                    value={editForm.nisn || ''}
                    onChange={(e) => setEditForm({ ...editForm, nisn: e.target.value })}
                    className="input font-mono"
                    placeholder="NISN"
                  />
                </div>
              </div>

              <div>
                <label className="label">Kelas</label>
                <select
                  value={editForm.kelas || ''}
                  onChange={(e) => setEditForm({ ...editForm, kelas: e.target.value })}
                  className="select"
                >
                  {KELAS_LIST.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>

              {/* Input ID Google Classroom dengan Rekomendasi Akun */}
              <div className="rounded-xl border border-accent/30 bg-accent/5 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="label text-accent font-bold mb-0 flex items-center gap-1.5">
                    <Icon name="link" className="h-3.5 w-3.5" />
                    <span>ID Google Classroom (classroomId)</span>
                  </label>
                  {unlinkedRoster.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowRosterPicker(!showRosterPicker)}
                      className="text-[11px] text-accent font-semibold hover:underline"
                    >
                      {showRosterPicker ? 'Tutup Pilihan Akun' : `Pilih dari ${unlinkedRoster.length} Akun Classroom`}
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  value={editForm.classroomId || ''}
                  onChange={(e) => setEditForm({ ...editForm, classroomId: e.target.value })}
                  className="input font-mono text-xs bg-surface"
                  placeholder="Contoh: 108392193821038102938"
                />

                {editForm.classroomId ? (
                  <div className="flex items-center gap-1.5 rounded-lg bg-success-soft/70 border border-success/30 px-2.5 py-1.5 text-xs text-success-ink font-semibold">
                    <Icon name="check" className="h-4 w-4 shrink-0 text-success" />
                    <span className="truncate">
                      ID Terpilih: <code className="font-mono text-ink bg-white/60 dark:bg-black/30 px-1.5 py-0.5 rounded">{editForm.classroomId}</code>. Klik tombol <strong>"Simpan Perubahan"</strong> di bawah.
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted">
                    ID akun siswa di Google Classroom. Ketika ID ini terisi, status <code>NO ID</code> pada tabel nilai otomatis hilang dan nilai tugas siswa langsung terbaca.
                  </p>
                )}

                {/* Dropdown / Pilihan Roster Akun Google Classroom yang belum terhubung */}
                {showRosterPicker && unlinkedRoster.length > 0 && (
                  <div className="mt-2 rounded-xl border border-line bg-surface p-3 space-y-2.5 shadow-xl">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold text-ink flex items-center gap-1.5">
                        <Icon name="google" className="h-3.5 w-3.5 text-info" />
                        <span>Pilih Akun Google Classroom ({unlinkedRoster.length}):</span>
                      </p>
                      <span className="text-[10px] text-muted">Klik nama untuk pasang ID</span>
                    </div>

                    {/* Input Pencarian Cepat di Roster */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Ketik untuk mencari nama akun Google (misal: Farel)..."
                        value={rosterSearch}
                        onChange={(e) => setRosterSearch(e.target.value)}
                        className="input py-1.5 pl-8 pr-7 text-xs bg-surface2"
                        autoFocus
                      />
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted">
                        <Icon name="search" className="h-3.5 w-3.5" />
                      </span>
                      {rosterSearch && (
                        <button
                          type="button"
                          onClick={() => setRosterSearch('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink text-xs font-bold"
                        >
                          ×
                        </button>
                      )}
                    </div>

                    {/* Daftar Akun */}
                    <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                      {displayRoster.length === 0 ? (
                        <p className="text-center py-4 text-xs text-muted">
                          Tidak ditemukan akun yang cocok dengan "{rosterSearch}"
                        </p>
                      ) : (
                        displayRoster.map((r) => (
                          <div
                            key={r.userId}
                            onClick={() => {
                              setEditForm({ ...editForm, classroomId: r.userId });
                              setShowRosterPicker(false);
                              setRosterSearch('');
                            }}
                            className={`p-2 rounded-xl cursor-pointer transition border flex items-center justify-between gap-2 ${
                              r.isMatch
                                ? 'bg-accent/15 border-accent/40 hover:bg-accent/25 ring-1 ring-accent/30'
                                : 'bg-surface2/60 border-line/60 hover:bg-surface2 hover:border-line'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-xs font-bold text-ink truncate">{r.nama}</p>
                                {r.isMatch && (
                                  <span className="px-1.5 py-0.2 rounded-md text-[10px] font-extrabold bg-accent text-white shadow-xs">
                                    ⭐ Rekomendasi Cocok
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-muted truncate mt-0.5">{r.email || 'Tanpa email'}</p>
                            </div>
                            <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-surface text-ink border border-line shrink-0">
                              {r.userId}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Nama Orang Tua / Wali</label>
                  <input
                    type="text"
                    value={editForm.orangTuaNama || ''}
                    onChange={(e) => setEditForm({ ...editForm, orangTuaNama: e.target.value })}
                    className="input"
                    placeholder="Nama Orang Tua"
                  />
                </div>
                <div>
                  <label className="label">No. Telepon / WhatsApp Ortu</label>
                  <input
                    type="text"
                    value={editForm.orangTuaTelepon || ''}
                    onChange={(e) => setEditForm({ ...editForm, orangTuaTelepon: e.target.value })}
                    className="input font-mono"
                    placeholder="0812xxxxxxxx"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="btn-ghost px-4 py-2 text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="btn-primary px-4 py-2 text-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                <Icon name="check" className="h-3.5 w-3.5" />
                <span>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
