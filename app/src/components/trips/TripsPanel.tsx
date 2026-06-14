import { useState } from 'react';
import type { FrontendTrip } from '../../lib/api';
import { updateTrip } from '../../lib/api';

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

  const changeType = async (trip: FrontendTrip, newType: string) => {
    if (!trip.apiId) return;
    const val = newType === 'None' ? null : newType as 'Work' | 'Personal';
    try {
      await updateTrip(trip.apiId, { type: val || undefined })
      trip.type = val
      setSelectedIdx(selectedIdx !== null ? selectedIdx + 0 : null)
      showToast(val ? `Marked as ${val}` : 'Type cleared')
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
              {['Date', 'Vehicle', 'Route', 'Start', 'End', 'Distance', 'Duration', 'Avg Speed', 'Max Speed', 'Type', 'Purpose'].map(h => (
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
                  <div className="flex flex-col gap-0.5 max-w-[240px]">
                    <span className="text-text truncate" title={t.from}>← {t.from}</span>
                    <span className="text-[9px] text-text-dim font-mono truncate">{t.waypoints[0]?.[0]?.toFixed(4)},{t.waypoints[0]?.[1]?.toFixed(4)}</span>
                    <span className="text-text truncate mt-0.5" title={t.to}>→ {t.to}</span>
                    <span className="text-[9px] text-text-dim font-mono truncate">{t.waypoints[1]?.[0]?.toFixed(4)},{t.waypoints[1]?.[1]?.toFixed(4)}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap">{t.startTime}</td>
                <td className="px-4 py-2.5 text-xs font-mono whitespace-nowrap">{t.endTime}</td>
                <td className="px-4 py-2.5 text-xs font-mono">{t.dist} mi</td>
                <td className="px-4 py-2.5 text-xs font-mono">{t.dur}</td>
                <td className="px-4 py-2.5 text-xs font-mono">{t.avg} mph</td>
                <td className="px-4 py-2.5 text-xs font-mono">{t.max} mph</td>
                <td className="px-4 py-2.5 text-xs" onClick={e => e.stopPropagation()}>
                  <select
                    value={t.type || 'None'}
                    onChange={e => changeType(t, e.target.value)}
                    className={`px-2 py-0.5 rounded font-mono text-[10px] font-semibold border-none outline-none cursor-pointer ${
                      t.type === 'Work' ? 'bg-cyan-dim text-cyan' :
                      t.type === 'Personal' ? 'bg-amber-dim text-amber' :
                      'bg-surface-2 text-text-muted'
                    }`}
                  >
                    <option value="None" className="bg-bg text-text-muted">None</option>
                    <option value="Work" className="bg-bg text-cyan">Work</option>
                    <option value="Personal" className="bg-bg text-amber">Personal</option>
                  </select>
                </td>
                <td className="px-4 py-2.5 text-xs max-w-[140px]" onClick={e => e.stopPropagation()}>
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
                      className="cursor-pointer hover:text-cyan transition-colors truncate block"
                      title={t.purpose || 'Add note...'}
                    >
                      {t.purpose || <span className="text-text-dim italic">Add note...</span>}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={11} className="px-4 py-12 text-center text-text-muted text-sm">No trips found. Connect a device and start driving!</td></tr>
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
          <span className="text-xs text-text-muted">Click row to view route</span>
        </div>
      </div>
    </div>
  );
}
