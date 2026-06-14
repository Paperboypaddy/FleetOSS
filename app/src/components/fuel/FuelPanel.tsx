interface FuelPanelProps {
  showToast: (msg: string) => void;
}

export default function FuelPanel({ showToast }: FuelPanelProps) {
  return (
    <div id="panel-fuel" className="flex flex-col w-full h-full items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl bg-surface mx-auto mb-3 flex items-center justify-center">
          <svg className="w-6 h-6 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 22V8l6-6 6 6v14M3 22h12m3-10v10m0 0h3M6 14h6M6 10h6" />
          </svg>
        </div>
        <p className="text-sm text-text-muted">Fuel tracking coming soon</p>
        <button
          className="mt-3 px-3.5 py-1.5 rounded-lg bg-cyan text-bg border-none text-xs font-semibold cursor-pointer hover:opacity-85 transition-opacity"
          onClick={() => showToast('Fuel API not yet available')}
        >Notify me</button>
      </div>
    </div>
  );
}
