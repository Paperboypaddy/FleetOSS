import { useEffect, useState } from 'react'
import { getAuthToken } from '../../lib/auth'

function authFetch(path: string) {
  const token = getAuthToken()
  return fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

function extractData(res: any): any[] {
  if (res && typeof res === 'object' && 'data' in res && Array.isArray(res.data)) return res.data
  if (Array.isArray(res)) return res
  return []
}

interface MaintItem {
  id: string; deviceId: string; name: string; type: string
  intervalDays: number | null; intervalMeters: number | null
  lastOdometer: number | null; lastDate: string | null
  dueOdometer: number | null; dueDate: string | null
  notes: string | null
  createdAt: string
}

interface MaintPanelProps { showToast: (msg: string) => void }

function typeColor(t: string) {
  return t === 'oil' ? '#EF4444' : t === 'tires' ? '#F59E0B' : t === 'brakes' ? '#EF4444' : t === 'inspection' ? '#10B981' : '#64748B'
}

export default function MaintPanel({ showToast }: MaintPanelProps) {
  const [items, setItems] = useState<MaintItem[]>([])
  const [devices, setDevices] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ deviceId: '', name: '', type: 'other', notes: '' })

  useEffect(() => {
    authFetch('/api/maintenance').then(r => r.json()).then(data => setItems(extractData(data))).catch(() => {})
    authFetch('/api/devices').then(r => r.json()).then(data => setDevices(extractData(data))).catch(() => {})
  }, [])

  const addItem = async () => {
    if (!form.deviceId || !form.name) return
    const token = getAuthToken()
    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        const item = await res.json()
        setItems(prev => [item, ...prev])
        setShowForm(false)
        setForm({ deviceId: '', name: '', type: 'other', notes: '' })
        showToast('Service item added')
      }
    } catch {}
  }

  const deleteItem = async (id: string) => {
    if (!confirm('Delete this service item?')) return
    const token = getAuthToken()
    await fetch(`/api/maintenance/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    setItems(prev => prev.filter(i => i.id !== id))
    showToast('Item removed')
  }

  const deviceNames = new Map(devices.map((d: any) => [d.id, d.name]))

  return (
    <div id="panel-maint" className="flex flex-col w-full h-full overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">Service Items</h2>
        <button className="px-3 py-1.5 rounded-lg bg-cyan text-bg text-xs font-semibold cursor-pointer hover:opacity-85 border-none" onClick={() => setShowForm(!showForm)}>+ New</button>
      </div>

      {showForm && (
        <div className="p-4 bg-surface border-b border-border flex flex-wrap gap-2 items-end">
          <select className="bg-surface-2 border border-border rounded px-2.5 py-1.5 text-xs text-text outline-none focus:border-cyan" value={form.deviceId} onChange={e => setForm(f => ({ ...f, deviceId: e.target.value }))}>
            <option value="">Select device</option>
            {devices.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input className="bg-surface-2 border border-border rounded px-2.5 py-1.5 text-xs text-text outline-none focus:border-cyan w-36" placeholder="Item name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <select className="bg-surface-2 border border-border rounded px-2.5 py-1.5 text-xs text-text outline-none focus:border-cyan" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            <option value="oil">Oil</option><option value="tires">Tires</option><option value="brakes">Brakes</option>
            <option value="service">Service</option><option value="inspection">Inspection</option><option value="other">Other</option>
          </select>
          <input className="bg-surface-2 border border-border rounded px-2.5 py-1.5 text-xs text-text outline-none focus:border-cyan w-44" placeholder="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          <button className="px-3 py-1.5 rounded-lg bg-cyan text-bg text-xs font-semibold cursor-pointer hover:opacity-85 border-none" onClick={addItem}>Add</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2">
        {items.length === 0 && (
          <div className="text-center py-12 text-text-muted text-sm">No service items yet. Tap "+ New" to add one.</div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {items.map(item => (
            <div key={item.id} className="bg-surface border border-border rounded-lg p-3.5">
              <div className="flex items-start justify-between mb-1.5">
                <div>
                  <span className="text-sm font-semibold">{item.name}</span>
                  <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: typeColor(item.type) + '22', color: typeColor(item.type) }}>{item.type}</span>
                </div>
                <button className="text-red text-[10px] bg-transparent border-none cursor-pointer hover:underline shrink-0" onClick={() => deleteItem(item.id)}>✕</button>
              </div>
              <div className="text-xs text-text-muted mb-1">{deviceNames.get(item.deviceId) || 'Unknown device'}</div>
              {item.notes && <div className="text-xs text-text-dim mt-1">{item.notes}</div>}
              {item.dueOdometer && <div className="text-[10px] font-mono text-text-muted mt-1">Due: {item.dueOdometer.toLocaleString()} mi</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
