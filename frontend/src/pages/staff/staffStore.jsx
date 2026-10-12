import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import toast from '../../components/Toaster';

export const StaffContext = createContext(null);

export function StaffProvider({ children }) {
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
    title: '', content: '', targetType: 'all', targetKelas: [], targetStudents: [], targetAngkatan: [], isGlobal: true, priority: 'normal'
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
  const [editForm, setEditForm] = useState({ nis: '', nisn: '', nama: '', kelas: '', classroomId: '', orangTuaNama: '', orangTuaTelepon: '' });
  const [searchInput, setSearchInput] = useState('');
  const searchTimeout = useRef(null);

  const [classroomStatus, setClassroomStatus] = useState(''); // '' (semua) | 'unlinked' | 'linked'
  const [classroomStats, setClassroomStats] = useState({ total: 0, unlinked: 0, linked: 0 });
  const [unlinkedRoster, setUnlinkedRoster] = useState([]);
  const [unlinkedRosterLoading, setUnlinkedRosterLoading] = useState(false);

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
  const [classroomCourseworks, setClassroomCourseworks] = useState([]);
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

  const loadUnlinkedRoster = async () => {
    setUnlinkedRosterLoading(true);
    try {
      const { data } = await api.get('/admin/unlinked-roster');
      setUnlinkedRoster(data.unlinkedRoster || []);
    } catch (err) {
      console.warn('Gagal memuat unlinked roster:', err);
    } finally {
      setUnlinkedRosterLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const { data } = await api.get('/admin/messages');
      setMessages(data.messages || []);
    } catch (err) {
      console.warn('Gagal memuat pesan:', err);
    }
  };

  useEffect(() => {
    if (tab === 'backup') loadBackups();
    if (tab === 'monitoring') loadMonitoring();
    if (tab === 'classroom') loadClassroomSubjects();
    if (tab === 'teachers') loadTeachers();
    if (tab === 'messages') loadMessages();
    if (tab === 'students') {
      loadStudents();
      loadUnlinkedRoster();
    }
  }, [tab]);
  useEffect(() => { loadStudents(); }, [page, filterKelas, search, classroomStatus]);

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

      try {
        const msgsRes = await api.get('/admin/messages');
        setMessages(msgsRes.data.messages || []);
      } catch (_) {}

      if (isAdmin) {
        try {
          const codesRes = await api.get('/admin/activation-codes');
          setCodes(codesRes.data.codes || []);
        } catch (_) {}
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
      if (classroomStatus) params.append('classroomStatus', classroomStatus);
      const { data } = await api.get(`/admin/students?${params}`);
      setStudents(data.students);
      setTotalPages(data.totalPages);
      if (data.classroomStats) {
        setClassroomStats(data.classroomStats);
      }
    } catch (err) {
      console.error('Gagal memuat siswa:', err);
    }
  };

  const handleSendMessage = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    try {
      await api.post('/admin/messages', messageForm);
      setMessageSuccess('Pesan berhasil dikirim!');
      setMessageForm({
        title: '',
        content: '',
        targetType: 'all',
        targetKelas: [],
        targetStudents: [],
        targetAngkatan: [],
        isGlobal: true,
        priority: 'normal',
      });
      loadMessages();
      setTimeout(() => setMessageSuccess(''), 3000);
      return true;
    } catch (err) {
      console.error('Gagal mengirim pesan:', err);
      alert('Gagal mengirim pesan: ' + (err.response?.data?.error || err.message));
      return false;
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
      loadMessages();
    } catch (err) {
      console.error('Gagal hapus:', err);
      alert('Gagal menghapus pesan: ' + (err.response?.data?.error || err.message));
    }
  };

  const editStudent = (s) => {
    setEditingStudent(s);
    setEditForm({
      nis: s.nis || '',
      nisn: s.nisn || '',
      nama: s.nama || '',
      kelas: s.kelas || '',
      classroomId: s.classroomId || '',
      orangTuaNama: s.orangTuaNama || '',
      orangTuaTelepon: s.orangTuaTelepon || '',
    });
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
      setClassroomCourseworks(data);
      
      const result = students.map(student => {
        const subs = data
          .filter(cw => cw.submissions?.some(s => s.classroomStudentId === student.classroomId))
          .flatMap(cw => cw.submissions
            .filter(s => s.classroomStudentId === student.classroomId)
            .map(s => ({
              courseworkId: cw.courseworkId,
              title: cw.title,
              workType: cw.workType || 'ASSIGNMENT',
              maxPoints: cw.maxPoints || 100,
              courseAlias: cw.courseAlias,
              courseName: cw.courseName,
              dueDate: cw.dueDate,
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

  const value = {
    KELAS_LIST, addAssignment, assignmentTypes, backups, bulkGenerateCodes, bulkResult, bulkText, classroomCourseworks, classroomData, classroomKelas, classroomLastSync, classroomLoading, classroomRealtime, classroomSubject, classroomSubjects, codes, connectGoogle, createBackupNow, createTeacher, creatingBackup, deleteBackupNow, deleteMessage, deleteStudent, deleteTeacher, disconnectGoogle, editForm, editStudent, editingStudent, exportCodesToCSV, exportedCodes, fetchPendingCodes, filterKelas, filteredStudents, generateCode, generatingCode, googleAuth, googleEmail, gradeAssignments, gradeData, gradeKelas, gradeLoading, gradeSaving, gradeSubject, handleBulkImport, handleSearch, handleSendMessage, isAdmin, loadBackups, loadClassroomGrades, loadClassroomSubjects, loadData, loadGrades, loadMessages, loadMonitoring, loadStudents, loadTeachers, loading, logout, messageForm, messageSuccess, messages, monitoring, monitoringLoading, newAssignment, page, restoreBackupNow, saveGrades, saveStudent, search, searchInput, searchTimeout, setAssignmentTypes, setBackups, setBulkResult, setBulkText, setClassroomCourseworks, setClassroomData, setClassroomKelas, setClassroomLastSync, setClassroomLoading, setClassroomRealtime, setClassroomSubject, setClassroomSubjects, setCodes, setCreatingBackup, setEditForm, setEditingStudent, setExportedCodes, setFilterKelas, setGeneratingCode, setGoogleAuth, setGoogleEmail, setGradeAssignments, setGradeData, setGradeKelas, setGradeLoading, setGradeSaving, setGradeSubject, setLoading, setMessageForm, setMessageSuccess, setMessages, setMonitoring, setMonitoringLoading, setNewAssignment, setPage, setSearch, setSearchInput, setShowBulkImport, setShowNewAssignment, setStats, setStudents, setSyncResult, setSyncStudentsResult, setSyncing, setSyncingStudents, setTab, setTeacherForm, setTeacherMsg, setTeachers, setTeachersLoading, setTotalPages, showBulkImport, showNewAssignment, stats, students, syncClassroom, syncResult, syncStudents, syncStudentsResult, syncing, syncingStudents, tab, teacherForm, teacherMsg, teachers, teachersLoading, totalPages, updateScore, user,
    classroomStatus, setClassroomStatus, classroomStats, setClassroomStats, unlinkedRoster, unlinkedRosterLoading, loadUnlinkedRoster,
  };

  return <StaffContext.Provider value={value}>{children}</StaffContext.Provider>;
}

export function useStaff() {
  const ctx = useContext(StaffContext);
  if (!ctx) throw new Error('useStaff harus dipakai di dalam StaffProvider');
  return ctx;
}
