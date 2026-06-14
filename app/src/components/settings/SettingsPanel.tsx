import { useEffect, useState } from 'react'
import { getAuthToken } from '../../lib/auth'
import SsoSettings from './SsoSettings'

interface ServerStats {
  devices: number; positions: number; trips: number; onlineDevices: number
  lastPosition: string | null
  byProtocol: { protocol: string; count: number }[]
  server: { port: number; traccarPort: number; uptime: number }
}

interface User { id: string; email: string; name: string; role: string; createdAt: string }
interface Device {
  id: string; name: string; uniqueId: string; status: string; attributes: Record<string, any>
  plate?: string | null
}

type SettingsTab = 'general' | 'users' | 'devices' | 'personal' | 'sso'

function authFetch(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> || {}) }
  const token = getAuthToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(path, { ...options, headers })
}

const THEMES = [
  { id: 'default', label: 'Cyan', dark: '#00D4FF', light: '#0284C7' },
  { id: 'emerald', label: 'Emerald', dark: '#10B981', light: '#059669' },
  { id: 'violet', label: 'Violet', dark: '#8B5CF6', light: '#7C3AED' },
  { id: 'rose', label: 'Rose', dark: '#F43F5E', light: '#E11D48' },
  { id: 'amber', label: 'Amber', dark: '#F59E0B', light: '#D97706' },
]

