import { MapIcon, TripsIcon, MaintIcon, FuelIcon, SettingsIcon, ShieldIcon } from '../ui/Icons';
import type { PanelId } from '../../types';

interface SidebarProps {
  activePanel: PanelId;
  onPanelChange: (panel: PanelId) => void;
}

const navItems: { id: PanelId; label: string; Icon: typeof MapIcon }[] = [
  { id: 'map', label: 'Live Map', Icon: MapIcon },
  { id: 'trips', label: 'Trips', Icon: TripsIcon },
  { id: 'maint', label: 'Maintenance', Icon: MaintIcon },
  { id: 'fuel', label: 'Fuel', Icon: FuelIcon },
];

export default function Sidebar({ activePanel, onPanelChange }: SidebarProps) {
  return (
    <nav className="w-14 bg-surface border-r border-border flex flex-col items-center py-3 gap-1 shrink-0 z-10">
      <div className="w-9 h-9 bg-cyan rounded-lg flex items-center justify-center mb-3 shrink-0">
        <ShieldIcon className="w-5 h-5 fill-bg" />
      </div>
      {navItems.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onPanelChange(id)}
          className={`w-10 h-10 rounded-lg border-none flex items-center justify-center cursor-pointer transition-colors relative group ${
            activePanel === id
              ? 'bg-[var(--color-cyan-dim)] text-cyan'
              : 'bg-transparent text-text-muted hover:bg-surface-2 hover:text-text-dim'
          }`}
        >
          <Icon className="w-[18px] h-[18px]" />
          <span className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 bg-surface-2 border border-border rounded px-2 py-[3px] text-xs whitespace-nowrap text-text pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
            {label}
          </span>
        </button>
      ))}
      <div className="mt-auto">
        <button
          onClick={() => onPanelChange('settings')}
          className={`w-10 h-10 rounded-lg border-none flex items-center justify-center cursor-pointer transition-colors relative group ${
            activePanel === 'settings'
              ? 'bg-[var(--color-cyan-dim)] text-cyan'
              : 'bg-transparent text-text-muted hover:bg-surface-2 hover:text-text-dim'
          }`}
        >
          <SettingsIcon className="w-[18px] h-[18px]" />
          <span className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 bg-surface-2 border border-border rounded px-2 py-[3px] text-xs whitespace-nowrap text-text pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
            Settings
          </span>
        </button>
      </div>
    </nav>
  );
}
