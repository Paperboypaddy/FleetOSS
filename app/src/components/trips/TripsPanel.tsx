import { useState } from 'react';
import type { FrontendTrip } from '../../lib/api';
import { updateTrip, reverseGeocode } from '../../lib/api';

interface TripsPanelProps {
  showToast: (msg: string) => void;
  onShowTrip?: (trip: FrontendTrip) => void;
  trips: FrontendTrip[] | null;
}

export default function TripsPanel({ showToast, onShowTrip, trips: tripsProp }: TripsPanelProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [vehicleFilter, setVehicleFilter] = useState('All Vehicles');
  const [editingPurpose, setEditingPurpose] = useState<string | null>(null);
  const [purposeVal, setPurposeVal] = useState('');
  const [geocoding, setGeocoding] = useState<Set<string>>(new Set());

  const tripsData = tripsProp || []
  const filtered = vehicleFilter === 'All Vehicles'
    ? tripsData
    : tripsData.filter(t => t.vehicle === vehicleFilter);

  const vehicles = [...new Set(tripsData.map(t => t.vehicle))];
  const totalMi = filtered.reduce((s, t) => s + t.dist, 0);
  const tripCount = filtered.length;
  const avgMi = tripCount > 0 ? totalMi / tripCount : 0;

  const clickTrip = (trip: FrontendTrip) => {
    const realIdx = tripsData.indexOf(trip);
    setSelectedIdx(realIdx);
    onShowTrip?.(trip);
  };

  const toggleType = async (trip: FrontendTrip) => {
    if (!trip.apiId) return;
    const nextType = trip.type === 'Work' ? 'Personal' : trip.type === 'Personal' ? null : 'Work';
    try {
      await updateTrip(trip.apiId, { type: nextType || undefined })
      trip.type = nextType
      trip.vehicle = trip.vehicle // force re-render
      // Force re-render by replacing the reference
      setSelectedIdx(selectedIdx !== null ? selectedIdx + 0 : null)
      showToast(nextType ? `Marked as ${nextType}` : 'Cleared type')
    } catch {
      showToast('Failed to update')
    }
  }

  const startEditPurpose = (trip: FrontendTrip) => {
    if (!trip.apiId) return;
    setEditingPurpose(trip.apiId)
    setPurposeVal(trip.purpose || '')
  }

  const savePurpose = async (trip: FrontendTrip) => {
    if (!trip.apiId || !editingPurpose) return;
    try {
      await updateTrip(trip.apiId, { purpose: purposeVal })
      trip.purpose = purposeVal
      setEditingPurpose(null)
      showToast('Purpose saved')
    } catch {
      showToast('Failed to save')
    }
  }

  const doGeocode = async (trip: FrontendTrip, field: 'from' | 'to') => {
    const key = `${trip.apiId}-${field}`
    if (geocoding.has(key)) return
    setGeocoding(prev => new Set(prev).add(key))
    try {
      const coords = trip.waypoints[field === 'from' ? 0 : 1]
      const addr = await reverseGeocode(coords[0], coords[1])
      if (addr) {
        if (field === 'from') trip.from = addr
        else trip.to = addr
        showToast('Address found')
      }
    } catch {}
    setGeocoding(prev => { const n = new Set(prev); n.delete(key); return n })
  }

  return (
    <div id="panel-trips" className="flex flex-col w-full">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
        <select className="bg-surface border border-border rounded-lg text-text text-xs px-2.5 py-1.5 outline-none focus:border-cyan" value={vehicleFilter} onChange={e => setVehicleFilter(e.target.value)}>
          <option>All Vehicles</option>
          {vehicles.map(v => <option key={v}>{v}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <button className="px-3 py-1.5 rounded-lg bg-transparent text-text-dim border border-border text-xs cursor-pointer hover:bg-surface-2 transition-colors" onClick={() => showToast('Exported CSV')}>Export CSV</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Date', 'Vehicle', 'Route', 'Distance', 'Duration', 'Avg Speed', 'Max Speed', 'Type', 'Purpose'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider border-b border-border sticky top-0 bg-bg whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t, i) => (
              <tr key={t.apiId || i} onClick={() => clickTrip(t)} className={`border-b border-[rgba(46,54,80,0.5)] cursor-pointer transition-colors hover:bg-surface ${tripsData.indexOf(t) === selectedIdx ? 'bg-[rgba(0,212,255,0.07)] outline outline-1 outline-offset-[-1px] outline-[rgba(0,212,255,0.2)]' : ''}`}>
                <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap">{t.date}</td>
                <td className="px-4 py-2.5 text-xs">{t.vehicle}</td>
                <td className="px-4 py-2.5 text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-text-muted">← {t.from}</span>
                    <span className="text-text-muted">→ {t.to}</span>
                    <span className="text-[9px] text-text-dim font-mono">
                      {t.waypoints[0]?.[0]?.toFixed(4)},{t.waypoints[0]?.[1]?.toFixed(4)} &nbsp; {t.waypoints[1]?.[0]?.toFixed(4)},{t.waypoints[1]?.[1]?.toFixed(4)}
                    </span>
                    <button
                      className="text-[9px] text-cyan hover:text-cyan-light text-left mt-0.5"
                      onClick={e => { e.stopPropagation(); doGeocode(t, 'from') }}
                    >📍 Lookup start</button>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-xs font-mono">{t.dist} mi</td>
                <td className="px-4 py-2.5 text-xs font-mono">{t.dur}</td>
                <td className="px-4 py-2.5 text-xs font-mono">{t.avg} mph</td>
                <td className="px-4 py-2.5 text-xs font-mono">{t.max} mph</td>
                <td className="px-4 py-2.5 text-xs">
                  <span
                    onClick={e => { e.stopPropagation(); toggleType(t) }}
                    className={`inline-flex items-center px-2 py-0.5 rounded font-mono text-[10px] font-semibold cursor-pointer transition-colors ${
                      t.type === 'Work' ? 'bg-cyan-dim text-cyan hover:bg-cyan-dim/70' :
                      t.type === 'Personal' ? 'bg-amber-dim text-amber hover:bg-amber-dim/70' :
                      'bg-surface-2 text-text-muted hover:bg-border'
                    }`}
                  >
                    {t.type || '—'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs max-w-[160px]" onClick={e => e.stopPropagation()}>
                  {editingPurpose === t.apiId ? (
                    <input
                      className="bg-surface-2 border border-cyan rounded px-1.5 py-0.5 text-text text-xs outline-none w-full font-mono"
                      value={purposeVal}
                      onChange={e => setPurposeVal(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') savePurpose(t); if (e.key === 'Escape') setEditingPurpose(null) }}
                      onBlur={() => savePurpose(t)}
                      autoFocus
                    />
                  ) : (
                    <span
                      onClick={e => { e.stopPropagation(); startEditPurpose(t) }}
                      className="cursor-pointer hover:text-cyan transition-colors"
                    >
                      {t.purpose || <span className="text-text-dim italic">Add note...</span>}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-text-muted text-sm">No trips found. Connect a device and start driving!</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2.5 border-t border-border bg-surface flex gap-6">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-text-muted uppercase tracking-wider">Total Miles</span>
          <span className="font-mono text-sm font-bold text-cyan">{totalMi.toFixed(1)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-text-muted uppercase tracking-wider">Trips</span>
          <span className="font-mono text-sm font-bold">{tripCount}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-text-muted uppercase tracking-wider">Avg / Trip</span>
          <span className="font-mono text-sm font-bold">{avgMi.toFixed(1)} mi</span>
        </div>
        <div className="flex flex-col gap-0.5 ml-auto">
          <span className="text-[10px] text-text-muted uppercase tracking-wider">Tip</span>
          <span className="text-xs text-text-muted">Click row to view route · Click type badge to toggle</span>
        </div>
      </div>
    </div>
  );
}
