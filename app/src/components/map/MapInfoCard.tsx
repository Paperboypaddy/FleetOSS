interface MapInfoCardProps {
  speed: string;
  battery: string;
  batteryColor: string;
}

export default function MapInfoCard({ speed, battery, batteryColor }: MapInfoCardProps) {
  return (
    <div className="absolute bottom-7 left-4 bg-surface border border-border rounded-lg p-3 min-w-[180px] z-[1000] pointer-events-none">
      <div className="flex justify-between items-center gap-4 mb-1.5">
        <span className="text-xs text-text-muted">Speed</span>
        <span className="font-mono text-xs font-medium" style={{ color: '#00D4FF' }}>{speed}</span>
      </div>
      <div className="flex justify-between items-center gap-4">
        <span className="text-xs text-text-muted">Battery</span>
        <span className="font-mono text-xs font-medium" style={{ color: batteryColor }}>{battery}</span>
      </div>
    </div>
  );
}
