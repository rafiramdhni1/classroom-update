const SERIES = ['rgb(var(--c-accent))', 'rgb(var(--c-success))', 'rgb(var(--c-warn))', 'rgb(var(--c-danger))', 'rgb(var(--c-info))'];

export function BarList({ data = [], max, suffix = '', showValue = true }) {
  const top = max ?? Math.max(1, ...data.map(d => Number(d.value) || 0));
  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div key={d.label + i}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate font-semibold text-ink">{d.label}</span>
            {showValue && (
              <span className="shrink-0 font-bold tabular-nums text-muted">
                {d.display ?? `${d.value}${suffix}`}
              </span>
            )}
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface2 ring-1 ring-line/70">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.max(2, ((Number(d.value) || 0) / top) * 100)}%`,
                background: d.color || SERIES[i % SERIES.length],
                boxShadow: `0 4px 14px -6px ${d.color || SERIES[i % SERIES.length]}`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ColumnChart({ data = [], height = 160, suffix = '' }) {
  const top = Math.max(1, ...data.map(d => Number(d.value) || 0));
  return (
    <div>
      <div className="flex items-end gap-2 sm:gap-3" style={{ height }}>
        {data.map((d, i) => {
          const v = Number(d.value) || 0;
          const pct = (v / top) * 100;
          return (
            <div key={d.label + i} className="group flex h-full flex-1 flex-col justify-end gap-1.5">
              <span className="text-center text-[10px] font-bold tabular-nums text-muted opacity-0 transition group-hover:opacity-100">
                {d.display ?? `${v}${suffix}`}
              </span>
              <div
                className="w-full rounded-t-xl transition-all duration-700 group-hover:brightness-110"
                style={{
                  height: `${Math.max(3, pct)}%`,
                  background:
                    d.color ||
                    'linear-gradient(180deg, rgb(var(--c-accent)) 0%, rgb(var(--c-accent-deep)) 100%)',
                  boxShadow: `0 10px 22px -14px ${d.color || 'rgb(var(--c-accent))'}`,
                }}
                title={`${d.label}: ${d.display ?? `${v}${suffix}`}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2 sm:gap-3">
        {data.map((d, i) => (
          <div key={d.label + i} className="flex-1 truncate text-center text-[10px] font-semibold text-muted" title={d.label}>
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export function LineChart({ points = [], height = 180, suffix = '' }) {
  if (!points.length) return null;
  const w = 100;
  const h = 40;
  const vals = points.map(p => Number(p.value) || 0);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const x = (i) => (points.length === 1 ? w / 2 : (i / (points.length - 1)) * w);
  const y = (v) => h - 4 - ((v - min) / range) * (h - 10);

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(vals[i]).toFixed(2)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(2)},${h} L${x(0).toFixed(2)},${h} Z`;

  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ height }} className="w-full overflow-visible">
          <defs>
            <linearGradient id="lcFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--c-accent))" stopOpacity="0.42" />
              <stop offset="100%" stopColor="rgb(var(--c-accent-2))" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="lcStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgb(var(--c-accent))" />
              <stop offset="100%" stopColor="rgb(var(--c-accent-2))" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map(g => (
            <line key={g} x1="0" y1={h * g} x2={w} y2={h * g} stroke="rgb(var(--c-line))" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={area} fill="url(#lcFill)" />
          <path d={line} fill="none" stroke="url(#lcStroke)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {points.map((p, i) => (
            <circle key={i} cx={x(i)} cy={y(vals[i])} r="1.6" fill="rgb(var(--c-surface))" stroke="rgb(var(--c-accent))" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-muted">{max}{suffix}</span>
          <span className="text-[10px] font-bold text-muted">{min}{suffix}</span>
        </div>
      </div>
      <div className="mt-2 flex justify-between gap-1">
        {points.map((p, i) => (
          <span key={i} className="truncate text-[10px] font-semibold text-muted" title={`${p.label}: ${p.value}${suffix}`}>
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Donut({ data = [], size = 150, thickness = 16, centerLabel, centerValue }) {
  const total = data.reduce((a, b) => a + (Number(b.value) || 0), 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--c-surface-2))" strokeWidth={thickness} />
          {data.map((d, i) => {
            const frac = (Number(d.value) || 0) / total;
            const len = frac * c;
            const el = (
              <circle
                key={d.label + i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={d.color || SERIES[i % SERIES.length]}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <div className="text-xl font-extrabold text-ink">{centerValue ?? total}</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted">{centerLabel}</div>
        </div>
      </div>
      <ul className="w-full space-y-2">
        {data.map((d, i) => (
          <li key={d.label + i} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color || SERIES[i % SERIES.length] }} />
              <span className="truncate font-semibold text-ink">{d.label}</span>
            </span>
            <span className="shrink-0 font-bold tabular-nums text-muted">
              {d.value}
              <span className="ml-1 font-medium text-muted/70">
                ({Math.round(((Number(d.value) || 0) / total) * 100)}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Progress({ value, max = 100, tone = 'accent', label, right }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const bar = {
    accent: 'rgb(var(--c-accent))',
    success: 'rgb(var(--c-success))',
    warn: 'rgb(var(--c-warn))',
    danger: 'rgb(var(--c-danger))',
    info: 'rgb(var(--c-info))',
  }[tone];
  return (
    <div>
      {(label || right) && (
        <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-ink">{label}</span>
          <span className="font-bold tabular-nums text-muted">{right ?? `${Math.round(pct)}%`}</span>
        </div>
      )}
      <div className="h-2.5 overflow-hidden rounded-full bg-surface2 ring-1 ring-line/70">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            backgroundImage:
              tone === 'accent'
                ? 'linear-gradient(90deg, rgb(var(--c-accent)), rgb(var(--c-accent-2)))'
                : `linear-gradient(90deg, ${bar}, ${bar})`,
            boxShadow: `0 6px 16px -8px ${bar}`,
          }}
        />
      </div>
    </div>
  );
}

export function Sparkline({ values = [], height = 40 }) {
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * 100;
    const y = 30 - ((v - min) / range) * 26;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" style={{ height }} className="w-full overflow-visible">
      <defs>
        <linearGradient id="spStroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgb(var(--c-accent))" />
          <stop offset="100%" stopColor="rgb(var(--c-accent-2))" />
        </linearGradient>
      </defs>
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="url(#spStroke)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
