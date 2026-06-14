interface MapInfoCardProps {
  speed: string;
  odo: string;
  today: string;
  engine: string;
  engineColor: string;
}

export default function MapInfoCard({ speed, odo, today, engine, engineColor }: MapInfoCardProps) {
  return (
    <div className="absolute bottom-7 left-4 bg-surface border border-border rounded-lg p-3 min-w-[200px] z-[1000] pointer-events-none">
      <div className="flex justify-between items-center gap-4 mb-1.5">
        <span className="text-xs text-text-muted">Speed</span>
        <span className="font-mono text-xs font-medium" style={{ color: '#00D4FF' }}>{speed}</span>
      </div>
      <div className="flex justify-between items-center gap-4 mb-1.5">
        <span className="text-xs text-text-muted">Odometer</span>
        <span className="font-mono text-xs font-medium">{odo}</span>
      </div>
      <div className="flex justify-between items-center gap-4 mb-1.5">
        <span className="text-xs text-text-muted">Today</span>
        <span className="font-mono text-xs font-medium">{today}</span>
      </div>
      <div className="flex justify-between items-center gap-4">
        <span className="text-xs text-text-muted">Engine</span>
        <span className="font-mono text-xs font-medium" style={{ color: engineColor }}>{engine}</span>
      </div>
    </div>
  );
}
