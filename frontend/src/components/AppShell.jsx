import { useEffect, useState } from 'react';
import Icon from './icons';
import { Avatar } from './ui';
import { useTheme } from '../contexts/ThemeContext';

const ROLE_LABEL = { admin: 'Administrator', guru: 'Guru', student: 'Siswa', parent: 'Orang Tua' };

export default function AppShell({ sections = [], active, onChange, title, subtitle, user, logout, actions, onUserClick, children }) {
  const [open, setOpen] = useState(false);
  const { isDark, toggle } = useTheme();

  useEffect(() => { setOpen(false); }, [active]);

  const flat = sections.flatMap(s => s.items);
  const current = flat.find(i => i.key === active);
  const currentSection = sections.find(s => s.items.some(i => i.key === active));

  const NavList = ({ onPick }) => (
    <nav className="relative flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {sections.map(section => (
        <div key={section.label}>
          <p className="mb-2 flex items-center gap-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">
            <span className="h-px w-4 rounded-full bg-white/30" />
            {section.label}
          </p>
          <div className="space-y-1.5">
            {section.items.map(item => (
              <button
                key={item.key}
                onClick={() => { onChange(item.key); onPick?.(); }}
                className={`nav-item w-full ${active === item.key ? 'nav-item-active' : ''}`}
              >
                <span className="nav-ico">
                  <Icon name={item.icon} className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                {item.badge !== undefined && item.badge !== null && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                      active === item.key
                        ? 'bg-white/25 text-white'
                        : 'bg-white/18 text-white'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  const Brand = (
    <div className="relative overflow-hidden px-5 pb-5 pt-6">
      <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/25 blur-2xl" />
      <div className="relative flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.4)] ring-1 ring-white/30">
          <Icon name="book" className="h-6 w-6" strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-extrabold leading-tight text-white">SMK TKJ Akademik</p>
          <p className="truncate text-[11px] text-white/65">{subtitle || 'Sistem Informasi'}</p>
        </div>
      </div>
    </div>
  );

  const UserCard = (
    <div className="relative p-3">
      <div className="flex items-center gap-2 rounded-2xl bg-white/12 p-2.5 ring-1 ring-white/15 backdrop-blur">
        {onUserClick ? (
          <button
            type="button"
            onClick={onUserClick}
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left transition hover:opacity-85 focus:outline-none"
            title="Buka Pengaturan Akun"
          >
            <span className="relative shrink-0">
              <Avatar name={user?.name || user?.nisn || 'U'} className="avatar-on-brand h-9 w-9 text-[11px] ring-white/40" />
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[rgb(var(--shell-2))] bg-success" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-white">{user?.name || user?.nisn || '-'}</p>
              <p className="truncate text-[10px] text-white/60">
                {ROLE_LABEL[user?.role] || user?.role}
              </p>
            </div>
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="relative shrink-0">
              <Avatar name={user?.name || user?.nisn || 'U'} className="avatar-on-brand h-9 w-9 text-[11px] ring-white/40" />
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[rgb(var(--shell-2))] bg-success" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-white">{user?.name || user?.nisn || '-'}</p>
              <p className="truncate text-[10px] text-white/60">
                {ROLE_LABEL[user?.role] || user?.role}
              </p>
            </div>
          </div>
        )}
        {onUserClick && (
          <button
            onClick={onUserClick}
            title="Pengaturan Akun"
            className="grid h-8 w-8 place-items-center rounded-lg text-white/80 transition hover:bg-white/20 hover:text-white shrink-0"
          >
            <Icon name="settings" className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={logout}
          title="Keluar"
          className="grid h-8 w-8 place-items-center rounded-lg text-white/80 transition hover:bg-white/20 hover:text-white shrink-0"
        >
          <Icon name="logout" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[276px] p-3 lg:block">
        <div className="shell-side relative flex h-full w-full flex-col overflow-hidden rounded-[28px] shadow-lift">
          {Brand}
          <NavList />
          {UserCard}
        </div>
      </aside>

      {/* Sidebar mobile */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[85%] max-w-xs flex-col p-3 animate-slideRight">
            <div className="shell-side relative flex h-full w-full flex-col overflow-hidden rounded-[28px] shadow-2xl">
              <button
                className="absolute right-3 top-4 z-10 grid h-8 w-8 place-items-center rounded-lg text-white/80 hover:bg-white/20"
                onClick={() => setOpen(false)}
                aria-label="Tutup menu"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
              {Brand}
              <NavList onPick={() => setOpen(false)} />
              {UserCard}
            </div>
          </aside>
        </div>
      )}

      {/* Konten */}
      <div className="lg:pl-[276px]">
        <header className="shell-header sticky top-0 z-30 border-b border-line/70">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3.5 sm:px-6">
            <button
              className="btn-ghost h-9 w-9 rounded-xl p-0 lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Buka menu"
            >
              <Icon name="menu" className="h-5 w-5" />
            </button>

            <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand text-white shadow-glow sm:grid">
              <Icon name={current?.icon || 'overview'} className="h-5 w-5" strokeWidth={1.9} />
            </span>

            <div className="min-w-0 flex-1">
              <p className="hidden items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted sm:flex">
                {(currentSection?.label || 'Menu')}
                <span className="text-accent">•</span>
                <span className="text-accent">{current?.label || title}</span>
              </p>
              <h1 className="truncate font-display text-base font-extrabold tracking-tight text-ink sm:text-lg">
                {current?.label || title}
              </h1>
              <p className="hidden truncate text-xs text-muted sm:block">{subtitle}</p>
            </div>

            <div className="flex items-center gap-2">
              {actions}
              <button
                onClick={toggle}
                title={isDark ? 'Mode terang' : 'Mode gelap'}
                className="btn-ghost h-9 w-9 rounded-xl p-0"
              >
                <Icon name={isDark ? 'sun' : 'moon'} className="h-[18px] w-[18px]" />
              </button>
              {onUserClick ? (
                <button
                  type="button"
                  onClick={onUserClick}
                  title="Pengaturan Akun"
                  className="hidden ring-2 ring-accent/40 sm:block rounded-full hover:ring-accent transition cursor-pointer"
                >
                  <Avatar name={user?.name || user?.nisn || 'U'} className="h-9 w-9 text-[11px]" />
                </button>
              ) : (
                <span className="hidden ring-2 ring-accent/40 sm:block rounded-full">
                  <Avatar name={user?.name || user?.nisn || 'U'} className="h-9 w-9 text-[11px]" />
                </span>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-5 pb-16 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  );
}
