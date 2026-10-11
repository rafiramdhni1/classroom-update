import { StudentProvider, useStudent } from './studentStore';
import { useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import AppShell from '../../components/AppShell';
import { FullPageLoading } from '../../components/ui';

import BerandaMenu from './BerandaMenu';
import NilaiMenu from './NilaiMenu';
import RankMenu from './RankMenu';
import InboxMenu from './InboxMenu';
import TasksMenu from './TasksMenu';
import TagihanMenu from './TagihanMenu';
import ProfilMenu from './ProfilMenu';

const MENUS = {
  beranda: { label: 'Beranda', icon: 'home', comp: BerandaMenu },
  nilai: { label: 'Nilai Saya', icon: 'grades', comp: NilaiMenu },
  peringkat: { label: 'Peringkat', icon: 'trophy', comp: RankMenu },
  pesan: { label: 'Kotak Pesan', icon: 'inbox', comp: InboxMenu },
  tugas: { label: 'Tugas', icon: 'calendar', comp: TasksMenu },
  tagihan: { label: 'Tagihan Tugas', icon: 'receipt', comp: TagihanMenu },
  profil: { label: 'Profil & Akun', icon: 'user', comp: ProfilMenu },
};

const SECTIONS = [
  { label: 'Akademik', keys: ['beranda', 'nilai', 'peringkat'] },
  { label: 'Informasi', keys: ['pesan', 'tugas', 'tagihan', 'profil'] },
];

function Shell() {
  const { user, logout, tab, setTab, loading, error, retry, unread, overdue, student, billsOpen } = useStudent();
  const { setRole, toggle, isDark } = useTheme();

  useEffect(() => {
    if (user?.role) setRole(user.role);
  }, [user?.role, setRole]);

  const sections = SECTIONS.map(s => ({
    label: s.label,
    items: s.keys.map(k => ({
      key: k,
      label: MENUS[k].label,
      icon: MENUS[k].icon,
      badge:
        k === 'pesan' ? unread || undefined
        : k === 'tugas' ? overdue || undefined
        : k === 'tagihan' ? billsOpen || undefined
        : undefined,
    })),
  }));

  if (loading) {
    return (
      <FullPageLoading
        label="Memuat data akademikmu..."
        subtitle="Menyiapkan data siswa, nilai & tugas"
        icon="book"
      />
    );
  }

  if (error) {
    return (
      <div className="grid min-h-screen place-content-center gap-4 bg-bg px-6 text-center">
        <p className="text-sm font-bold text-danger">{error}</p>
        <button onClick={retry} className="btn-primary mx-auto">Coba lagi</button>
      </div>
    );
  }

  const activeKey = MENUS[tab] ? tab : 'beranda';
  const Current = MENUS[activeKey].comp;

  return (
    <AppShell
      subtitle="Portal Siswa"
      sections={sections}
      active={activeKey}
      onChange={setTab}
      user={{ ...user, name: student?.nama || user?.nisn }}
      logout={logout}
    >
      <Current />
    </AppShell>
  );
}

export default function StudentPanel() {
  return (
    <StudentProvider>
      <Shell />
    </StudentProvider>
  );
}
