import type { Device } from '../../types';

interface DeviceListProps {
  devices: Device[];
  selected: number;
  onSelect: (i: number) => void;
}

export default function DeviceList({ devices, selected, onSelect }: DeviceListProps) {
  return (
    <div className="w-[260px] bg-surface border-l border-border flex flex-col overflow-hidden shrink-0">
      <div className="px-3.5 py-3 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold text-text-dim uppercase tracking-wider">Vehicles</span>
        <button className="px-2 py-[3px] rounded-md bg-transparent text-text-dim border border-border text-xs cursor-pointer hover:bg-surface-2 transition-colors">+ Add</button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {devices.map((d, i) => (
          <div
            key={i}
            onClick={() => onSelect(i)}
            className={`p-2.5 rounded-lg border cursor-pointer transition-colors mb-1 ${
              i === selected
                ? 'bg-cyan-dim border-[rgba(0,212,255,0.2)]'
                : 'bg-transparent border-transparent hover:bg-surface-2'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-semibold">{d.name}</span>
              <div className={`w-[7px] h-[7px] rounded-full shrink-0 ${
                d.status === 'moving' ? 'bg-green shadow-[0_0_6px_rgba(16,185,129,0.5)]' :
                d.status === 'stopped' ? 'bg-amber' : 'bg-text-muted'
              }`} />
            </div>
            <div className="flex gap-2 font-mono text-[10px] text-text-muted">
              <span>{d.plate}</span>
              <span>{d.status === 'moving' ? `${d.speed} mph` : 'Stopped'}</span>
            </div>
            <div className="flex gap-2 font-mono text-[10px] text-text-muted mt-1">
              <span>{d.odo.toLocaleString()} mi ODO</span>
              <span>{d.today} mi today</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
