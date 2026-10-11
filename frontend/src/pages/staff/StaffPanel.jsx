import { StaffProvider, useStaff } from './staffStore';
import { useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import AppShell from '../../components/AppShell';
import { FullPageLoading } from '../../components/ui';

import OverviewMenu from './OverviewMenu';
import StudentsMenu from './studentsMenu';
import GradesMenu from './gradesMenu';
import ClassroomMenu from './classroomMenu';
import CalendarMenu from './CalendarMenu';
import AssignmentsMenu from './AssignmentsMenu';
import MessagesMenu from './messagesMenu';
import CodesMenu from './codesMenu';
import ImportMenu from './importMenu';
import TeachersMenu from './teachersMenu';
import GoogleMenu from './googleMenu';
import BackupMenu from './backupMenu';
import MonitoringMenu from './monitoringMenu';

const MENUS = {
  overview: { label: 'Ringkasan', icon: 'overview', comp: OverviewMenu },
  students: { label: 'Kelola Siswa', icon: 'students', comp: StudentsMenu, adminOnly: true },
  grades: { label: 'Input Nilai', icon: 'grades', comp: GradesMenu },
  classroom: { label: 'Nilai Classroom', icon: 'classroom', comp: ClassroomMenu },
  assignments: { label: 'Buat Tugas', icon: 'assignments', comp: AssignmentsMenu },
  calendar: { label: 'Kalender Tugas', icon: 'calendar', comp: CalendarMenu, adminOnly: true },
  messages: { label: 'Pesan', icon: 'messages', comp: MessagesMenu, adminOnly: true },
  codes: { label: 'Kode Aktivasi', icon: 'codes', comp: CodesMenu, adminOnly: true },
  teachers: { label: 'Akun Guru', icon: 'teachers', comp: TeachersMenu, adminOnly: true },
  google: { label: 'Google Classroom', icon: 'google', comp: GoogleMenu },
  import: { label: 'Import Data', icon: 'import', comp: ImportMenu, adminOnly: true },
  backup: { label: 'Backup', icon: 'backup', comp: BackupMenu, adminOnly: true },
  monitoring: { label: 'Monitoring', icon: 'monitoring', comp: MonitoringMenu, adminOnly: true },
};

const SECTIONS = [
  { label: 'Akademik', keys: ['overview', 'students', 'grades', 'classroom', 'assignments'] },
  { label: 'Kalender', keys: ['calendar'] },
  { label: 'Komunikasi', keys: ['messages', 'codes'] },
  { label: 'Sistem', keys: ['teachers', 'google', 'import', 'backup', 'monitoring'] },
];

function Shell() {
  const { user, logout, tab, setTab, loading, stats, codes } = useStaff();
  const { setRole } = useTheme();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (user?.role) setRole(user.role);
  }, [user?.role, setRole]);

  const sections = SECTIONS
    .map(s => ({
      label: s.label,
      items: s.keys
        .filter(k => isAdmin || !MENUS[k].adminOnly)
        .map(k => ({
          key: k,
          label: MENUS[k].label,
          icon: MENUS[k].icon,
          badge: k === 'codes' && stats ? stats.pendingCodes : k === 'messages' && codes ? codes.length : undefined,
        })),
    }))
    .filter(s => s.items.length);

  const activeKey = sections.flatMap(s => s.items).some(i => i.key === tab)
    ? tab
    : sections[0]?.items[0]?.key || 'overview';
  const Current = MENUS[activeKey].comp;

  if (loading) {
    return (
      <FullPageLoading
        label={`Menyiapkan panel ${isAdmin ? 'administrator' : 'guru'}...`}
        subtitle="Memuat data kelas, siswa, dan kurikulum"
        icon="book"
      />
    );
  }

  return (
    <AppShell
      subtitle={isAdmin ? 'Panel Administrator' : 'Panel Guru'}
      sections={sections}
      active={activeKey}
      onChange={setTab}
      user={{ ...user, name: user?.nisn }}
      logout={logout}
    >
      <Current />
    </AppShell>
  );
}

export default function StaffPanel() {
  return (
    <StaffProvider>
      <Shell />
    </StaffProvider>
  );
}
