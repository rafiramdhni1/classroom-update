import { useStaff } from './staffStore';

export default function MonitoringMenu() {
  const { loadMonitoring, monitoring, monitoringLoading } = useStaff();
  return (
<div className="space-y-4">
  <div className="card card-pad">
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-semibold text-ink">System Status</h3>
      <button
        onClick={loadMonitoring}
        disabled={monitoringLoading}
        className="btn-soft px-3 py-1.5 text-xs disabled:opacity-50"
      >
        {monitoringLoading ? 'Loading...' : 'Refresh'}
      </button>
    </div>

    {!monitoring ? (
      <p className="text-sm text-muted text-center py-4">Klik Refresh untuk melihat status.</p>
    ) : (
      <div className="space-y-4">
        {/* Server */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface2/70 p-3 text-center">
            <div className="text-lg font-bold text-accent">{monitoring.server?.uptime}s</div>
            <div className="text-xs text-muted">Uptime</div>
          </div>
          <div className="rounded-xl bg-surface2/70 p-3 text-center">
            <div className="text-lg font-bold text-success">{monitoring.database?.status}</div>
            <div className="text-xs text-muted">Database</div>
          </div>
          <div className="rounded-xl bg-surface2/70 p-3 text-center">
            <div className="text-lg font-bold text-ink">{monitoring.memory?.percentage}%</div>
            <div className="text-xs text-muted">RAM ({monitoring.memory?.used})</div>
          </div>
          <div className="rounded-xl bg-surface2/70 p-3 text-center">
            <div className="text-lg font-bold text-info">{monitoring.requests?.total || 0}</div>
            <div className="text-xs text-muted">Total Request</div>
          </div>
        </div>

        {/* Error rate */}
        <div className="rounded-xl bg-surface2/70 p-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-ink">Error Rate</span>
            <span className={`text-sm font-bold ${
              monitoring.requests?.errorRate === '0%' ? 'text-success' : 'text-danger'
            }`}>
              {monitoring.requests?.errorRate || '0%'}
            </span>
          </div>
        </div>

        {/* Top routes */}
        {monitoring.requests?.topRoutes?.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted uppercase mb-2">Top Routes</h4>
            <div className="space-y-1">
              {monitoring.requests.topRoutes.map((r, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-surface2/70 px-3 py-2 text-xs">
                  <span className="font-mono text-ink truncate flex-1">{r.route}</span>
                  <span className="ml-2 text-muted">{r.count}x</span>
                  {r.errors > 0 && <span className="ml-2 text-danger">{r.errors} err</span>}
                  <span className="ml-2 text-muted">{r.avgDuration}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent errors */}
        {monitoring.errors?.recent?.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted uppercase mb-2">Recent Errors</h4>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {monitoring.errors.recent.map((e, i) => (
                <div key={i} className="bg-danger-soft rounded-lg px-3 py-2 text-xs">
                  <span className="text-danger font-mono">{e.source}</span>
                  <span className="text-muted ml-2">{e.message}</span>
                  <span className="text-muted ml-2 block">{new Date(e.timestamp).toLocaleString('id-ID')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Log files */}
        {monitoring.logs?.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted uppercase mb-2">Log Files</h4>
            <div className="space-y-1">
              {monitoring.logs.map((l, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-surface2/70 px-3 py-2 text-xs">
                  <span className="font-mono text-ink">{l.name}</span>
                  <span className="text-muted">{l.size}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )}
  </div>
</div>
  );
}
