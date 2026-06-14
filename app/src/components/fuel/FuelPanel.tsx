import { useEffect, useState } from 'react'

interface FuelEntry {
  id: string; deviceId: string; date: string
  odometer: number | null; gallons: number; pricePerGallon: number | null
  mpg: number | null; station: string | null; notes: string | null
}

interface FuelPanelProps { showToast: (msg: string) => void }

export default function FuelPanel({ showToast }: FuelPanelProps) {
  const [entries, setEntries] = useState<FuelEntry[]>([])
  const [devices, setDevices] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ deviceId: '', date: new Date().toISOString().split('T')[0], gallons: '', pricePerGallon: '', station: '', odometer: '' })

  useEffect(() => {
    fetch('/api/fuel').then(r => r.json()).then(setEntries).catch(() => {})
    fetch('/api/devices').then(r => r.json()).then(setDevices).catch(() => {})
  }, [])

  const addEntry = async () => {
    if (!form.deviceId || !form.gallons) return
    try {
      const res = await fetch('/api/fuel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: form.deviceId,
          date: new Date(form.date).toISOString(),
          gallons: parseFloat(form.gallons),
          pricePerGallon: form.pricePerGallon ? parseFloat(form.pricePerGallon) : undefined,
          station: form.station || undefined,
          odometer: form.odometer ? parseFloat(form.odometer) : undefined,
        }),
      })
      if (res.ok) {
        const entry = await res.json()
        setEntries(prev => [entry, ...prev])
        setShowForm(false)
        setForm({ deviceId: '', date: new Date().toISOString().split('T')[0], gallons: '', pricePerGallon: '', station: '', odometer: '' })
        showToast('Fill-up logged')
      }
    } catch {}
  }

  const deleteEntry = async (id: string) => {
    if (!confirm('Delete this entry?')) return
    await fetch(`/api/fuel/${id}`, { method: 'DELETE' })
    setEntries(prev => prev.filter(e => e.id !== id))
    showToast('Deleted')
  }

  const deviceNames = new Map(devices.map((d: any) => [d.id, d.name]))

  return (
    <div id="panel-fuel" className="flex flex-col w-full h-full overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">Fuel Log</h2>
        <button className="px-3 py-1.5 rounded-lg bg-cyan text-bg text-xs font-semibold cursor-pointer hover:opacity-85 border-none" onClick={() => setShowForm(!showForm)}>+ Log Fill-Up</button>
      </div>

      {showForm && (
        <div className="p-4 bg-surface border-b border-border flex flex-wrap gap-2 items-end">
          <select className="bg-surface-2 border border-border rounded px-2.5 py-1.5 text-xs text-text outline-none focus:border-cyan w-36" value={form.deviceId} onChange={e => setForm(f => ({ ...f, deviceId: e.target.value }))}>
            <option value="">Select device</option>
            {devices.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input className="bg-surface-2 border border-border rounded px-2.5 py-1.5 text-xs text-text outline-none focus:border-cyan w-28" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          <input className="bg-surface-2 border border-border rounded px-2.5 py-1.5 text-xs text-text outline-none focus:border-cyan w-20" placeholder="Gallons" type="number" step="0.001" value={form.gallons} onChange={e => setForm(f => ({ ...f, gallons: e.target.value }))} />
          <input className="bg-surface-2 border border-border rounded px-2.5 py-1.5 text-xs text-text outline-none focus:border-cyan w-20" placeholder="$/gal" type="number" step="0.01" value={form.pricePerGallon} onChange={e => setForm(f => ({ ...f, pricePerGallon: e.target.value }))} />
          <input className="bg-surface-2 border border-border rounded px-2.5 py-1.5 text-xs text-text outline-none focus:border-cyan w-28" placeholder="Odometer" type="number" value={form.odometer} onChange={e => setForm(f => ({ ...f, odometer: e.target.value }))} />
          <input className="bg-surface-2 border border-border rounded px-2.5 py-1.5 text-xs text-text outline-none focus:border-cyan w-28" placeholder="Station" value={form.station} onChange={e => setForm(f => ({ ...f, station: e.target.value }))} />
          <button className="px-3 py-1.5 rounded-lg bg-cyan text-bg text-xs font-semibold cursor-pointer hover:opacity-85 border-none" onClick={addEntry}>Save</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2">
        {entries.length === 0 && (
          <div className="text-center py-12 text-text-muted text-sm">No fuel entries yet. Tap "+ Log Fill-Up" to add one.</div>
        )}
        {entries.map(e => (
          <div key={e.id} className="bg-surface border border-border rounded-lg p-3 mb-2 flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <div className="text-xs font-semibold">{deviceNames.get(e.deviceId) || 'Unknown'}</div>
              <div className="text-[10px] text-text-muted font-mono">{new Date(e.date).toLocaleDateString()}</div>
              <div className="text-[11px] font-mono mt-0.5">
                <span className="text-cyan">{e.gallons} gal</span>
                {e.pricePerGallon && <span className="text-text-muted ml-2">@ ${e.pricePerGallon.toFixed(3)}/gal</span>}
                {e.mpg && <span className="text-green ml-2">{e.mpg} mpg</span>}
              </div>
              {e.station && <div className="text-[10px] text-text-dim">{e.station}</div>}
            </div>
            <button className="text-red text-[10px] bg-transparent border-none cursor-pointer hover:underline shrink-0" onClick={() => deleteEntry(e.id)}>✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}
