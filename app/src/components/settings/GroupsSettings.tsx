import { useEffect, useState } from 'react'
import { getAuthToken } from '../../lib/auth'

interface Group {
  id: string; name: string; description: string | null; createdAt: string
}
interface DeviceAssignment {
  deviceId: string; permission: string; deviceName: string; deviceUniqueId: string
}
interface UserMember {
  userId: string; userEmail: string; userName: string; userRole: string
}

function authFetch(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> || {}) }
  const token = getAuthToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(path, { ...options, headers })
}

export default function GroupsSettings({ showToast }: { showToast: (msg: string) => void }) {
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [devices, setDevices] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [assignments, setAssignments] = useState<DeviceAssignment[]>([])
  const [members, setMembers] = useState<UserMember[]>([])
  const [newGroupName, setNewGroupName] = useState('')
  const [showNewGroup, setShowNewGroup] = useState(false)

  const load = () => {
    authFetch('/api/groups').then(r => r.json()).then(d => setGroups(d.data || d)).catch(() => {})
    authFetch('/api/devices').then(r => r.json()).then(d => setDevices(d.data || d)).catch(() => {})
    authFetch('/api/users').then(r => r.json()).then(d => setUsers(d.data || d)).catch(() => {})
  }

  useEffect(load, [])

  useEffect(() => {
    if (!selectedGroup) { setAssignments([]); setMembers([]); return }
    authFetch(`/api/groups/${selectedGroup.id}/devices`).then(r => r.ok ? r.json() : []).then(setAssignments).catch(() => {})
    authFetch(`/api/groups/${selectedGroup.id}/users`).then(r => r.ok ? r.json() : []).then(setMembers).catch(() => {})
  }, [selectedGroup])

  const createGroup = async () => {
    if (!newGroupName.trim()) return
    const res = await authFetch('/api/groups', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newGroupName.trim() }),
    })
    if (res.ok) {
      setNewGroupName(''); setShowNewGroup(false); load()
      showToast('Group created')
    }
  }

  const deleteGroup = async (id: string) => {
    if (!confirm('Delete this group?')) return
    const res = await authFetch(`/api/groups/${id}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) {
      if (selectedGroup?.id === id) setSelectedGroup(null)
      load(); showToast('Group deleted')
    }
  }

  const addDeviceToGroup = async (deviceId: string) => {
    if (!selectedGroup) return
    const res = await authFetch(`/api/groups/${selectedGroup.id}/devices`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, permission: 'view' }),
    })
    if (res.ok) {
      authFetch(`/api/groups/${selectedGroup.id}/devices`).then(r => r.ok ? r.json() : []).then(setAssignments)
      showToast('Device added')
    }
  }

  const removeDevice = async (deviceId: string) => {
    if (!selectedGroup) return
    const res = await authFetch(`/api/groups/${selectedGroup.id}/devices/${deviceId}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) {
      setAssignments(prev => prev.filter(a => a.deviceId !== deviceId))
      showToast('Device removed')
    }
  }

  const updatePermission = async (deviceId: string, permission: string) => {
    if (!selectedGroup) return
    const res = await authFetch(`/api/groups/${selectedGroup.id}/devices/${deviceId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permission }),
    })
    if (res.ok) {
      setAssignments(prev => prev.map(a => a.deviceId === deviceId ? { ...a, permission } : a))
    }
  }

  const addUserToGroup = async (userId: string) => {
    if (!selectedGroup) return
    const res = await authFetch(`/api/groups/${selectedGroup.id}/users`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    if (res.ok) {
      authFetch(`/api/groups/${selectedGroup.id}/users`).then(r => r.ok ? r.json() : []).then(setMembers)
      showToast('User added')
    }
  }

  const removeUser = async (userId: string) => {
    if (!selectedGroup) return
    const res = await authFetch(`/api/groups/${selectedGroup.id}/users/${userId}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) {
      setMembers(prev => prev.filter(m => m.userId !== userId))
      showToast('User removed')
    }
  }

  const assignedDeviceIds = new Set(assignments.map(a => a.deviceId))
  const memberUserIds = new Set(members.map(m => m.userId))

  return (
    <div className="p-6 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold">Groups</h1>
          <p className="text-xs text-text-muted mt-0.5">Manage device access via groups</p>
        </div>
        <button onClick={() => setShowNewGroup(true)} className="px-3.5 py-1.5 rounded-lg bg-cyan text-bg text-xs font-semibold border-none cursor-pointer hover:opacity-85">+ New Group</button>
      </div>

      {showNewGroup && (
        <div className="bg-surface border border-border rounded-lg p-4 mb-4 flex items-center gap-3">
          <input className="flex-1 bg-surface-2 border border-border rounded px-2.5 py-1.5 text-xs text-text outline-none focus:border-cyan" placeholder="Group name" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createGroup()} autoFocus />
          <button onClick={createGroup} disabled={!newGroupName.trim()} className="px-3.5 py-1.5 rounded-lg bg-cyan text-bg text-xs font-semibold border-none cursor-pointer hover:opacity-85 disabled:opacity-50">Create</button>
          <button onClick={() => setShowNewGroup(false)} className="px-3.5 py-1.5 rounded-lg bg-transparent text-text-muted border border-border text-xs cursor-pointer hover:bg-surface-2">Cancel</button>
        </div>
      )}

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Group list */}
        <div className="w-56 bg-surface border border-border rounded-lg overflow-y-auto shrink-0">
          {groups.map(g => (
            <button
              key={g.id}
              onClick={() => setSelectedGroup(g)}
              className={`w-full text-left px-3.5 py-3 border-b border-border last:border-b-0 cursor-pointer transition-colors ${
                selectedGroup?.id === g.id ? 'bg-cyan-dim' : 'hover:bg-surface-2'
              }`}
            >
              <div className="text-sm font-medium">{g.name}</div>
              <div className="text-[11px] text-text-muted mt-0.5">{g.description || 'No description'}</div>
            </button>
          ))}
          {groups.length === 0 && <p className="p-4 text-xs text-text-muted">No groups yet.</p>}
        </div>

        {/* Group detail */}
        {selectedGroup && (
          <div className="flex-1 bg-surface border border-border rounded-lg overflow-y-auto p-4 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">{selectedGroup.name}</h2>
                <p className="text-xs text-text-muted">{selectedGroup.description}</p>
              </div>
              <button onClick={() => deleteGroup(selectedGroup.id)} className="px-2.5 py-1 rounded text-[11px] text-red bg-transparent border border-border cursor-pointer hover:bg-[rgba(239,68,68,0.1)]">Delete Group</button>
            </div>

            {/* Devices */}
            <div>
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Devices ({assignments.length})</h3>
              <div className="space-y-1.5">
                {assignments.map(a => (
                  <div key={a.deviceId} className="flex items-center gap-2 bg-surface-2 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{a.deviceName}</div>
                      <div className="text-[10px] text-text-muted font-mono">{a.deviceUniqueId}</div>
                    </div>
                    <select
                      value={a.permission}
                      onChange={e => updatePermission(a.deviceId, e.target.value)}
                      className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold border-none outline-none cursor-pointer bg-surface text-text"
                    >
                      <option value="view">View</option>
                      <option value="manage">Manage</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button onClick={() => removeDevice(a.deviceId)} className="text-red text-[10px] bg-transparent border-none cursor-pointer hover:underline">Remove</button>
                  </div>
                ))}
                {assignments.length === 0 && <p className="text-xs text-text-muted">No devices assigned.</p>}
              </div>
              <div className="mt-2 flex gap-1">
                <select
                  className="flex-1 bg-surface-2 border border-border rounded px-2 py-1 text-xs text-text outline-none focus:border-cyan"
                  value=""
                  onChange={e => { if (e.target.value) addDeviceToGroup(e.target.value); e.target.value = '' }}
                >
                  <option value="">Add device...</option>
                  {devices.filter(d => !assignedDeviceIds.has(d.id)).map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.uniqueId})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Users */}
            <div>
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Members ({members.length})</h3>
              <div className="space-y-1.5">
                {members.map(m => (
                  <div key={m.userId} className="flex items-center gap-2 bg-surface-2 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium">{m.userName}</div>
                      <div className="text-[10px] text-text-muted">{m.userEmail} · {m.userRole}</div>
                    </div>
                    <button onClick={() => removeUser(m.userId)} className="text-red text-[10px] bg-transparent border-none cursor-pointer hover:underline">Remove</button>
                  </div>
                ))}
                {members.length === 0 && <p className="text-xs text-text-muted">No members.</p>}
              </div>
              <div className="mt-2 flex gap-1">
                <select
                  className="flex-1 bg-surface-2 border border-border rounded px-2 py-1 text-xs text-text outline-none focus:border-cyan"
                  value=""
                  onChange={e => { if (e.target.value) addUserToGroup(e.target.value); e.target.value = '' }}
                >
                  <option value="">Add user...</option>
                  {users.filter((u: any) => !memberUserIds.has(u.id)).map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
        {!selectedGroup && groups.length > 0 && (
          <div className="flex-1 flex items-center justify-center text-text-muted text-sm">Select a group to manage</div>
        )}
      </div>
    </div>
  )
}
