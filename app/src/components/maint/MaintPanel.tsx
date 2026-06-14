import { useState } from 'react';
import { maintData } from '../../data/mockData';

interface MaintPanelProps {
  showToast: (msg: string) => void;
}

export default function MaintPanel({ showToast }: MaintPanelProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const m = maintData[activeIdx];

  const fillColor = (fill: string) => {
    switch (fill) {
      case 'fill-green': return 'bg-green';
      case 'fill-amber': return 'bg-amber';
      case 'fill-red': return 'bg-red';
      default: return 'bg-green';
    }
  };

  const statusColor = (pct: number) => {
    if (pct >= 70) return '#10B981';
    if (pct >= 40) return '#F59E0B';
    return '#EF4444';
  };

  const statusBadge = (pct: number) => {
    if (pct >= 70) return { label: 'OK', cls: 'bg-green-dim text-green' };
    if (pct >= 40) return { label: 'Soon', cls: 'bg-amber-dim text-amber' };
    return { label: 'Urgent', cls: 'bg-[rgba(239,68,68,0.12)] text-red' };
  };

  return (
    <div id="panel-maint" className="flex flex-col w-full">
      <div className="flex flex-1 overflow-hidden">
        <div className="w-[320px] border-r border-border flex flex-col overflow-hidden shrink-0">
          <div className="px-3.5 py-3 border-b border-border flex items-center gap-2">
            <h3 className="text-sm font-semibold flex-1">Service Items</h3>
            <button className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-cyan text-bg border-none cursor-pointer hover:opacity-85 transition-opacity" onClick={() => showToast('New service item added')}>+ New</button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {maintData.map((item, i) => (
              <div
                key={i}
                onClick={() => setActiveIdx(i)}
                className={`p-2.5 rounded-lg border cursor-pointer mb-1.5 transition-colors ${
                  i === activeIdx
                    ? 'border-cyan bg-cyan-dim'
                    : 'border-border bg-surface hover:border-cyan hover:bg-surface-2'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="text-xs font-semibold">{item.name}</span>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[9px] font-semibold ${statusBadge(item.pct).cls}`}>{statusBadge(item.pct).label}</span>
                </div>
                <div className="text-[11px] text-text-muted mb-1.5">{item.vehicle}</div>
                <div className="h-[3px] bg-border rounded overflow-hidden">
                  <div className={`h-full rounded ${fillColor(item.fill)}`} style={{ width: `${item.pct}%` }} />
                </div>
                <div className="font-mono text-[10px] text-text-muted mt-1.5">{item.due}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          <h2 className="text-lg font-semibold mb-1">{m.name}</h2>
          <div className="text-xs text-text-muted mb-5">{m.vehicle} · {m.due}</div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-surface border border-border rounded-lg p-3.5">
              <div className="text-[11px] text-text-muted mb-1">Health</div>
              <div className="font-mono text-lg font-bold" style={{ color: statusColor(m.pct) }}>{m.pct}%</div>
            </div>
            <div className="bg-surface border border-border rounded-lg p-3.5">
              <div className="text-[11px] text-text-muted mb-1">Status</div>
              <div className="font-mono text-sm font-bold">{m.due}</div>
            </div>
          </div>

          <div className="text-xs font-semibold text-text-dim uppercase tracking-wider mb-2.5">Service History</div>
          {m.history.map((h, i, arr) => (
            <div key={i} className="flex items-start gap-3 py-2.5 border-b border-[rgba(46,54,80,0.5)]">
              <div className="flex flex-col items-center pt-0.5">
                <div className="w-2 h-2 rounded-full bg-cyan shrink-0" />
                {i < arr.length - 1 && <div className="w-px flex-1 bg-border mt-1 min-h-[20px]" />}
              </div>
              <div className="flex-1">
                <div className="text-xs font-medium">{h.action}</div>
                <div className="text-[11px] text-text-muted mt-0.5">{h.meta}</div>
              </div>
            </div>
          ))}

          <div className="flex gap-2 mt-4">
            <button className="px-3.5 py-1.5 rounded-lg bg-cyan text-bg border-none text-xs font-semibold cursor-pointer hover:opacity-85 transition-opacity" onClick={() => showToast('Service logged ✓')}>Log Service</button>
            <button className="px-3 py-1.5 rounded-lg bg-transparent text-text-dim border border-border text-xs cursor-pointer hover:bg-surface-2 transition-colors" onClick={() => showToast('Reminder set')}>Set Reminder</button>
          </div>
        </div>
      </div>
    </div>
  );
}