export default function SettingsPanel({ showToast, colorTheme, onColorThemeChange }: { showToast: (msg: string) => void; colorTheme: string; onColorThemeChange: (t: string) => void }) {
  const [tab, setTab] = useState<SettingsTab>('general')
  const [stats, setStats] = useState<ServerStats | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [unregistered, setUnregistered] = useState<Device[]>([])
  const [newUser, setNewUser] = useState({ email: '', name: '', password: '', role: 'viewer' })
  const [creating, setCreating] = useState(false)
  const [siteName, setSiteName] = useState(localStorage.getItem('fleetoss-site-name') || 'FleetOSS')
  const [logo, setLogo] = useState<string | null>(localStorage.getItem('fleetoss-logo'))
  const [newDevice, setNewDevice] = useState({ uniqueId: '', name: '' })
  const [registering, setRegistering] = useState(false)

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setStats).catch(() => {})
    authFetch('/api/users').then(r => r.ok ? r.json() : []).then(setUsers).catch(() => {})
    fetch('/api/devices').then(r => r.json()).then(setDevices).catch(() => {})
    authFetch('/api/devices/unregistered').then(r => r.ok ? r.json() : []).then(setUnregistered).catch(() => {})
  }, [])

  const addDevice = async (device: Device) => {
    try {
      const res = await authFetch(`/api/devices/${device.id}/approve`, { method: 'PATCH' })
      if (res.ok) {
        const updated = await res.json()
        setDevices(prev => [...prev, updated])
        setUnregistered(prev => prev.filter(d => d.id !== device.id))
        showToast(`Added "${device.name}"`)
      } else {
        const err = await res.json()
        showToast(err.error || 'Failed to add device')
      }
    } catch { showToast('Failed to add device') }
  }

  const registerDevice = async () => {
    if (!newDevice.uniqueId.trim()) return
    setRegistering(true)
    try {
      const res = await authFetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uniqueId: newDevice.uniqueId.trim(), name: newDevice.name.trim() || newDevice.uniqueId.trim() }),
      })
      if (res.ok) {
        const d = await res.json()
        setDevices(prev => [...prev, d])
        setNewDevice({ uniqueId: '', name: '' })
        showToast(`Registered "${d.name}"`)
      } else {
        const err = await res.json()
        showToast(err.error || 'Failed to register device')
      }
    } catch { showToast('Failed to register device') }
    setRegistering(false)
  }

  const createUser = async () => {
    if (!newUser.email || !newUser.name || !newUser.password) return
    setCreating(true)
    try {
      const res = await authFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      })
      if (res.ok) {
        const u = await res.json()
        setUsers(prev => [...prev, u])
        setNewUser({ email: '', name: '', password: '', role: 'viewer' })
        showToast(`Created ${u.name}`)
      } else {
        const err = await res.json()
        showToast(err.error || 'Failed')
      }
    } catch { showToast('Failed to create user') }
    setCreating(false)
  }

  const deleteUser = async (id: string) => {
    if (!confirm('Delete this user?')) return
    try {
      const res = await authFetch(`/api/users/${id}`, { method: 'DELETE' })
      if (res.ok || res.status === 204) {
        setUsers(prev => prev.filter(u => u.id !== id))
        showToast('User deleted')
      }
    } catch { showToast('Failed to delete user') }
  }

  const toggleTripDetection = async (device: Device) => {
    const current = device.attributes?.skipTripDetection === true
    try {
      const res = await authFetch(`/api/devices/${device.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attributes: { skipTripDetection: !current } }),
      })
      if (res.ok) {
        const updated = await res.json()
        setDevices(prev => prev.map(d => d.id === device.id ? updated : d))
        showToast(!current ? 'Trip detection disabled' : 'Trip detection enabled')
      }
    } catch { showToast('Failed to update device') }
  }

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'personal', label: 'Personal' },
    { id: 'users', label: 'Users' },
    { id: 'devices', label: 'Devices' },
    { id: 'sso', label: 'SSO' },
  ]

  const fmtUptime = (s: number) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`

  return (
    <div id="panel-settings" className="flex w-full h-full">
      {/* Sidebar */}
      <div className="w-44 bg-surface border-r border-border flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-border">
          <span className="text-xs font-semibold text-text-dim uppercase tracking-wider">Settings</span>
        </div>
        <div className="flex-1 flex flex-col p-2">
          <div className="flex-1 space-y-0.5">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  tab === t.id ? 'bg-cyan-dim text-cyan' : 'text-text-muted hover:bg-surface-2 hover:text-text-dim'
                }`}
              >{t.label}</button>
            ))}
          </div>
          <button
            onClick={() => { localStorage.removeItem('fleetoss-token'); localStorage.removeItem('fleetoss-user'); window.location.reload() }}
            className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-red hover:bg-[rgba(239,68,68,0.1)] transition-colors cursor-pointer mt-auto"
          >Logout</button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'general' && (
          <div className="p-6">
            <h1 className="text-lg font-semibold mb-1">General</h1>
            <p className="text-xs text-text-muted mb-6">Server status and information</p>

            <div className="bg-surface border border-border rounded-lg p-4 mb-6">
              <h2 className="text-sm font-semibold mb-3">Branding</h2>
              <div className="flex items-start gap-6 flex-wrap">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-text-muted">Site Name</label>
                  <input
                    className="bg-surface-2 border border-border rounded px-2.5 py-1.5 text-xs text-text outline-none focus:border-cyan w-44"
                    value={siteName}
                    onChange={e => {
                      setSiteName(e.target.value)
                      localStorage.setItem('fleetoss-site-name', e.target.value)
                    }}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-text-muted">Logo</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        className="hidden"
                        id="logo-upload"
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          const reader = new FileReader()
                          reader.onload = () => {
                            localStorage.setItem('fleetoss-logo', reader.result as string)
                            setLogo(reader.result as string)
                          }
                          reader.readAsDataURL(file)
                        }}
                      />
                      <label
                        htmlFor="logo-upload"
                        className="px-3 py-1.5 rounded-lg bg-cyan text-bg text-xs font-semibold cursor-pointer hover:opacity-85 transition-opacity"
                      >Choose File</label>
                      {logo ? (
                        <button
                          className="px-3 py-1.5 rounded-lg bg-transparent text-red border border-border text-xs cursor-pointer hover:bg-[rgba(239,68,68,0.1)] transition-colors"
                          onClick={() => { setLogo(null); localStorage.removeItem('fleetoss-logo') }}
                        >Remove</button>
                      ) : null}
                    </div>
                  </div>
                  {logo && (
                    <img src={logo} alt="Logo preview" className="h-10 w-auto max-w-[120px] object-contain bg-surface-2 border border-border rounded-lg p-1.5" />
                  )}
                </div>
              </div>
            </div>

            {stats ? (
              <>
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
                <div className="bg-surface border border-border rounded-lg p-4 mb-6">
                  <h2 className="text-sm font-semibold mb-3">Server</h2>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div><span className="text-text-muted">API Port:</span> <span className="font-mono ml-2">{stats.server.port}</span></div>
                    <div><span className="text-text-muted">Traccar Port:</span> <span className="font-mono ml-2">{stats.server.traccarPort}</span></div>
                    <div><span className="text-text-muted">Uptime:</span> <span className="font-mono ml-2">{fmtUptime(stats.server.uptime)}</span></div>
                    <div><span className="text-text-muted">Last Position:</span> <span className="font-mono ml-2">{stats.lastPosition ? new Date(stats.lastPosition).toLocaleString() : 'N/A'}</span></div>
                  </div>
                </div>
                <div className="bg-surface border border-border rounded-lg p-4">
                  <h2 className="text-sm font-semibold mb-3">Protocols</h2>
                  <div className="space-y-1.5">
                    {stats.byProtocol.map((p, i) => {
                      const maxCount = Math.max(...stats.byProtocol.map(x => x.count))
                      return (
                        <div key={i} className="flex items-center gap-3 text-xs">
                          <span className="w-32 text-text-muted truncate">{p.protocol}</span>
                          <div className="flex-1 h-4 bg-border rounded overflow-hidden">
                            <div className="h-full bg-cyan rounded" style={{ width: `${(p.count / maxCount) * 100}%` }} />
                          </div>
                          <span className="font-mono w-16 text-right text-text">{p.count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            ) : <p className="text-text-muted text-sm">Loading...</p>}
          </div>
        )}

        {tab === 'personal' && (
          <div className="p-6">
            <h1 className="text-lg font-semibold mb-1">Personal</h1>
            <p className="text-xs text-text-muted mb-6">Account preferences and appearance</p>

            <div className="bg-surface border border-border rounded-lg p-4">
              <h2 className="text-sm font-semibold mb-3">Color Theme</h2>
              <div className="flex flex-wrap gap-3">
                {THEMES.map(t => {
                  const active = colorTheme === t.id
                  return (
                    <button
                      key={t.id}
                      onClick={() => onColorThemeChange(t.id)}
                      className={`relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all min-w-[90px] ${
                        active
                          ? 'border-cyan bg-cyan-dim'
                          : 'border-border bg-surface-2 hover:border-text-muted'
                      }`}
                    >
                      <div className="flex gap-1">
                        <div className="w-6 h-6 rounded-full" style={{ backgroundColor: t.dark }} />
                        <div className="w-6 h-6 rounded-full" style={{ backgroundColor: t.light }} />
                      </div>
                      <span className={`text-xs font-medium ${active ? 'text-cyan' : 'text-text-dim'}`}>{t.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div className="p-6">
            <h1 className="text-lg font-semibold mb-1">Users</h1>
            <p className="text-xs text-text-muted mb-4">Manage who can access FleetOSS</p>

            {/* Create user */}
            <div className="bg-surface border border-border rounded-lg p-4 mb-6">
              <h2 className="text-sm font-semibold mb-3">Add User</h2>
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-text-muted">Email</label>
                  <input className="bg-surface-2 border border-border rounded px-2.5 py-1.5 text-xs text-text outline-none focus:border-cyan w-44" type="email" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-text-muted">Name</label>
                  <input className="bg-surface-2 border border-border rounded px-2.5 py-1.5 text-xs text-text outline-none focus:border-cyan w-36" value={newUser.name} onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-text-muted">Password</label>
                  <input className="bg-surface-2 border border-border rounded px-2.5 py-1.5 text-xs text-text outline-none focus:border-cyan w-32" type="password" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-text-muted">Role</label>
                  <select className="bg-surface-2 border border-border rounded px-2.5 py-1.5 text-xs text-text outline-none focus:border-cyan w-24" value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}>
                    <option value="viewer">Viewer</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <button className="px-3.5 py-1.5 rounded-lg bg-cyan text-bg text-xs font-semibold border-none cursor-pointer hover:opacity-85 disabled:opacity-50" disabled={creating} onClick={createUser}>Add</button>
              </div>
            </div>

            {/* User list */}
            <div className="bg-surface border border-border rounded-lg overflow-hidden">
              <table className="w-full border-collapse">
                <thead><tr>
                  {['Name', 'Email', 'Role', 'Created', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider border-b border-border">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-[rgba(46,54,80,0.5)] text-xs">
                      <td className="px-4 py-2.5 font-medium">{u.name}</td>
                      <td className="px-4 py-2.5 text-text-muted">{u.email}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-semibold ${
                          u.role === 'admin' ? 'bg-cyan-dim text-cyan' : u.role === 'manager' ? 'bg-amber-dim text-amber' : 'bg-surface-2 text-text-muted'
                        }`}>{u.role}</span>
                      </td>
                      <td className="px-4 py-2.5 text-text-muted font-mono">{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5">
                        <button className="text-red text-[11px] bg-transparent border-none cursor-pointer hover:underline" onClick={() => deleteUser(u.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'devices' && (
          <div className="p-6">
            <h1 className="text-lg font-semibold mb-1">Devices</h1>
            <p className="text-xs text-text-muted mb-4">Add or configure devices</p>

            {/* Add Device form */}
            <div className="bg-surface border border-border rounded-lg p-4 mb-6">
              <h2 className="text-sm font-semibold mb-3">Add Device</h2>
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-text-muted">Unique ID</label>
                  <input className="bg-surface-2 border border-border rounded px-2.5 py-1.5 text-xs text-text outline-none focus:border-cyan w-44" value={newDevice.uniqueId} onChange={e => setNewDevice(p => ({ ...p, uniqueId: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-text-muted">Name (optional)</label>
                  <input className="bg-surface-2 border border-border rounded px-2.5 py-1.5 text-xs text-text outline-none focus:border-cyan w-36" value={newDevice.name} onChange={e => setNewDevice(p => ({ ...p, name: e.target.value }))} />
                </div>
                <button className="px-3.5 py-1.5 rounded-lg bg-cyan text-bg text-xs font-semibold border-none cursor-pointer hover:opacity-85 disabled:opacity-50" disabled={registering || !newDevice.uniqueId.trim()} onClick={registerDevice}>Register</button>
              </div>
            </div>

            {/* Unregistered devices */}
            {unregistered.length > 0 && (
              <div className="bg-surface border border-border rounded-lg overflow-hidden mb-6">
                <div className="px-4 py-2.5 border-b border-border text-xs font-semibold text-amber uppercase tracking-wider">
                  Devices Awaiting Approval ({unregistered.length})
                </div>
                <table className="w-full border-collapse">
                  <thead><tr>
                    {['Name', 'ID', 'Status', ''].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider border-b border-border">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {unregistered.map(d => (
                      <tr key={d.id} className="border-b border-[rgba(46,54,80,0.5)] text-xs">
                        <td className="px-4 py-2.5 font-medium">{d.name}</td>
                        <td className="px-4 py-2.5 text-text-muted font-mono">{d.uniqueId}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-text-muted flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-text-muted" />
                            unknown
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <button
                            className="px-3 py-1 rounded-md bg-cyan text-bg text-[11px] font-semibold border-none cursor-pointer hover:opacity-85"
                            onClick={() => addDevice(d)}
                          >Add</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Registered devices */}
            <div className="bg-surface border border-border rounded-lg overflow-hidden">
              <table className="w-full border-collapse">
                <thead><tr>
                  {['Name', 'ID', 'Status', 'Type', 'Trip Detection', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider border-b border-border">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {devices.map(d => {
                    const disabled = d.attributes?.skipTripDetection === true
                    const devType = d.attributes?.deviceType || ''
                    return (
                      <tr key={d.id} className="border-b border-[rgba(46,54,80,0.5)] text-xs">
                        <td className="px-4 py-2.5 font-medium">{d.name}</td>
                        <td className="px-4 py-2.5 text-text-muted font-mono">{d.uniqueId}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1.5 ${d.status === 'online' ? 'text-green' : 'text-text-muted'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${d.status === 'online' ? 'bg-green' : 'bg-text-muted'}`} />
                            {d.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                          <select
                            value={devType}
                            onChange={async e => {
                              const newType = e.target.value
                              try {
                                const res = await authFetch(`/api/devices/${d.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ attributes: { deviceType: newType || null } }),
                                })
                                if (res.ok) {
                                  const updated = await res.json()
                                  setDevices(prev => prev.map(x => x.id === d.id ? updated : x))
                                  showToast(newType ? `Set as ${newType}` : 'Type cleared')
                                }
                              } catch { showToast('Failed to update type') }
                            }}
                            className={`px-2 py-0.5 rounded font-mono text-[10px] font-semibold border-none outline-none cursor-pointer ${
                              devType === 'vehicle' ? 'bg-cyan-dim text-cyan' :
                              devType === 'phone' ? 'bg-amber-dim text-amber' :
                              devType === 'asset' ? 'bg-green-dim text-green' :
                              'bg-surface-2 text-text-muted'
                            }`}
                          >
                            <option value="" className="bg-bg text-text-muted">—</option>
                            <option value="phone" className="bg-bg text-amber">Phone</option>
                            <option value="vehicle" className="bg-bg text-cyan">Vehicle</option>
                            <option value="asset" className="bg-bg text-green">Asset</option>
                          </select>
                        </td>
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => toggleTripDetection(d)}
                            className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer border-none shrink-0 ${
                              disabled ? 'bg-amber' : 'bg-cyan'
                            }`}
                          >
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-bg shadow transition-transform ${
                              disabled ? 'translate-x-5' : 'translate-x-0'
                            }`} />
                          </button>
                          <span className="ml-2 text-text-muted font-mono text-[10px] align-middle">{disabled ? 'Disabled' : 'Active'}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <button
                            className="text-red text-[11px] bg-transparent border-none cursor-pointer hover:underline"
                            onClick={async () => {
                              if (!confirm(`Remove "${d.name}"?`)) return
                              try {
                                await authFetch(`/api/devices/${d.id}`, { method: 'DELETE' })
                                setDevices(prev => prev.filter(x => x.id !== d.id))
                                showToast('Device removed')
                              } catch { showToast('Failed') }
                            }}
                          >Remove</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {tab === 'sso' && <SsoSettings showToast={showToast} />}
      </div>
    </div>
  )
}
