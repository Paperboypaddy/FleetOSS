interface MaintPanelProps {
  showToast: (msg: string) => void;
}

export default function MaintPanel({ showToast }: MaintPanelProps) {
  return (
    <div id="panel-maint" className="flex flex-col w-full h-full items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl bg-surface mx-auto mb-3 flex items-center justify-center">
          <svg className="w-6 h-6 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>
        <p className="text-sm text-text-muted">Maintenance tracking coming soon</p>
        <button
          className="mt-3 px-3.5 py-1.5 rounded-lg bg-cyan text-bg border-none text-xs font-semibold cursor-pointer hover:opacity-85 transition-opacity"
          onClick={() => showToast('Maintenance API not yet available')}
        >Notify me</button>
      </div>
    </div>
  );
}
