import { useState } from 'react';
import { tripsData } from '../../data/mockData';

interface TripsPanelProps {
  showToast: (msg: string) => void;
  onShowTrip?: (tripIdx: number) => void;
}

export default function TripsPanel({ showToast, onShowTrip }: TripsPanelProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [vehicleFilter, setVehicleFilter] = useState('All Vehicles');

  const filtered = vehicleFilter === 'All Vehicles'
    ? tripsData
    : tripsData.filter(t => t.vehicle === vehicleFilter);

  const vehicles = [...new Set(tripsData.map(t => t.vehicle))];
  const totalMi = filtered.reduce((s, t) => s + t.dist, 0);
  const workMi = filtered.filter(t => t.type === 'Work').reduce((s, t) => s + t.dist, 0);
  const tripCount = filtered.length;
  const avgMi = tripCount > 0 ? totalMi / tripCount : 0;

  const clickTrip = (trip: typeof tripsData[0]) => {
    const realIdx = tripsData.indexOf(trip);
    setSelectedIdx(realIdx);
    onShowTrip?.(realIdx);
  };

  return (
    <div id="panel-trips" className="flex flex-col w-full">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
        <select className="bg-surface border border-border rounded-lg text-text text-xs px-2.5 py-1.5 outline-none focus:border-cyan" value={vehicleFilter} onChange={e => setVehicleFilter(e.target.value)}>
          <option>All Vehicles</option>
          {vehicles.map(v => <option key={v}>{v}</option>)}
        </select>
        <input type="date" className="bg-surface border border-border rounded-lg text-text text-xs px-2.5 py-1.5 outline-none focus:border-cyan" defaultValue="2026-06-01" />
        <span className="text-xs text-text-muted">→</span>
        <input type="date" className="bg-surface border border-border rounded-lg text-text text-xs px-2.5 py-1.5 outline-none focus:border-cyan" defaultValue="2026-06-12" />
        <select className="bg-surface border border-border rounded-lg text-text text-xs px-2.5 py-1.5 outline-none focus:border-cyan">
          <option>All Types</option>
          <option>Work</option>
          <option>Personal</option>
        </select>
        <div className="ml-auto flex gap-2">
          <button className="px-3 py-1.5 rounded-lg bg-transparent text-text-dim border border-border text-xs cursor-pointer hover:bg-surface-2 transition-colors" onClick={() => showToast('Exported CSV')}>Export CSV</button>
          <button className="px-3.5 py-1.5 rounded-lg bg-cyan text-bg border-none text-xs font-semibold cursor-pointer hover:opacity-85 transition-opacity" onClick={() => showToast('Trip logger coming soon')}>+ Log Trip</button>
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
              <tr key={i} onClick={() => clickTrip(t)} className={`border-b border-[rgba(46,54,80,0.5)] cursor-pointer transition-colors hover:bg-surface ${tripsData.indexOf(t) === selectedIdx ? 'bg-[rgba(0,212,255,0.07)] outline outline-1 outline-offset-[-1px] outline-[rgba(0,212,255,0.2)]' : ''}`}>
                <td className="px-4 py-2.5 text-xs font-mono">{t.date}</td>
                <td className="px-4 py-2.5 text-xs">{t.vehicle}</td>
                <td className="px-4 py-2.5 text-xs">{t.from} <span className="text-text-muted">→</span> {t.to}</td>
                <td className="px-4 py-2.5 text-xs font-mono">{t.dist} mi</td>
                <td className="px-4 py-2.5 text-xs font-mono">{t.dur}</td>
                <td className="px-4 py-2.5 text-xs font-mono">{t.avg} mph</td>
                <td className="px-4 py-2.5 text-xs font-mono">{t.max} mph</td>
                <td className="px-4 py-2.5 text-xs"><span className={`inline-flex items-center px-2 py-0.5 rounded font-mono text-[10px] font-semibold ${t.type === 'Work' ? 'bg-cyan-dim text-cyan' : 'bg-amber-dim text-amber'}`}>{t.type}</span></td>
                <td className="px-4 py-2.5 text-xs text-text-muted">{t.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2.5 border-t border-border bg-surface flex gap-6">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-text-muted uppercase tracking-wider">Total Miles</span>
          <span className="font-mono text-sm font-bold text-cyan">{totalMi.toFixed(1)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-text-muted uppercase tracking-wider">Work Miles</span>
          <span className="font-mono text-sm font-bold text-green">{workMi.toFixed(1)}</span>
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
          <span className="text-xs text-text-muted">Click any row to view route</span>
        </div>
      </div>
    </div>
  );
}
