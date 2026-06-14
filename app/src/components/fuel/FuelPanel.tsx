import { fuelData } from '../../data/mockData';

interface FuelPanelProps {
  showToast: (msg: string) => void;
}

export default function FuelPanel({ showToast }: FuelPanelProps) {
  const mpgs = fuelData.map(f => f.mpg);
  const maxMpg = Math.max(...mpgs);
  const avgMpg = (mpgs.reduce((s, v) => s + v, 0) / mpgs.length).toFixed(1);
  const totalGal = fuelData.reduce((s, f) => s + f.gal, 0).toFixed(2);
  const totalCost = fuelData.reduce((s, f) => s + (f.gal * f.ppg), 0).toFixed(2);
  const avgPpg = (fuelData.reduce((s, f) => s + f.ppg, 0) / fuelData.length).toFixed(3);

  return (
    <div id="panel-fuel" className="flex flex-col w-full">
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex gap-px">
            {[
              { label: 'Avg MPG', val: avgMpg, color: 'text-cyan' },
              { label: 'Total Fuel', val: `${totalGal} gal`, color: '' },
              { label: 'Avg $/gal', val: `$${avgPpg}`, color: 'text-amber' },
              { label: 'Total Spend', val: `$${totalCost}`, color: 'text-red' },
            ].map((stat, i) => (
              <div key={i} className="flex-1 bg-surface px-4 py-3.5 flex flex-col gap-1">
                <span className="text-[10px] text-text-muted uppercase tracking-wider">{stat.label}</span>
                <span className={`font-mono text-sm font-bold ${stat.color || ''}`}>{stat.val}</span>
              </div>
            ))}
          </div>

          <div className="px-4 py-3 border-b border-border bg-surface">
            <div className="text-[11px] text-text-muted uppercase tracking-wider mb-2.5">MPG Trend — Last 10 Fill-Ups</div>
            <div className="flex items-end gap-1.5 h-[60px]">
              {mpgs.slice().reverse().map((m, i) => (
                <div
                  key={i}
                  className="flex-1 bg-cyan-dim border border-[rgba(0,212,255,0.2)] rounded-t-[3px] relative cursor-pointer hover:bg-[rgba(0,212,255,0.2)] transition-colors group"
                  style={{ height: `${(m / maxMpg * 100)}%` }}
                >
                  <span className="absolute -top-[18px] left-1/2 -translate-x-1/2 font-mono text-[9px] text-cyan whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">{m}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['Date', 'Vehicle', 'Odometer', 'Gallons', 'Price/gal', 'Total Cost', 'MPG', 'Station'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wider border-b border-border sticky top-0 bg-bg">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fuelData.map((f, i) => (
                  <tr key={i} className="border-b border-[rgba(46,54,80,0.5)]">
                    <td className="px-4 py-2.5 text-xs font-mono">{f.date}</td>
                    <td className="px-4 py-2.5 text-xs">{f.vehicle}</td>
                    <td className="px-4 py-2.5 text-xs font-mono">{f.odo.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-xs font-mono">{f.gal}</td>
                    <td className="px-4 py-2.5 text-xs font-mono">${f.ppg}</td>
                    <td className="px-4 py-2.5 text-xs font-mono">${(f.gal * f.ppg).toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-xs font-mono">
                      <span style={{ color: f.mpg >= 18.2 ? '#10B981' : f.mpg >= 17.8 ? '#F59E0B' : '#EF4444' }}>{f.mpg}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-text-muted">{f.station}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="w-[280px] border-l border-border bg-surface p-4 flex flex-col gap-3.5 overflow-y-auto shrink-0">
          <h3 className="text-sm font-semibold">Log Fill-Up</h3>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-text-muted font-medium">Vehicle</label>
            <select className="bg-surface-2 border border-border rounded-lg text-text font-mono text-xs px-2.5 py-1.5 outline-none focus:border-cyan w-full">
              <option>T1N Sprinter</option>
              <option>Backup Unit</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-text-muted font-medium">Date</label>
            <input type="date" className="bg-surface-2 border border-border rounded-lg text-text font-mono text-xs px-2.5 py-1.5 outline-none focus:border-cyan w-full" defaultValue="2026-06-12" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-text-muted font-medium">Odometer (mi)</label>
            <input type="number" className="bg-surface-2 border border-border rounded-lg text-text font-mono text-xs px-2.5 py-1.5 outline-none focus:border-cyan w-full" placeholder="187432" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-text-muted font-medium">Gallons</label>
            <input type="number" step="0.001" className="bg-surface-2 border border-border rounded-lg text-text font-mono text-xs px-2.5 py-1.5 outline-none focus:border-cyan w-full" placeholder="14.432" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-text-muted font-medium">Price per Gallon ($)</label>
            <input type="number" step="0.001" className="bg-surface-2 border border-border rounded-lg text-text font-mono text-xs px-2.5 py-1.5 outline-none focus:border-cyan w-full" placeholder="3.799" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-text-muted font-medium">Station</label>
            <input type="text" className="bg-surface-2 border border-border rounded-lg text-text font-mono text-xs px-2.5 py-1.5 outline-none focus:border-cyan w-full" placeholder="Shell — Division St" />
          </div>
          <div className="h-px bg-border" />
          <button className="w-full py-1.5 rounded-lg bg-cyan text-bg border-none text-xs font-semibold cursor-pointer hover:opacity-85 transition-opacity" onClick={() => showToast('Fill-up logged ✓')}>Save Fill-Up</button>
        </div>
      </div>
    </div>
  );
}
