import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './icons';

export function Avatar({ name = '', className = 'h-9 w-9 text-xs' }) {
  const initials = String(name)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
  return (
    <span className={`avatar grid shrink-0 place-items-center rounded-full font-bold ring-1 ring-accent/40 ${className}`}>
      {initials || '?'}
    </span>
  );
}

export function Card({ title, actions, children, className = '', pad = true, hover = false }) {
  return (
    <section className={`card ${pad ? 'card-pad' : ''} ${hover ? 'card-hover' : ''} ${className}`}>
      {(title || actions) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-4 w-[3px] shrink-0 rounded-full bg-brand" />
            {typeof title === 'string' ? (
              <h3 className="truncate font-display text-sm font-bold text-ink">{title}</h3>
            ) : (
              title
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }) {
  return (
    <div className="hero animate-fadeUp">
      <div className="relative z-[1] flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="hero-eyebrow">{eyebrow}</p>}
          <h1 className="hero-title">{title}</h1>
          {subtitle && <p className="hero-sub">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

const TONE_MAP = {
  accent: 'tone-accent',
  success: 'tone-success',
  warn: 'tone-warn',
  danger: 'tone-danger',
  info: 'tone-info',
};

export function Stat({ label, value, hint, tone = 'accent', icon, footer }) {
  const toneClass = TONE_MAP[tone] || 'tone-accent';
  return (
    <div className={`stat-card ${toneClass} animate-fadeUp`}>
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="section-title">{label}</p>
          <p className="stat-val mt-2 text-2xl leading-none sm:text-3xl">{value}</p>
          {hint && <p className="mt-1.5 truncate text-xs text-muted">{hint}</p>}
        </div>
        {icon && (
          <span className="stat-ico">
            <Icon name={icon} className="h-5 w-5" />
          </span>
        )}
      </div>
      {footer && <div className="relative mt-3 border-t border-line pt-3 text-xs text-muted">{footer}</div>}
    </div>
  );
}

export function Section({ title, actions, children, className = '' }) {
  return (
    <section className={className}>
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="section-title flex items-center gap-2">
            <span className="h-3.5 w-[3px] rounded-full bg-accent" />
            {title}
          </h2>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      {label && <span className="label">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

export function Select({
  value,
  onChange,
  options = [],
  placeholder = 'Pilih...',
  className = '',
  id,
  icon,
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const boxRef = useRef(null);
  const popRef = useRef(null);
  const triggerRef = useRef(null);

  const updatePos = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    setPos({
      left: r.left,
      width: r.width,
      top: r.bottom + 6,
      bottom: window.innerHeight - r.top + 6,
      up: r.bottom + 260 > window.innerHeight,
    });
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (boxRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onMove = () => updatePos();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open]);

  const active = options.find((o) => !o.header && o.value === value);

  return (
    <div className={`relative ${className}`} ref={boxRef}>
      <button
        type="button"
        id={id}
        ref={triggerRef}
        onClick={() => {
          if (!open) updatePos();
          setOpen((v) => !v);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-filled={active ? 'true' : 'false'}
        className="select-trigger"
      >
        {icon && <Icon name={icon} className="h-4 w-4 shrink-0 text-accent" />}
        <span className={`min-w-0 flex-1 truncate ${active ? 'text-ink' : 'text-muted'}`}>
          {active ? active.label : placeholder}
        </span>
        <span
          className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg transition ${
            open ? 'bg-accent/25 text-accent' : 'bg-accent/10 text-accent'
          }`}
        >
          <Icon
            name="chevronDown"
            className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {open &&
        pos &&
        createPortal(
          <ul
            ref={popRef}
            role="listbox"
            style={{
              position: 'fixed',
              left: pos.left,
              width: pos.width,
              zIndex: 100,
              ...(pos.up ? { bottom: pos.bottom } : { top: pos.top }),
            }}
            className="animate-fadeUp max-h-60 overflow-auto rounded-xl border border-line bg-surface p-1 shadow-lift"
          >
          {options.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">Tidak ada pilihan</li>
          )}
          {options.map((o, i) =>
            o.header ? (
              <li
                key={`hdr-${o.header}-${i}`}
                className="label px-3 pb-1 pt-2.5 text-[10px]"
              >
                {o.header}
              </li>
            ) : (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  onClick={() => {
                    onChange?.(o.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                    o.value === value
                      ? 'bg-accent/10 font-semibold text-ink'
                      : 'text-ink hover:bg-accent/5 hover:text-ink'
                  }`}
                >
                  <span className="min-w-0">{o.label}</span>
                  {o.value === value && (
                    <Icon name="check" className="h-4 w-4 shrink-0 text-accent" />
                  )}
                </button>
              </li>
            )
          )}
          </ul>,
          document.body
        )}
    </div>
  );
}

export function EmptyState({ icon = 'inbox', title, desc, action }) {
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-[22px] border border-dashed border-accent/40 bg-brand-soft px-6 py-12 text-center">
      <span className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-accent/15 blur-2xl" />
      <span className="relative mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand text-white shadow-glow">
        <Icon name={icon} className="h-7 w-7" />
      </span>
      <p className="relative font-display text-sm font-bold text-ink">{title}</p>
      {desc && <p className="relative mt-1 max-w-sm text-xs text-muted">{desc}</p>}
      {action && <div className="relative mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ className = 'h-8 w-8' }) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      role="status"
      aria-label="memuat"
    >
      <span className="absolute inset-0 rounded-full border-2 border-line/60" />
      <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent border-r-accent animate-spin" />
    </span>
  );
}

export function LoadingBlock({ label = 'Memuat data...', hint = 'Mengambil data dari sistem...', className = 'min-h-[45vh]' }) {
  return (
    <div className={`relative flex w-full flex-col items-center justify-center px-4 py-10 text-center animate-fadeUp ${className}`}>
      <div className="pointer-events-none absolute h-36 w-36 rounded-full bg-accent/15 blur-2xl animate-pulse" />
      <div className="relative mb-4 flex h-14 w-14 items-center justify-center">
        <div className="absolute inset-0 rounded-full border-2 border-line/70" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent border-r-accent animate-spin" />
        <div className="h-3 w-3 rounded-full bg-brand shadow-glow animate-pulse" />
      </div>
      <p className="font-display text-sm font-bold text-ink sm:text-base">{label}</p>
      {hint && <p className="mt-1 text-xs text-muted max-w-xs">{hint}</p>}
      <div className="mt-4 relative h-1.5 w-28 overflow-hidden rounded-full bg-line/80">
        <div className="absolute inset-y-0 left-0 w-14 rounded-full bg-brand animate-pulse" />
      </div>
    </div>
  );
}

export function FullPageLoading({
  label = 'Memuat data...',
  subtitle = 'Mohon tunggu sebentar',
  icon = 'book',
}) {
  return (
    <div className="fixed inset-0 z-50 flex min-h-[100dvh] w-full flex-col items-center justify-center bg-bg/95 p-4 text-center select-none backdrop-blur-md animate-fadeUp">
      <div className="pointer-events-none absolute h-72 w-72 rounded-full bg-accent/20 blur-3xl animate-pulse" />
      <div className="relative flex w-full max-w-xs sm:max-w-sm flex-col items-center justify-center rounded-3xl border border-line/80 bg-surface/90 px-6 py-8 shadow-glass backdrop-blur-xl sm:px-8">
        <div className="relative mb-5 flex h-20 w-20 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-accent/25 blur-md animate-pulse" />
          <div className="absolute inset-0 rounded-full border-[3px] border-line/60" />
          <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-accent border-r-accent animate-spin" />
          <div className="absolute inset-2 rounded-full border border-dashed border-accent-2/50 animate-spin [animation-duration:8s] [animation-direction:reverse]" />
          <div className="relative grid h-10 w-10 place-items-center rounded-2xl bg-brand text-white shadow-glow">
            <Icon name={icon} className="h-5 w-5" strokeWidth={2} />
          </div>
        </div>
        <span className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-accent">
          SMK TKJ AKADEMIK
        </span>
        <h3 className="font-display text-base font-bold text-ink sm:text-lg">
          {label}
        </h3>
        {subtitle && (
          <p className="mt-1 text-xs text-muted">
            {subtitle}
          </p>
        )}
        <div className="mt-6 relative h-1.5 w-36 overflow-hidden rounded-full bg-line/80">
          <div className="absolute inset-y-0 left-0 w-20 rounded-full bg-brand animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export function Pagination({ page, totalPages, onPage, total }) {
  if (!totalPages || totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <span className="text-xs font-semibold text-muted">{total ? `${total} data` : ''}</span>
      <div className="flex items-center gap-2 rounded-full border border-line bg-[rgb(var(--c-surface)/0.75)] p-1 shadow-card backdrop-blur">
        <button className="btn-ghost rounded-full px-3 py-1.5 text-xs" disabled={page === 1} onClick={() => onPage(page - 1)}>
          <Icon name="chevron" className="h-4 w-4 rotate-180" />
          Prev
        </button>
        <span className="rounded-full bg-brand px-3 py-1.5 text-xs font-extrabold text-white shadow-glow">
          {page} / {totalPages}
        </span>
        <button className="btn-ghost rounded-full px-3 py-1.5 text-xs" disabled={page === totalPages} onClick={() => onPage(page + 1)}>
          Next
          <Icon name="chevron" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, size = 'max-w-md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className={`card w-full ${size} max-h-[90vh] overflow-y-auto rounded-b-none p-5 animate-pop sm:rounded-b-[22px]`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-4 flex items-center justify-between gap-3 border-b border-line pb-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-4 w-[3px] rounded-full bg-brand" />
            <h3 className="truncate font-display text-base font-bold text-ink">{title}</h3>
          </div>
          <button className="btn-ghost h-8 w-8 rounded-full p-0" onClick={onClose} aria-label="Tutup">
            <Icon name="close" className="h-4 w-4" />
          </button>
        </header>
        {children}
        {footer && <footer className="mt-5 flex justify-end gap-2">{footer}</footer>}
      </div>
    </div>
  );
}

export function Banner({ tone = 'success', children, onClose }) {
  const tones = {
    success: 'bg-success-soft text-success-ink border-success/35',
    danger: 'bg-danger-soft text-danger-ink border-danger/35',
    warn: 'bg-warn-soft text-warn-ink border-warn/40',
    info: 'bg-info-soft text-info-ink border-info/35',
  };
  const icons = { success: 'check', danger: 'close', warn: 'bell', info: 'bell' };
  return (
    <div className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm shadow-card ${tones[tone]}`}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/60">
          <Icon name={icons[tone]} className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">{children}</div>
      </div>
      {onClose && (
        <button onClick={onClose} className="shrink-0 opacity-70 hover:opacity-100" aria-label="Tutup">
          <Icon name="close" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function Tabs({ items, value, onChange, className = '' }) {
  return (
    <div
      className={`flex gap-1.5 overflow-x-auto rounded-2xl border border-line bg-[rgb(var(--c-surface)/0.72)] p-1.5 shadow-glass backdrop-blur ${className}`}
    >
      {items.map(it => (
        <button
          key={it.key}
          onClick={() => onChange(it.key)}
          className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition sm:text-sm ${
            value === it.key
              ? 'bg-brand text-white shadow-glow'
              : 'text-muted hover:bg-accent/10 hover:text-ink'
          }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function ScoreBadge({ score }) {
  if (score === null || score === undefined) return <span className="badge-neutral">-</span>;
  const n = Number(score);
  const tone = n >= 85 ? 'badge-success' : n >= 70 ? 'badge-warn' : 'badge-danger';
  return <span className={`${tone} tabular-nums shadow-sm`}>{n}</span>;
}

export function Badge({ children, tone = 'neutral', size = 'md', className = '' }) {
  const tones = {
    accent: 'badge-accent',
    success: 'badge-success',
    warn: 'badge-warn',
    danger: 'badge-danger',
    info: 'badge-info',
    neutral: 'badge-neutral',
  };
  const sizes = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${tones[tone] || tones.neutral} ${sizes[size] || sizes.md} ${className}`}>
      {children}
    </span>
  );
}

export function Toolbar({ children, className = '' }) {
  return <div className={`mb-4 flex flex-col gap-2 sm:flex-row sm:items-center ${className}`}>{children}</div>;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  ...props
}) {
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
    success: 'btn-success',
    warn: 'btn-warn',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-medium rounded-lg transition ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="animate-spin h-4 w-4 rounded-full border-2 border-white/30 border-t-white" />}
      {children}
    </button>
  );
}

export function Input({
  value,
  onChange,
  type = 'text',
  placeholder = '',
  label,
  hint,
  error,
  className = '',
  ...props
}) {
  return (
    <label className="block">
      {label && <span className="label">{label}</span>}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`input ${error ? 'border-danger' : ''} ${className}`}
        aria-invalid={error ? 'true' : 'false'}
        {...props}
      />
      {error && <span className="mt-1 block text-[11px] text-danger">{error}</span>}
      {hint && !error && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}
