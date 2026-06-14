import { useEffect, useState } from 'react';

interface ServerStats {
  devices: number
  positions: number
  trips: number
  onlineDevices: number
  lastPosition: string | null
  byProtocol: { protocol: string; count: number }[]
  server: { port: number; traccarPort: number; uptime: number }
}

interface SettingsPanelProps {
  showToast: (msg: string) => void
}

export default function SettingsPanel({ showToast }: SettingsPanelProps) {
  const [stats, setStats] = useState<ServerStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [devices, setDevices] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false))
    fetch('/api/devices')
      .then(r => r.json())
      .then(setDevices)
      .catch(() => {})
  }, [])

  const fmtUptime = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    return `${h}h ${m}m`
  }

  const fmtTime = (iso: string | null) => {
    if (!iso) return 'N/A'
    const d = new Date(iso)
    return d.toLocaleString()
  }

  return (
    <div id="panel-settings" className="flex w-full h-full overflow-y-auto">
      <div className="flex-1 p-6 max-w-4xl">
        <h1 className="text-lg font-semibold mb-1">Settings & Admin</h1>
        <p className="text-xs text-text-muted mb-6">Server status and management</p>

        {loading ? (
          <div className="text-sm text-text-muted">Loading...</div>
        ) : stats ? (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Devices', val: stats.devices, color: 'text-cyan' },
                { label: 'Positions', val: stats.positions.toLocaleString(), color: 'text-green' },
                { label: 'Trips', val: stats.trips, color: 'text-amber' },
                { label: 'Online', val: stats.onlineDevices, color: 'text-green' },
              ].map((s, i) => (
                <div key={i} className="bg-surface border border-border rounded-lg p-3.5">
                  <div className="text-[11px] text-text-muted mb-1 uppercase tracking-wider">{s.label}</div>
                  <div className={`font-mono text-lg font-bold ${s.color}`}>{s.val}</div>
                </div>
              ))}
            </div>

            {/* Server Info */}
            <div className="bg-surface border border-border rounded-lg p-4 mb-6">
              <h2 className="text-sm font-semibold mb-3">Server</h2>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><span className="text-text-muted">API Port:</span> <span className="font-mono ml-2">{stats.server.port}</span></div>
                <div><span className="text-text-muted">Traccar Port:</span> <span className="font-mono ml-2">{stats.server.traccarPort}</span></div>
                <div><span className="text-text-muted">Uptime:</span> <span className="font-mono ml-2">{fmtUptime(stats.server.uptime)}</span></div>
                <div><span className="text-text-muted">Last Position:</span> <span className="font-mono ml-2">{fmtTime(stats.lastPosition)}</span></div>
              </div>
            </div>

            {/* Protocol Breakdown */}
            <div className="bg-surface border border-border rounded-lg p-4 mb-6">
              <h2 className="text-sm font-semibold mb-3">Ingestion Protocols</h2>
              <div className="space-y-1.5">
                {stats.byProtocol.map((p, i) => {
                  const maxCount = Math.max(...stats.byProtocol.map(x => x.count))
                  const pct = (p.count / maxCount) * 100
                  return (
                    <div key={i} className="flex items-center gap-3 text-xs">
                      <span className="w-32 text-text-muted truncate">{p.protocol}</span>
                      <div className="flex-1 h-4 bg-border rounded overflow-hidden">
                        <div className="h-full bg-cyan rounded transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="font-mono w-16 text-right text-text">{p.count}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Device Management */}
            <div className="bg-surface border border-border rounded-lg p-4 mb-6">
              <h2 className="text-sm font-semibold mb-3">Devices</h2>
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {devices.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between py-1.5 border-b border-[rgba(46,54,80,0.5)] last:border-0 text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${d.status === 'online' ? 'bg-green' : 'bg-text-muted'}`} />
                      <span className="font-medium">{d.name}</span>
                      <span className="text-text-muted font-mono">({d.uniqueId})</span>
                    </div>
                    <span className={`font-mono ${d.status === 'online' ? 'text-green' : 'text-text-muted'}`}>{d.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="text-sm text-red">Failed to load server stats</div>
        )}
      </div>
    </div>
  );
}
