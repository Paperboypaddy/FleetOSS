import { useState } from 'react';
import type { FrontendDevice } from '../../lib/api';
import { timeAgo } from '../../lib/api';

interface DeviceListProps {
  devices: FrontendDevice[];
  selected: number;
  onSelect: (i: number) => void;
  onRename?: (deviceId: string, newName: string) => void;
  onDelete?: (deviceId: string) => void;
}

function batteryColor(level: number | null): string {
  if (level === null) return '#64748B'
  if (level >= 70) return '#10B981'
  if (level >= 30) return '#F59E0B'
  return '#EF4444'
}

function batteryIcon(level: number | null): string {
  if (level === null) return '---'
  if (level >= 90) return '\u2588\u2588\u2588\u2588'
  if (level >= 60) return '\u2588\u2588\u2588\u2581'
  if (level >= 30) return '\u2588\u2588\u2581\u2581'
  return '\u2588\u2581\u2581\u2581'
}

export default function DeviceList({ devices, selected, onSelect, onRename, onDelete }: DeviceListProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const startRename = (d: FrontendDevice) => {
    setRenamingId(d.apiId)
    setRenameValue(d.name)
  }

  const submitRename = () => {
    if (renamingId && renameValue.trim() && onRename) {
      onRename(renamingId, renameValue.trim())
    }
    setRenamingId(null)
  }

  const handleDelete = (d: FrontendDevice) => {
    if (window.confirm(`Remove "${d.name}" from FleetOSS?`)) {
      onDelete?.(d.apiId)
    }
  }

  return (
    <div className="w-[260px] bg-surface border-l border-border flex flex-col overflow-hidden shrink-0">
      <div className="px-3.5 py-3 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold text-text-dim uppercase tracking-wider">Assets</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {devices.map((d, i) => (
          <div
            key={d.apiId}
            onClick={() => onSelect(i)}
            className={`p-2.5 rounded-lg border cursor-pointer transition-colors mb-1 ${
              i === selected
                ? 'bg-cyan-dim border-[rgba(0,212,255,0.2)]'
                : 'bg-transparent border-transparent hover:bg-surface-2'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              {renamingId === d.apiId ? (
                <input
                  className="text-sm font-semibold bg-surface-2 border border-cyan rounded px-1.5 py-0.5 text-text outline-none w-full mr-2"
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setRenamingId(null) }}
                  onBlur={submitRename}
                  autoFocus
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span className="text-sm font-semibold truncate flex-1">{d.name}</span>
              )}
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  className="w-5 h-5 rounded border-none bg-transparent text-text-muted hover:text-text cursor-pointer flex items-center justify-center text-[10px] transition-colors"
                  onClick={e => { e.stopPropagation(); startRename(d) }}
                  title="Rename"
                >{'✎'}</button>
                <button
                  className="w-5 h-5 rounded border-none bg-transparent text-text-muted hover:text-red cursor-pointer flex items-center justify-center text-[10px] transition-colors"
                  onClick={e => { e.stopPropagation(); handleDelete(d) }}
                  title="Remove"
                >{'✕'}</button>
                <div className={`w-[7px] h-[7px] rounded-full shrink-0 ml-0.5 ${
                  d.status === 'moving' ? 'bg-green shadow-[0_0_6px_rgba(16,185,129,0.5)]' :
                  d.status === 'stopped' ? 'bg-amber' : 'bg-text-muted'
                }`} />
              </div>
            </div>
            <div className="flex gap-2 font-mono text-[10px] text-text-muted">
              <span>{d.plate}</span>
              <span>{d.status === 'moving' ? `${Math.round(d.speed)} mph` : 'Stopped'}</span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px] text-text-muted mt-1">
              <span style={{ color: batteryColor(d.battery) }}>
                {batteryIcon(d.battery)}
              </span>
              <span style={{ color: batteryColor(d.battery) }}>
                {d.battery !== null ? `${Math.round(d.battery)}%` : 'N/A'}
              </span>
            </div>
            <div className="font-mono text-[10px] text-text-muted mt-1">
              Last seen: {timeAgo(d.lastUpdate)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
