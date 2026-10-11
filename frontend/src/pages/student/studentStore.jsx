import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import { useServiceWorker } from '../../hooks/useServiceWorker';

const StudentContext = createContext(null);

export function StudentProvider({ children }) {
  const { user, student, logout } = useAuth();
  const [tab, setTab] = useState('beranda');
  const [data, setData] = useState(null);
  const [tasks, setTasks] = useState(null);
  const [bills, setBills] = useState(null);
  const [missingTasks, setMissingTasks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useServiceWorker();

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get('/dashboard');
      setData(res.data);
      setError('');
    } catch {
      setError('Gagal memuat data dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await api.get('/analytics/tasks?days=45');
      setTasks(res.data);
    } catch {
      setTasks({ tasks: [], summary: { total: 0, dueThisWeek: 0, myOverdue: 0 } });
    }
  }, []);

  const fetchMissingTasks = useCallback(async () => {
    try {
      const res = await api.get('/dashboard/missing-tasks');
      setMissingTasks(res.data);
    } catch {
      setMissingTasks({ missing: [], summary: { total: 0, overdue: 0, dueSoon: 0, noDueDate: 0 } });
    }
  }, []);

  const fetchBills = useCallback(async () => {
    try {
      const res = await api.get('/analytics/tasks?range=bills');
      setBills(res.data);
    } catch {
      setBills({ tasks: [], summary: { total: 0, dueThisWeek: 0, myOverdue: 0 } });
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchTasks();
    fetchMissingTasks();
    fetchBills();
  }, [fetchDashboard, fetchTasks, fetchMissingTasks, fetchBills]);

  const markAsRead = async (messageId) => {
    try {
      await api.put(`/dashboard/messages/${messageId}/read`);
      setData(prev => ({
        ...prev,
        messages: (prev?.messages || []).map(m =>
          m._id === messageId
            ? { ...m, isReadBy: [...(m.isReadBy || []), { studentId: user?.student?.id, readAt: new Date() }] }
            : m
        ),
      }));
    } catch (err) {
      console.error('Gagal menandai pesan dibaca:', err);
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    await api.post('/auth/change-password', { currentPassword, newPassword });
  };

  const isRead = (msg) => (msg.isReadBy || []).some(r => r.studentId === user?.student?.id);

  const unread = (data?.messages || []).filter(m => !isRead(m)).length;
  const overdue = tasks?.summary?.myOverdue || 0;
  const missingTasksSummary = missingTasks?.summary || { total: 0, overdue: 0, dueSoon: 0, noDueDate: 0 };

  const isBillLunas = (t) => Boolean(t?.isGraded) || t?.state === 'TURNED_IN' || t?.state === 'RETURNED';
  const billsList = bills?.tasks || [];
  const billsOpen = billsList.filter(t => !isBillLunas(t)).length;

  const value = {
    user,
    student: data?.student || student,
    logout,
    tab,
    setTab,
    data,
    tasks,
    bills,
    missingTasks,
    missingTasksSummary,
    billsOpen,
    isBillLunas,
    loading,
    error,
    retry: () => { setLoading(true); fetchDashboard(); },
    markAsRead,
    isRead,
    changePassword,
    unread,
    overdue,
    adminContact: data?.adminContact || 'https://wa.me/6288233182147?text=Halo%20Admin%2C%20saya%20ingin%20bertanya%20tentang%20sistem%20akademik.',
    adminContacts: data?.adminContacts || [
      { label: 'Admin 1', phone: '0882-3318-2147', url: 'https://wa.me/6288233182147?text=Halo%20Admin%2C%20saya%20ingin%20bertanya%20tentang%20sistem%20akademik.' },
      { label: 'Admin 2', phone: '0856-4140-8175', url: 'https://wa.me/6285641408175?text=Halo%20Admin%2C%20saya%20ingin%20bertanya%20tentang%20sistem%20akademik.' },
    ],
  };

  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
}

export function useStudent() {
  const ctx = useContext(StudentContext);
  if (!ctx) throw new Error('useStudent harus dipakai di dalam StudentProvider');
  return ctx;
}
