import type { PanelId } from '../../types';

const labels: Record<PanelId, string> = {
  map: 'Live View',
  trips: 'Trip Log',
  maint: 'Maintenance',
  fuel: 'Fuel Log',
  settings: 'Settings',
};

interface TopbarProps {
  activePanel: PanelId;
  deviceCount: number;
}

export default function Topbar({ activePanel, deviceCount }: TopbarProps) {
  return (
    <div className="h-13 bg-surface border-b border-border flex items-center px-4 gap-3 shrink-0">
      <span className="font-mono text-xs font-bold text-cyan tracking-wider">FleetOSS</span>
      <div className="w-px h-5 bg-border" />
      <div className="flex gap-0.5">
        <button className="px-3 py-[5px] rounded-md border-none bg-cyan-dim text-cyan text-xs font-medium cursor-pointer">
          {labels[activePanel]}
        </button>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-dim border border-[rgba(16,185,129,0.25)] font-mono text-xs text-green">
          <div className="w-[7px] h-[7px] rounded-full bg-green animate-[pulse-glow_2s_ease-in-out_infinite]" />
          {deviceCount} Active
        </div>
      </div>
    </div>
  );
}
