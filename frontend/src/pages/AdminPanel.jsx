import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import toast from '../components/Toaster';

export default function AdminPanel() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState(isAdmin ? 'students' : 'google');
  const [stats, setStats] = useState(null);
  const [students, setStudents] = useState([]);
  const [codes, setCodes] = useState([]);
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState('');
  const [filterKelas, setFilterKelas] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [messageForm, setMessageForm] = useState({
    title: '', content: '', targetKelas: [], targetAngkatan: [], isGlobal: true, priority: 'normal'
  });
  const [messageSuccess, setMessageSuccess] = useState('');
  const [generatingCode, setGeneratingCode] = useState(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkResult, setBulkResult] = useState(null);
  const [exportedCodes, setExportedCodes] = useState([]);
  const [googleAuth, setGoogleAuth] = useState(null);
  const [googleEmail, setGoogleEmail] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const [teachers, setTeachers] = useState([]);
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [teacherForm, setTeacherForm] = useState({ nama: '', nisn: '', password: '' });
  const [teacherMsg, setTeacherMsg] = useState('');

  const [editingStudent, setEditingStudent] = useState(null);
  const [editForm, setEditForm] = useState({ nis: '', nisn: '', nama: '', kelas: '', orangTuaNama: '', orangTuaTelepon: '' });
  const [searchInput, setSearchInput] = useState('');
  const searchTimeout = useRef(null);

  const [backups, setBackups] = useState([]);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [monitoring, setMonitoring] = useState(null);
  const [monitoringLoading, setMonitoringLoading] = useState(false);

  const [gradeKelas, setGradeKelas] = useState('');
  const [gradeSubject, setGradeSubject] = useState('');
  const [gradeData, setGradeData] = useState([]);
  const [gradeAssignments, setGradeAssignments] = useState([]);
  const [gradeLoading, setGradeLoading] = useState(false);
  const [showNewAssignment, setShowNewAssignment] = useState(false);
  const [newAssignment, setNewAssignment] = useState({ title: '', type: 'tugas' });
  const [gradeSaving, setGradeSaving] = useState(false);
  const [assignmentTypes, setAssignmentTypes] = useState({});

  const [classroomKelas, setClassroomKelas] = useState('');
  const [classroomSubject, setClassroomSubject] = useState('');
  const [classroomData, setClassroomData] = useState([]);
  const [classroomLoading, setClassroomLoading] = useState(false);
  const [classroomSubjects, setClassroomSubjects] = useState([]);
  const [classroomRealtime, setClassroomRealtime] = useState(true);
  const [classroomLastSync, setClassroomLastSync] = useState(null);
  const [syncingStudents, setSyncingStudents] = useState(false);
  const [syncStudentsResult, setSyncStudentsResult] = useState(null);

  const KELAS_LIST = ['X-TKJ1', 'X-TKJ2', 'XI-TKJ1', 'XI-TKJ2', 'XII-TKJ1', 'XII-TKJ2'];

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_auth') === 'success') {
      setGoogleAuth(true);
      window.history.replaceState({}, '', '/admin');
    }
  }, []);

  useEffect(() => {
    if (tab === 'backup') loadBackups();
    if (tab === 'monitoring') loadMonitoring();
    if (tab === 'classroom') loadClassroomSubjects();
    if (tab === 'teachers') loadTeachers();
  }, [tab]);
  useEffect(() => { loadStudents(); }, [page, filterKelas, search]);

  const handleSearch = (value) => {
    setSearchInput(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 400);
  };

  const loadData = async () => {
    try {
      const meRes = await api.get('/auth/me');
      setGoogleAuth(meRes.data.user?.hasGoogleAuth || false);
      setGoogleEmail(meRes.data.user?.googleEmail || null);

      const statsRes = await api.get('/admin/dashboard-stats');
      setStats(statsRes.data);

      if (isAdmin) {
        const [codesRes, msgsRes] = await Promise.all([
          api.get('/admin/activation-codes'),
          api.get('/admin/messages'),
        ]);
        setCodes(codesRes.data.codes);
        setMessages(msgsRes.data.messages);
      }
    } catch (err) {
      console.error('Gagal memuat data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async () => {
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      if (filterKelas) params.append('kelas', filterKelas);
      if (search) params.append('search', search);
      const { data } = await api.get(`/admin/students?${params}`);
      setStudents(data.students);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error('Gagal memuat siswa:', err);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/messages', messageForm);
      setMessageSuccess('Pesan berhasil dikirim!');
      setMessageForm({ title: '', content: '', targetKelas: [], targetAngkatan: [], isGlobal: true, priority: 'normal' });
      loadData();
      setTimeout(() => setMessageSuccess(''), 3000);
    } catch (err) {
      console.error('Gagal mengirim pesan:', err);
    }
  };

  const generateCode = async (studentId, chatType) => {
    setGeneratingCode(studentId + chatType);
    try {
      const { data } = await api.post('/admin/activation-codes', { studentId, chatType });
      alert(`Kode: ${data.code}\nBerlaku hingga: ${new Date(data.expiresAt).toLocaleDateString('id-ID')}`);
      loadData();
    } catch (err) {
      alert('Gagal membuat kode.');
    } finally {
      setGeneratingCode(null);
    }
  };

  const bulkGenerateCodes = async (chatType) => {
    if (!confirm(`Buat kode aktivasi ${chatType} untuk semua siswa${filterKelas ? ' kelas ' + filterKelas : ''}?`)) return;
    try {
      const body = { chatType };
      if (filterKelas) body.kelas = filterKelas;
      const { data } = await api.post('/admin/activation-codes/bulk', body);
      alert(`${data.codes.length} kode berhasil dibuat!`);
      loadData();
    } catch (err) {
      alert('Gagal generate kode.');
    }
  };

  const handleBulkImport = async () => {
    try {
      const lines = bulkText.trim().split('\n');
      const students = lines.map(line => {
        const [nis, nisn, nama, kelas] = line.split(',').map(s => s.trim());
        return { nis, nisn, nama, kelas };
      }).filter(s => s.nis && s.nama && s.kelas);

      const { data } = await api.post('/admin/students/bulk-create', {
        students,
        defaultPassword: '123456',
      });
      setBulkResult(data);
      setExportedCodes(data.codes || []);
      setBulkText('');
      loadData();
    } catch (err) {
      alert('Gagal import.');
    }
  };

  const exportCodesToCSV = () => {
    if (exportedCodes.length === 0) return;
    
    const headers = ['Nama', 'NISN', 'Kode Siswa', 'Kode Orang Tua'];
    const rows = exportedCodes.map(c => [
      c.nama,
      c.nisn,
      c.studentCode,
      c.parentCode || '-'
    ]);
    
    const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kode-aktivasi-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fetchPendingCodes = async () => {
    try {
      const { data } = await api.get('/admin/activation-codes/export?status=pending');
      setExportedCodes(data.codes);
    } catch (err) {
      alert('Gagal mengambil kode aktivasi.');
    }
  };

  const deleteMessage = async (id) => {
    if (!confirm('Hapus pesan ini?')) return;
    try {
      await api.delete(`/admin/messages/${id}`);
      loadData();
    } catch (err) {
      console.error('Gagal hapus:', err);
    }
  };

  const editStudent = (s) => {
    setEditingStudent(s);
    setEditForm({ nis: s.nis, nisn: s.nisn || '', nama: s.nama, kelas: s.kelas, orangTuaNama: s.orangTuaNama || '', orangTuaTelepon: s.orangTuaTelepon || '' });
  };

  const saveStudent = async () => {
    try {
      await api.put(`/admin/students/${editingStudent._id}`, editForm);
      setEditingStudent(null);
      loadStudents();
    } catch (err) {
      alert('Gagal menyimpan: ' + (err.response?.data?.error || err.message));
    }
  };

  const deleteStudent = async (id) => {
    if (!confirm('Hapus siswa ini? Tindakan ini tidak dapat dibatalkan.')) return;
    try {
      await api.delete(`/admin/students/${id}`);
      loadStudents();
    } catch (err) {
      alert('Gagal menghapus: ' + (err.response?.data?.error || err.message));
    }
  };

  const filteredStudents = students;

  const loadBackups = async () => {
    try {
      const { data } = await api.get('/tools/backup/list');
      setBackups(data.backups);
    } catch (err) {
      console.error('Gagal memuat backup:', err);
    }
  };

  const createBackupNow = async () => {
    setCreatingBackup(true);
    try {
      const { data } = await api.post('/tools/backup/create', { label: 'manual' });
      alert(`Backup berhasil: ${data.backup.name}\nUkuran: ${data.backup.sizeFormatted}`);
      loadBackups();
    } catch (err) {
      alert('Gagal membuat backup: ' + (err.response?.data?.error || err.message));
    } finally {
      setCreatingBackup(false);
    }
  };

  const restoreBackupNow = async (name) => {
    if (!confirm(`Restore backup "${name}"? Data saat ini akan ditimpa!`)) return;
    try {
      await api.post(`/tools/backup/restore/${name}`);
      alert('Restore berhasil!');
    } catch (err) {
      alert('Gagal restore: ' + (err.response?.data?.error || err.message));
    }
  };

  const deleteBackupNow = async (name) => {
    if (!confirm(`Hapus backup "${name}"?`)) return;
    try {
      await api.delete(`/tools/backup/${name}`);
      loadBackups();
    } catch (err) {
      alert('Gagal hapus: ' + (err.response?.data?.error || err.message));
    }
  };

  const loadMonitoring = async () => {
    setMonitoringLoading(true);
    try {
      const { data } = await api.get('/tools/monitoring/status');
      setMonitoring(data);
    } catch (err) {
      console.error('Gagal memuat monitoring:', err);
    } finally {
      setMonitoringLoading(false);
    }
  };

  const loadGrades = async () => {
    if (!gradeKelas || !gradeSubject) return;
    setGradeLoading(true);
    try {
      const { data } = await api.get(`/grades?kelas=${gradeKelas}&subject=${gradeSubject}`);
      setGradeData(data.students);
      setGradeAssignments(data.assignments || []);
      const types = {};
      for (const sg of data.students) {
        for (const g of sg.grades) {
          types[g.title] = g.type;
        }
      }
      setAssignmentTypes(types);
    } catch (err) {
      console.error('Gagal memuat nilai:', err);
    } finally {
      setGradeLoading(false);
    }
  };

  useEffect(() => {
    if (gradeKelas && gradeSubject) loadGrades();
  }, [gradeKelas, gradeSubject]);

  const addAssignment = async () => {
    if (!newAssignment.title.trim()) return;
    setGradeAssignments(prev => [...prev, newAssignment.title.trim()]);
    setAssignmentTypes(prev => ({ ...prev, [newAssignment.title.trim()]: newAssignment.type }));
    setShowNewAssignment(false);
    setNewAssignment({ title: '', type: 'tugas' });
  };

  const updateScore = (studentIdx, assignment, score) => {
    const val = score === '' ? '' : Math.min(100, Math.max(0, parseInt(score) || 0));
    setGradeData(prev => {
      const updated = [...prev];
      const student = { ...updated[studentIdx] };
      const grades = [...student.grades];
      const existingIdx = grades.findIndex(g => g.title === assignment);
      if (existingIdx >= 0) {
        grades[existingIdx] = { ...grades[existingIdx], score: val };
      } else {
        grades.push({ title: assignment, score: val, type: assignmentTypes[assignment] || 'tugas', maxScore: 100 });
      }
      student.grades = grades;
      updated[studentIdx] = student;
      return updated;
    });
  };

  const saveGrades = async () => {
    setGradeSaving(true);
    try {
      const gradesToSave = [];
      for (const sg of gradeData) {
        for (const assignment of gradeAssignments) {
          const g = sg.grades.find(gr => gr.title === assignment);
          if (g && g.score !== '' && g.score !== undefined && g.score !== null) {
            gradesToSave.push({
              studentId: sg.student._id,
              subject: gradeSubject,
              title: assignment,
              type: g.type || assignmentTypes[assignment] || 'tugas',
              score: Number(g.score),
              maxScore: g.maxScore || 100,
            });
          }
        }
      }
      const { data } = await api.post('/grades/bulk', { grades: gradesToSave });
      toast.success(data.message);
    } catch (err) {
      toast.error('Gagal menyimpan: ' + (err.response?.data?.error || err.message));
    } finally {
      setGradeSaving(false);
    }
  };

  const connectGoogle = async () => {
    try {
      const { data } = await api.get('/auth/google');
      window.location.href = data.url;
    } catch (err) {
      alert('Gagal membuat link Google Auth.');
    }
  };

  const syncClassroom = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data } = await api.post('/auth/google/sync');
      const courses = data.data?.coursesFound || 0;
      const skipped = data.data?.skipped || 0;
      toast.success(
        `Sinkronisasi Google Classroom berhasil!\n${courses} kelas ditemukan${skipped ? `, ${skipped} dilewati (siswa tidak terdaftar)` : ''}`
      );
      setSyncResult({
        success: true,
        message: data.message,
        courses,
        skipped,
      });
    } catch (err) {
      const msg = err.response?.data?.error || 'Gagal sinkronisasi';
      toast.error('Sinkronisasi gagal: ' + msg);
      setSyncResult({ success: false, message: msg });
    } finally {
      setSyncing(false);
    }
  };

  const disconnectGoogle = async () => {
    if (!confirm('Putuskan koneksi Google Classroom?')) return;
    try {
      await api.delete('/auth/google/disconnect');
      setGoogleAuth(false);
    } catch (err) {
      alert('Gagal memutus koneksi.');
    }
  };

  const syncStudents = async () => {
    setSyncingStudents(true);
    setSyncStudentsResult(null);
    try {
      const data = await (await api.post('/classroom-realtime/sync-students')).data;
      setSyncStudentsResult(data);
      toast.success('Sinkronisasi ID siswa selesai');
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      toast.error('Gagal sync siswa: ' + msg);
    } finally {
      setSyncingStudents(false);
    }
  };

  const loadClassroomSubjects = async () => {
    try {
      const MIN_MATCHED_STUDENTS = 10;
      const { data } = await api.get('/classroom-realtime/courses');
      const raw = (data.courses || [])
        .filter(c => c.alias && (isAdmin || Number(c.matchedStudents) >= MIN_MATCHED_STUDENTS))
        .map(c => ({
          _id: c.id,
          courseName: c.name,
          alias: c.alias,
          kelas: Array.isArray(c.kelas) ? c.kelas : [],
          matchedStudents: Number(c.matchedStudents) || 0,
        }));
      let courses = raw;
      if (!isAdmin) {
        // Untuk guru: maksimal satu kursus tiap (mapel + kelas).
        // Bila duplikat, simpankan yang paling banyak siswa cocok dengan data admin.
        const seen = new Map();
        courses = [];
        for (const s of raw) {
          const key = `${s.alias}|${s.kelas[0] || ''}`;
          const prev = seen.get(key);
          if (!prev) {
            seen.set(key, s);
            courses.push(s);
          } else if (s.matchedStudents > prev.matchedStudents) {
            courses[courses.indexOf(prev)] = s;
            seen.set(key, s);
          }
        }
      }
      courses.sort((a, b) => {
          if (a.alias !== b.alias) return a.alias.localeCompare(b.alias);
          const aLabel = a.kelas[0] || a.courseName;
          const bLabel = b.kelas[0] || b.courseName;
          return aLabel.localeCompare(bLabel);
        });
      setClassroomSubjects(courses);
    } catch (err) {
      console.error('Gagal memuat mata pelajaran:', err);
    }
  };

  const loadClassroomGrades = async (useCache = true) => {
    if (!classroomKelas || !classroomSubject) return;
    setClassroomLoading(true);
    try {
      const res = await api.get(`/classroom-realtime/grades?kelas=${classroomKelas}&courseId=${classroomSubject}&cached=${useCache ? '1' : '0'}`);
      const data = res.data.data || [];
      const students = res.data.students || [];
      
      const result = students.map(student => {
        const subs = data
          .filter(cw => cw.submissions?.some(s => s.classroomStudentId === student.classroomId))
          .flatMap(cw => cw.submissions
            .filter(s => s.classroomStudentId === student.classroomId)
            .map(s => ({
              courseworkId: cw.courseworkId,
              title: cw.title,
              courseAlias: cw.courseAlias,
              courseName: cw.courseName,
              dueDate: cw.dueDate,
              maxPoints: cw.maxPoints,
              state: s.state,
              grade: s.grade,
              late: s.late,
              submittedAt: s.submittedAt,
            }))
          );
        return { student, submissions: subs };
      });

      setClassroomData(result);
      setClassroomLastSync(new Date());
    } catch (err) {
      console.error('Gagal memuat nilai classroom:', err);
      alert('Gagal mengambil data: ' + (err.response?.data?.error || err.message));
    } finally {
      setClassroomLoading(false);
    }
  };

  useEffect(() => {
    if (classroomKelas && classroomSubject) loadClassroomGrades();
  }, [classroomKelas, classroomSubject]);

  const loadTeachers = async () => {
    setTeachersLoading(true);
    try {
      const { data } = await api.get('/admin/teachers');
      setTeachers(data.teachers);
    } catch (err) {
      console.error('Gagal memuat guru:', err);
    } finally {
      setTeachersLoading(false);
    }
  };

  const createTeacher = async (e) => {
    e.preventDefault();
    setTeacherMsg('');
    try {
      const { data } = await api.post('/admin/teachers', teacherForm);
      setTeacherMsg({ ok: true, text: `Akun guru berhasil dibuat. NISN: ${data.teacher.nisn} • Password: ${data.teacher.passwordDefault}` });
      setTeacherForm({ nama: '', nisn: '', password: '' });
      loadTeachers();
    } catch (err) {
      setTeacherMsg({ ok: false, text: err.response?.data?.error || 'Gagal membuat akun guru.' });
    }
  };

  const deleteTeacher = async (id) => {
    if (!confirm('Hapus akun guru ini? Data sync milik guru akan ikut dihapus.')) return;
    try {
      await api.delete(`/admin/teachers/${id}`);
      loadTeachers();
    } catch (err) {
      alert('Gagal menghapus: ' + (err.response?.data?.error || err.message));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <header className="bg-gradient-to-r from-gray-800 to-gray-900 text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div>
            <h1 className="text-base sm:text-lg font-bold">Panel Admin</h1>
            <p className="text-gray-300 text-xs sm:text-sm">SMK TKJ - Sistem Informasi Akademik</p>
          </div>
          <button
            onClick={logout}
            className="bg-white/15 hover:bg-red-500/80 active:scale-95 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4">
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white rounded-xl p-3.5 sm:p-4 shadow-sm border border-gray-100 text-center">
              <div className="text-2xl sm:text-3xl font-extrabold text-primary-600">{stats.totalStudents}</div>
              <div className="text-xs text-gray-500 mt-1">Total Siswa</div>
            </div>
            <div className="bg-white rounded-xl p-3.5 sm:p-4 shadow-sm border border-gray-100 text-center">
              <div className="text-2xl sm:text-3xl font-extrabold text-green-600">{stats.activatedChats}</div>
              <div className="text-xs text-gray-500 mt-1">Teraktivasi</div>
            </div>
            <div className="bg-white rounded-xl p-3.5 sm:p-4 shadow-sm border border-gray-100 text-center">
              <div className="text-2xl sm:text-3xl font-extrabold text-yellow-600">{stats.pendingCodes}</div>
              <div className="text-xs text-gray-500 mt-1">Kode Pending</div>
            </div>
            <div className="bg-white rounded-xl p-3.5 sm:p-4 shadow-sm border border-gray-100 text-center">
              <div className="text-2xl sm:text-3xl font-extrabold text-gray-800">{stats.totalUsers}</div>
              <div className="text-xs text-gray-500 mt-1">Total Users</div>
            </div>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {[
            { key: 'students', label: 'Siswa', adminOnly: true },
            { key: 'grades', label: 'Input Nilai', adminOnly: true },
            { key: 'classroom', label: 'Nilai Classroom', adminOnly: false },
            { key: 'messages', label: 'Pesan', adminOnly: true },
            { key: 'codes', label: 'Kode Aktivasi', adminOnly: true },
            { key: 'import', label: 'Import', adminOnly: true },
            { key: 'google', label: 'Google Classroom', adminOnly: false },
            { key: 'teachers', label: 'Guru', adminOnly: true },
            { key: 'backup', label: 'Backup', adminOnly: true },
            { key: 'monitoring', label: 'Monitoring', adminOnly: true },
          ].filter(t => isAdmin || ['students', 'grades', 'classroom', 'google'].includes(t.key)).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition shadow-xs ${
                tab === t.key ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div>
          {/* Students Tab */}
          {tab === 'students' && (
          <div>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="Cari nama/NIS..."
                value={searchInput}
                onChange={(e) => handleSearch(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              />
              <select
                value={filterKelas}
                onChange={(e) => { setFilterKelas(e.target.value); setPage(1); }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="">Semua Kelas</option>
                {KELAS_LIST.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              {filteredStudents.map(s => (
                <div key={s._id} className="bg-white rounded-xl p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{s.nama}</p>
                      <p className="text-xs text-gray-500">{s.nis} - {s.kelas}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => editStudent(s)}
                        className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-lg hover:bg-yellow-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteStudent(s._id)}
                        className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-lg hover:bg-red-200"
                      >
                        Hapus
                      </button>
                      <button
                        onClick={() => generateCode(s._id, 'student')}
                        disabled={generatingCode === s._id + 'student'}
                        className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded-lg hover:bg-primary-200"
                      >
                        {generatingCode === s._id + 'student' ? '...' : 'Siswa'}
                      </button>
                      <button
                        onClick={() => generateCode(s._id, 'parent')}
                        disabled={generatingCode === s._id + 'parent'}
                        className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg hover:bg-green-200"
                      >
                        {generatingCode === s._id + 'parent' ? '...' : 'Ortu'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 rounded-lg bg-gray-200 text-sm disabled:opacity-50"
                >
                  Prev
                </button>
                <span className="text-sm text-gray-600">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 rounded-lg bg-gray-200 text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {/* Grades Tab */}
        {tab === 'grades' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
              <h3 className="font-semibold text-gray-800">Input Nilai Manual</h3>
              <div className="flex gap-2">
                <select
                  value={gradeKelas}
                  onChange={(e) => setGradeKelas(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Pilih Kelas</option>
                  {KELAS_LIST.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
                <select
                  value={gradeSubject}
                  onChange={(e) => setGradeSubject(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Pilih Mata Pelajaran</option>
                  <option value="ASJ">ASJ</option>
                  <option value="AIJ">AIJ</option>
                  <option value="TJBL">TJBL</option>
                  <option value="PKDK">PKDK</option>
                  <option value="TJKT">TJKT</option>
                </select>
              </div>
            </div>

            {gradeKelas && gradeSubject && (
              <>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-800 text-sm">Komponen Nilai</h4>
                    <button
                      onClick={() => setShowNewAssignment(!showNewAssignment)}
                      className="text-xs bg-primary-100 text-primary-700 px-3 py-1 rounded-lg hover:bg-primary-200"
                    >
                      + Tambah
                    </button>
                  </div>

                  {showNewAssignment && (
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        placeholder="Nama (contoh: Tugas 1, UTS, UAS)"
                        value={newAssignment.title}
                        onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <select
                        value={newAssignment.type}
                        onChange={(e) => setNewAssignment({ ...newAssignment, type: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="tugas">Tugas</option>
                        <option value="quiz">Quiz</option>
                        <option value="uts">UTS</option>
                        <option value="uas">UAS</option>
                      </select>
                      <button
                        onClick={addAssignment}
                        className="bg-primary-600 text-white px-3 py-2 rounded-lg text-sm"
                      >
                        Tambah
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1">
                    {gradeAssignments.map((a, i) => (
                      <span key={i} className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full">{a}</span>
                    ))}
                    {gradeAssignments.length === 0 && (
                      <p className="text-xs text-gray-400">Belum ada komponen. Klik "+ Tambah" untuk menambahkan.</p>
                    )}
                  </div>
                </div>

                {gradeLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                  </div>
                ) : gradeData.length > 0 ? (
                  <>
                    <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 sticky left-0 bg-gray-50">Nama</th>
                            {gradeAssignments.map((a, i) => (
                              <th key={i} className="px-3 py-2 text-center text-xs font-semibold text-gray-500 min-w-[80px]">{a}</th>
                            ))}
                            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">Rata-rata</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gradeData.map((sg, si) => {
                            const scores = gradeAssignments.map(a => {
                              const g = sg.grades.find(gr => gr.title === a);
                              return g && g.score !== '' && g.score !== undefined ? Number(g.score) : null;
                            }).filter(s => s !== null);
                            const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : '-';
                            return (
                              <tr key={sg.student._id} className="border-t border-gray-100 hover:bg-gray-50">
                                <td className="px-3 py-2 sticky left-0 bg-white hover:bg-gray-50">
                                  <p className="font-medium text-gray-800 text-xs">{sg.student.nama}</p>
                                  <p className="text-xs text-gray-400">{sg.student.nis}</p>
                                </td>
                                {gradeAssignments.map((a, ai) => {
                                  const g = sg.grades.find(gr => gr.title === a);
                                  return (
                                    <td key={ai} className="px-2 py-1 text-center">
                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={g?.score ?? ''}
                                        onChange={(e) => updateScore(si, a, e.target.value)}
                                        className="w-16 px-1 py-1 border border-gray-200 rounded text-center text-xs focus:ring-1 focus:ring-primary-500 outline-none"
                                      />
                                    </td>
                                  );
                                })}
                                <td className="px-3 py-2 text-center">
                                  <span className={`text-xs font-bold ${
                                    avg >= 80 ? 'text-green-600' : avg >= 60 ? 'text-yellow-600' : typeof avg === 'number' ? 'text-red-600' : 'text-gray-400'
                                  }`}>
                                    {avg}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <button
                      onClick={saveGrades}
                      disabled={gradeSaving}
                      className="w-full bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 text-sm disabled:opacity-50"
                    >
                      {gradeSaving ? 'Menyimpan...' : `Simpan Semua Nilai (${gradeData.length} siswa)`}
                    </button>
                  </>
                ) : (
                  <p className="text-center text-gray-500 text-sm py-8">Tidak ada data siswa untuk kelas ini.</p>
                )}
              </>
            )}

            {!gradeKelas || !gradeSubject ? (
              <p className="text-center text-gray-500 text-sm py-8">Pilih kelas dan mata pelajaran untuk mulai input nilai.</p>
            ) : null}
          </div>
        )}

        {/* Classroom Grades Tab */}
        {tab === 'classroom' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
              <h3 className="font-semibold text-gray-800">Nilai dari Google Classroom</h3>
              <div className="flex gap-2">
                <select
                  value={classroomKelas}
                  onChange={(e) => setClassroomKelas(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Pilih Kelas</option>
                  {KELAS_LIST.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
                <select
                  value={classroomSubject}
                  onChange={(e) => {
                    const val = e.target.value;
                    setClassroomSubject(val);
                    const chosen = classroomSubjects.find(s => s._id === val);
                    if (chosen && chosen.kelas?.length === 1) setClassroomKelas(chosen.kelas[0]);
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Pilih Kelas Google Classroom</option>
                  {[...new Set(classroomSubjects.map(s => s.alias))].sort().map(alias => (
                    <optgroup key={alias} label={alias}>
                      {classroomSubjects.filter(s => s.alias === alias).map(s => (
                        <option key={s._id} value={s._id}>
                          {s.kelas.length > 0 ? s.kelas.join(', ') : s.courseName}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  Data real-time dari Google Classroom
                  {classroomLastSync && ` • Update: ${classroomLastSync.toLocaleTimeString('id-ID')}`}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    setClassroomLoading(true);
                    try {
                      await api.post('/auth/google/sync');
                      toast.success('Sinkronisasi Google Classroom berhasil!\nKelas & nilai terbaru sudah dimuat.');
                      if (classroomKelas && classroomSubject) {
                        await Promise.all([loadClassroomSubjects(), loadClassroomGrades()]);
                      } else {
                        await loadClassroomSubjects();
                      }
                    } catch (err) {
                      toast.error('Gagal sync: ' + (err.response?.data?.error || err.message));
                    } finally {
                      setClassroomLoading(false);
                    }
                  }}
                  disabled={classroomLoading}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 text-sm disabled:opacity-50"
                >
                  {classroomLoading ? 'Syncing...' : 'Sync Google Classroom'}
                </button>
                <button
                  onClick={() => loadClassroomGrades(false)}
                  disabled={classroomLoading || !classroomKelas || !classroomSubject}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 text-sm disabled:opacity-50"
                >
                  {classroomLoading ? 'Loading...' : 'Refresh'}
                </button>
              </div>
            </div>

            {classroomKelas && classroomSubject && (
              <>
                {classroomLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                  </div>
                ) : classroomData.length > 0 ? (
                  <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
                    {(() => {
                      const allTitles = [...new Set(classroomData.flatMap(sg => sg.submissions.map(s => s.title)))];
                      return (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 sticky left-0 bg-gray-50">Nama</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">NISN</th>
                          {allTitles.map((title, i) => (
                            <th key={i} className="px-3 py-2 text-center text-xs font-semibold text-gray-500 min-w-[100px]" title={title}>
                              {title.length > 15 ? title.substring(0, 15) + '...' : title}
                            </th>
                          ))}
                          <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 bg-gray-100">Rata-rata</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classroomData.map(sg => {
                          const grades = allTitles.map(title => {
                            const sub = sg.submissions.find(s => s.title === title);
                            return sub?.grade !== undefined && sub?.grade !== null ? Number(sub.grade) : null;
                          });
                          const validGrades = grades.filter(g => g !== null);
                          const avg = validGrades.length > 0 ? Math.round(validGrades.reduce((a, b) => a + b, 0) / validGrades.length) : null;
                          return (
                            <tr key={sg.student._id} className="border-t border-gray-100 hover:bg-gray-50">
                              <td className="px-3 py-2 sticky left-0 bg-white hover:bg-gray-50">
                                <p className="font-medium text-gray-800 text-xs">{sg.student.nama}</p>
                              </td>
                              <td className="px-3 py-2 text-xs font-mono">{sg.student.nisn}</td>
                              {grades.map((grade, i) => (
                                <td key={i} className="px-3 py-2 text-center">
                                  {grade !== null ? (
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                                      grade >= 80 ? 'bg-green-100 text-green-700' :
                                      grade >= 60 ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-red-100 text-red-700'
                                    }`}>{grade}</span>
                                  ) : (
                                    <span className="text-xs text-gray-400">-</span>
                                  )}
                                </td>
                              ))}
                              <td className="px-3 py-2 text-center bg-gray-50">
                                {avg !== null ? (
                                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                                    avg >= 80 ? 'bg-green-100 text-green-700' :
                                    avg >= 60 ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-700'
                                  }`}>{avg}</span>
                                ) : (
                                  <span className="text-xs text-gray-400">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                      );
                    })()}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 text-sm py-8">Tidak ada data untuk kelas dan mata pelajaran ini.</p>
                )}
              </>
            )}

            {!classroomKelas || !classroomSubject ? (
              <p className="text-center text-gray-500 text-sm py-8">Pilih kelas dan pilih kelas Google Classroom untuk melihat nilai.</p>
            ) : null}
          </div>
        )}

        {/* Messages Tab */}
        {tab === 'messages' && (
          <div className="space-y-4">
            {messageSuccess && (
              <div className="bg-green-50 text-green-700 px-4 py-3 rounded-xl text-sm">{messageSuccess}</div>
            )}

            <form onSubmit={handleSendMessage} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
              <h3 className="font-semibold text-gray-800">Kirim Pesan Baru</h3>
              <input
                type="text"
                placeholder="Judul pesan"
                value={messageForm.title}
                onChange={(e) => setMessageForm({ ...messageForm, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                required
              />
              <textarea
                placeholder="Isi pesan..."
                value={messageForm.content}
                onChange={(e) => setMessageForm({ ...messageForm, content: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm h-24 resize-none focus:ring-2 focus:ring-primary-500 outline-none"
                required
              />
              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-600">Prioritas:</label>
                <select
                  value={messageForm.priority}
                  onChange={(e) => setMessageForm({ ...messageForm, priority: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="low">Rendah</option>
                  <option value="normal">Normal</option>
                  <option value="high">Tinggi</option>
                  <option value="urgent">Mendesak</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={messageForm.isGlobal}
                  onChange={(e) => setMessageForm({ ...messageForm, isGlobal: e.target.checked })}
                  className="rounded"
                />
                Kirim ke semua siswa
              </label>
              {!messageForm.isGlobal && (
                <div className="flex flex-wrap gap-1">
                  {KELAS_LIST.map(k => (
                    <label key={k} className="flex items-center gap-1 text-xs bg-gray-100 px-2 py-1 rounded">
                      <input
                        type="checkbox"
                        checked={messageForm.targetKelas.includes(k)}
                        onChange={(e) => {
                          const kelas = e.target.checked
                            ? [...messageForm.targetKelas, k]
                            : messageForm.targetKelas.filter(x => x !== k);
                          setMessageForm({ ...messageForm, targetKelas: kelas });
                        }}
                      />
                      {k}
                    </label>
                  ))}
                </div>
              )}
              <button type="submit" className="w-full bg-primary-600 text-white py-2 rounded-lg font-medium hover:bg-primary-700 text-sm">
                Kirim Pesan
              </button>
            </form>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-500 uppercase">Riwayat Pesan</h3>
              {messages.map(msg => (
                <div key={msg._id} className="bg-white rounded-xl p-3 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-sm text-gray-800">{msg.title}</h4>
                      <p className="text-xs text-gray-600 mt-1">{msg.content}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(msg.createdAt).toLocaleDateString('id-ID')} - {msg.isGlobal ? 'Global' : msg.targetKelas?.join(', ')}
                      </p>
                    </div>
                    <button onClick={() => deleteMessage(msg._id)} className="text-red-400 hover:text-red-600 text-xs">Hapus</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activation Codes Tab */}
        {tab === 'codes' && (
          <div>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => bulkGenerateCodes('student')}
                className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-700"
              >
                Generate Semua (Siswa)
              </button>
              <button
                onClick={() => bulkGenerateCodes('parent')}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700"
              >
                Generate Semua (Ortu)
              </button>
            </div>

            <div className="space-y-2">
              {codes.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-8">Belum ada kode aktivasi.</p>
              ) : (
                codes.slice(0, 100).map(c => (
                  <div key={c._id} className="bg-white rounded-xl p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-mono text-sm font-bold text-gray-800">{c.code}</p>
                        <p className="text-xs text-gray-500">
                          {c.studentId?.nama} - {c.studentId?.kelas} ({c.chatType === 'parent' ? 'Orang Tua' : 'Siswa'})
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        c.isUsed ? 'bg-gray-100 text-gray-500' :
                        new Date(c.expiresAt) < new Date() ? 'bg-red-100 text-red-600' :
                        'bg-green-100 text-green-600'
                      }`}>
                        {c.isUsed ? 'Terpakai' : new Date(c.expiresAt) < new Date() ? 'Kadaluarsa' : 'Aktif'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Import Tab */}
        {tab === 'import' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
              <h3 className="font-semibold text-gray-800">Import Siswa dari CSV</h3>
              <p className="text-xs text-gray-500">Format: NIS, NISN, Nama, Kelas (satu baris per siswa)</p>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={"14707, 14707, Ahmad Reiza Fahmi, X-TKJ1\n14708, 14708, Aldhitya Ahmad Fahri, X-TKJ1"}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono h-40 resize-none focus:ring-2 focus:ring-primary-500 outline-none"
              />
              <button
                onClick={handleBulkImport}
                className="w-full bg-primary-600 text-white py-2 rounded-lg font-medium hover:bg-primary-700 text-sm"
              >
                Import Sekarang
              </button>
              {bulkResult && (
                <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm">
                  {bulkResult.message}
                </div>
              )}
              <p className="text-xs text-gray-400">Password default: 123456</p>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">Kode Aktivasi</h3>
                <div className="flex gap-2">
                  <button
                    onClick={fetchPendingCodes}
                    className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-lg hover:bg-gray-200"
                  >
                    Muat Semua
                  </button>
                  {exportedCodes.length > 0 && (
                    <button
                      onClick={exportCodesToCSV}
                      className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-lg hover:bg-green-200"
                    >
                      Export CSV
                    </button>
                  )}
                </div>
              </div>
              
              {exportedCodes.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Nama</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">NISN</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Kode Siswa</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Kode Ortu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exportedCodes.map((c, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="px-3 py-2 text-xs">{c.nama}</td>
                          <td className="px-3 py-2 text-xs font-mono">{c.nisn}</td>
                          <td className="px-3 py-2 text-xs font-mono bg-green-50">{c.studentCode}</td>
                          <td className="px-3 py-2 text-xs font-mono bg-blue-50">{c.parentCode || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-gray-500 text-sm py-4">
                  Belum ada kode. Import siswa terlebih dahulu.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Guru Tab */}
        {tab === 'teachers' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
              <h3 className="font-semibold text-gray-800">Tambah Akun Guru</h3>
              <p className="text-xs text-gray-500">
                Setiap guru login dashboard dengan NISN &amp; password masing-masing, lalu menghubungkan akun Google sendiri.
              </p>
              <form onSubmit={createTeacher} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Nama Guru"
                  value={teacherForm.nama}
                  onChange={(e) => setTeacherForm({ ...teacherForm, nama: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  required
                />
                <input
                  type="text"
                  placeholder="NISN (username login)"
                  value={teacherForm.nisn}
                  onChange={(e) => setTeacherForm({ ...teacherForm, nisn: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  required
                />
                <input
                  type="text"
                  placeholder="Password (default 123456)"
                  value={teacherForm.password}
                  onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
                <button
                  type="submit"
                  className="bg-primary-600 text-white py-2 rounded-lg font-medium hover:bg-primary-700 text-sm"
                >
                  Buat Akun Guru
                </button>
              </form>
              {teacherMsg && (
                <div className={`px-4 py-3 rounded-lg text-sm ${teacherMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {teacherMsg.text}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">Daftar Guru</h3>
                <button
                  onClick={loadTeachers}
                  disabled={teachersLoading}
                  className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  Muat Ulang
                </button>
              </div>
              {teachersLoading ? (
                <p className="text-center text-gray-500 text-sm py-4">Memuat...</p>
              ) : teachers.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-4">Belum ada akun guru.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Nama</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">NISN</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Google Terhubung</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teachers.map(t => (
                        <tr key={t.id} className="border-t border-gray-100">
                          <td className="px-3 py-2 text-xs font-medium text-gray-800">{t.nama}</td>
                          <td className="px-3 py-2 text-xs font-mono">{t.nisn}</td>
                          <td className="px-3 py-2 text-xs">
                            {t.hasGoogleAuth ? (
                              <span className="text-green-600">{t.googleEmail || 'Terhubung'}</span>
                            ) : (
                              <span className="text-gray-400">Belum</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            <button
                              onClick={() => deleteTeacher(t.id)}
                              className="text-red-500 hover:text-red-700"
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
        )}

        {/* Google Classroom Tab */}
        {tab === 'google' && (
          <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
            <h3 className="font-semibold text-gray-800">Google Classroom Sync</h3>
            
            {!googleAuth ? (
              <div className="text-center space-y-3">
                <p className="text-sm text-gray-600">
                  Hubungkan akun Google Guru untuk mengakses Google Classroom.
                </p>
                <button
                  onClick={connectGoogle}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 text-sm flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Hubungkan dengan Google
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium">Terhubung dengan Google Classroom</span>
                </div>
                <p className="text-xs text-gray-500 -mt-1">
                  Terhubung sebagai {googleEmail || 'akun Google Anda'}
                </p>

                <button
                  onClick={syncClassroom}
                  disabled={syncing}
                  className="w-full bg-primary-600 text-white py-2 rounded-lg font-medium hover:bg-primary-700 text-sm disabled:opacity-50"
                >
                  {syncing ? 'Sinkronisasi...' : 'Sinkronisasi Sekarang'}
                </button>

                {syncResult && (
                  <div className={`px-4 py-3 rounded-lg text-sm ${
                    syncResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {syncResult.success 
                      ? `Berhasil! ${syncResult.courses} kelas ditemukan${syncResult.skipped ? `, ${syncResult.skipped} dilewati (siswa tidak terdaftar)` : ''}.`
                      : syncResult.message
                    }
                  </div>
                )}

                <button
                  onClick={syncStudents}
                  disabled={syncingStudents}
                  className="w-full bg-purple-600 text-white py-2 rounded-lg font-medium hover:bg-purple-700 text-sm disabled:opacity-50"
                >
                  {syncingStudents ? 'Menyinkronkan Siswa...' : 'Sinkronkan ID Siswa dari Google Classroom'}
                </button>

                {syncStudentsResult && (
                  <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm">
                    {syncStudentsResult.message}
                    {syncStudentsResult.details?.length > 0 && (
                      <div className="mt-2 text-xs max-h-40 overflow-y-auto">
                        {syncStudentsResult.details.map((d, i) => (
                          <div key={i}>{d.nama} ({d.nisn}) → {d.classroomId}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={disconnectGoogle}
                  className="w-full bg-red-100 text-red-600 py-2 rounded-lg text-sm hover:bg-red-200"
                >
                  Putuskan Koneksi
                </button>
              </div>
            )}
          </div>
        )}

        {/* Backup Tab */}
        {tab === 'backup' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
              <h3 className="font-semibold text-gray-800">Backup Database</h3>
              <p className="text-xs text-gray-500">Backup otomatis setiap jam 02:00. Manual backup juga tersedia.</p>
              <button
                onClick={createBackupNow}
                disabled={creatingBackup}
                className="w-full bg-primary-600 text-white py-2 rounded-lg font-medium hover:bg-primary-700 text-sm disabled:opacity-50"
              >
                {creatingBackup ? 'Membuat Backup...' : 'Backup Sekarang'}
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-500 uppercase">Riwayat Backup</h3>
              {backups.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-4">Belum ada backup.</p>
              ) : (
                backups.map(b => (
                  <div key={b.name} className="bg-white rounded-xl p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm text-gray-800">{b.name}</p>
                        <p className="text-xs text-gray-500">
                          {b.collections?.length || 0} koleksi • {new Date(b.createdAt).toLocaleString('id-ID')}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => restoreBackupNow(b.name)}
                          className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-lg hover:bg-yellow-200"
                        >
                          Restore
                        </button>
                        <button
                          onClick={() => deleteBackupNow(b.name)}
                          className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-lg hover:bg-red-200"
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
        )}

        {/* Monitoring Tab */}
        {tab === 'monitoring' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">System Status</h3>
                <button
                  onClick={loadMonitoring}
                  disabled={monitoringLoading}
                  className="text-xs bg-primary-100 text-primary-700 px-3 py-1 rounded-lg hover:bg-primary-200 disabled:opacity-50"
                >
                  {monitoringLoading ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              {!monitoring ? (
                <p className="text-sm text-gray-500 text-center py-4">Klik Refresh untuk melihat status.</p>
              ) : (
                <div className="space-y-4">
                  {/* Server */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-primary-600">{monitoring.server?.uptime}s</div>
                      <div className="text-xs text-gray-500">Uptime</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-green-600">{monitoring.database?.status}</div>
                      <div className="text-xs text-gray-500">Database</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-gray-800">{monitoring.memory?.percentage}%</div>
                      <div className="text-xs text-gray-500">RAM ({monitoring.memory?.used})</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-blue-600">{monitoring.requests?.total || 0}</div>
                      <div className="text-xs text-gray-500">Total Request</div>
                    </div>
                  </div>

                  {/* Error rate */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Error Rate</span>
                      <span className={`text-sm font-bold ${
                        monitoring.requests?.errorRate === '0%' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {monitoring.requests?.errorRate || '0%'}
                      </span>
                    </div>
                  </div>

                  {/* Top routes */}
                  {monitoring.requests?.topRoutes?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Top Routes</h4>
                      <div className="space-y-1">
                        {monitoring.requests.topRoutes.map((r, i) => (
                          <div key={i} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                            <span className="font-mono text-gray-700 truncate flex-1">{r.route}</span>
                            <span className="ml-2 text-gray-500">{r.count}x</span>
                            {r.errors > 0 && <span className="ml-2 text-red-500">{r.errors} err</span>}
                            <span className="ml-2 text-gray-400">{r.avgDuration}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent errors */}
                  {monitoring.errors?.recent?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Recent Errors</h4>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {monitoring.errors.recent.map((e, i) => (
                          <div key={i} className="bg-red-50 rounded-lg px-3 py-2 text-xs">
                            <span className="text-red-600 font-mono">{e.source}</span>
                            <span className="text-gray-600 ml-2">{e.message}</span>
                            <span className="text-gray-400 ml-2 block">{new Date(e.timestamp).toLocaleString('id-ID')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Log files */}
                  {monitoring.logs?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Log Files</h4>
                      <div className="space-y-1">
                        {monitoring.logs.map((l, i) => (
                          <div key={i} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                            <span className="font-mono text-gray-700">{l.name}</span>
                            <span className="text-gray-500">{l.size}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>

      {editingStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3">
            <h3 className="font-semibold text-gray-800">Edit Siswa</h3>
            <input
              type="text"
              placeholder="NIS"
              value={editForm.nis}
              onChange={(e) => setEditForm({ ...editForm, nis: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <input
              type="text"
              placeholder="NISN"
              value={editForm.nisn}
              onChange={(e) => setEditForm({ ...editForm, nisn: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <input
              type="text"
              placeholder="Nama"
              value={editForm.nama}
              onChange={(e) => setEditForm({ ...editForm, nama: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <select
              value={editForm.kelas}
              onChange={(e) => setEditForm({ ...editForm, kelas: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {KELAS_LIST.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <input
              type="text"
              placeholder="Nama Orang Tua"
              value={editForm.orangTuaNama}
              onChange={(e) => setEditForm({ ...editForm, orangTuaNama: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <input
              type="text"
              placeholder="Telepon Orang Tua"
              value={editForm.orangTuaTelepon}
              onChange={(e) => setEditForm({ ...editForm, orangTuaTelepon: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <div className="flex gap-2">
              <button onClick={() => setEditingStudent(null)} className="flex-1 bg-gray-200 py-2 rounded-lg text-sm">Batal</button>
              <button onClick={saveStudent} className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
