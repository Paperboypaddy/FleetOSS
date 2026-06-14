import { useEffect, useRef, useCallback, useState } from 'react';
import type { PlaybackState } from '../../types';
import { speedColor, addMins, secToMMSS, bearing, interpAtSec } from '../../lib/math';

interface PlaybackBarProps {
  pb: PlaybackState | null;
  onSeek: (sec: number) => void;
}

export default function PlaybackBar({ pb, onSeek }: PlaybackBarProps) {
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const pbRef = useRef(pb);
  const onSeekRef = useRef(onSeek);
  pbRef.current = pb;
  onSeekRef.current = onSeek;

  const drawSpeedGraph = useCallback(() => {
    const canvas = document.getElementById('pb-speed-canvas') as HTMLCanvasElement;
    const wrap = document.getElementById('pb-graph-wrap');
    if (!canvas || !wrap || !pbRef.current?.speeds) return;
    const speeds = pbRef.current.speeds;
    canvas.width = wrap.offsetWidth * window.devicePixelRatio;
    canvas.height = wrap.offsetHeight * window.devicePixelRatio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    const W = wrap.offsetWidth, H = wrap.offsetHeight;
    const maxSpd = Math.max(...speeds) + 5;
    ctx.clearRect(0, 0, W, H);

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(0,212,255,0.3)');
    grad.addColorStop(1, 'rgba(0,212,255,0.02)');
    ctx.beginPath();
    speeds.forEach((s, i) => {
      const x = (i / (speeds.length - 1)) * W;
      const y = H - (s / maxSpd) * H;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    for (let i = 1; i < speeds.length; i++) {
      const x0 = ((i - 1) / (speeds.length - 1)) * W, y0 = H - (speeds[i - 1] / maxSpd) * H;
      const x1 = (i / (speeds.length - 1)) * W, y1 = H - (speeds[i] / maxSpd) * H;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      ctx.strokeStyle = speedColor(speeds[i]); ctx.lineWidth = 1.5; ctx.stroke();
    }
  }, []);

  useEffect(() => {
    if (!pb?.active) return;
    drawSpeedGraph();
    const handleResize = () => drawSpeedGraph();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pb?.active, drawSpeedGraph]);

  useEffect(() => {
    if (!pb?.active) return;
    const hm = document.getElementById('pb-heatmap');
    if (hm && pb.speeds) {
      const n = Math.min(pb.speeds.length, 200);
      hm.innerHTML = '';
      for (let i = 0; i < n; i++) {
        const s = pb.speeds[Math.floor(i / n * pb.speeds.length)];
        const div = document.createElement('div');
        div.className = 'pb-hm-seg';
        div.style.cssText = 'flex:1;height:100%;opacity:0.35';
        div.style.background = speedColor(s);
        hm.appendChild(div);
      }
    }
  }, [pb?.active, pb?.speeds]);

  const frame = useCallback((ts: number) => {
    const cur = pbRef.current;
    if (!cur?.playing) return;
    if (lastTsRef.current !== null) {
      const delta = (ts - lastTsRef.current) / 1000;
      const newSec = Math.min(cur.totalDur, cur.currentSec + delta * cur.speed);
      onSeekRef.current(newSec);
    }
    lastTsRef.current = ts;
    if (pbRef.current && pbRef.current.currentSec >= (pbRef.current.totalDur || 0)) {
      pbRef.current.playing = false;
      setPlaying(false);
      return;
    }
    rafRef.current = requestAnimationFrame(frame);
  }, []);

  const pbPlay = useCallback(() => {
    const cur = pbRef.current;
    if (!cur) return;
    if (cur.currentSec >= cur.totalDur) onSeekRef.current(0);
    lastTsRef.current = null;
    cur.playing = true;
    setPlaying(true);
    rafRef.current = requestAnimationFrame(frame);
  }, [frame]);

  const pbPause = useCallback(() => {
    if (pbRef.current) pbRef.current.playing = false;
    setPlaying(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const pbTogglePlay = useCallback(() => {
    if (!pb?.active) return;
    if (playing) pbPause(); else pbPlay();
  }, [pb, playing, pbPlay, pbPause]);

  const pbStop = useCallback(() => {
    pbPause();
    if (pb?.active) onSeek(0);
  }, [pb, pbPause, onSeek]);

  const pbSkip = useCallback((delta: number) => {
    if (!pb?.active) return;
    const newSec = Math.min(pb.totalDur, Math.max(0, (pb.currentSec || 0) + delta));
    onSeek(newSec);
  }, [pb, onSeek]);

  const pbSetSpeed = useCallback((v: string) => {
    if (pbRef.current) pbRef.current.speed = parseFloat(v);
  }, []);

  const closePlayback = useCallback(() => {
    pbPause();
    if (pbRef.current) pbRef.current.active = false;
  }, [pbPause]);

  const scrubStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!pb?.active) return;
    const track = document.getElementById('pb-track');
    if (!track) return;
    const move = (ev: MouseEvent | TouchEvent) => {
      const rect = track.getBoundingClientRect();
      const clientX = 'touches' in ev ? ev.touches[0].clientX : ev.clientX;
      const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      onSeek(pct * (pbRef.current?.totalDur || 0));
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    document.addEventListener('touchmove', move, { passive: true });
    document.addEventListener('touchend', up);
    move(e as any);
  }, [pb, onSeek]);

  if (!pb?.active) return null;

  const pct = pb.totalDur > 0 ? Math.min(1, (pb.currentSec || 0) / pb.totalDur) : 0;
  const { spd, idx } = interpAtSec(pb.currentSec || 0, pb.coords, pb.speeds, pb.totalDur);
  const remain = (pb.totalDur || 0) - (pb.currentSec || 0);
  const coveredMi = pb.cumDist ? pb.cumDist[Math.min(idx, pb.cumDist.length - 1)] : 0;
  const totalMi = pb.cumDist ? pb.cumDist[pb.cumDist.length - 1] : pb.tripData?.dist || 0;
  const nextIdx = Math.min(idx + 1, pb.coords.length - 1);
  const hdg = bearing(pb.coords[idx], pb.coords[nextIdx]);

  return (
    <div className="playback-bar visible absolute bottom-0 left-0 right-0 z-[1000] bg-gradient-to-t from-[rgba(15,17,23,0.97)] to-[rgba(15,17,23,0.85)] border-t border-border px-4 pb-3 pt-2.5 backdrop-blur">
      <div className="pb-title-row flex items-center gap-2.5 mb-2">
        <span className="font-mono text-xs text-cyan truncate flex-1">
          {pb.tripData?.date} · {pb.tripData?.from} → {pb.tripData?.to} · {pb.tripData?.dist} mi
        </span>
        <button className="w-[22px] h-[22px] rounded border border-border bg-transparent text-text-muted cursor-pointer text-sm flex items-center justify-center hover:bg-surface-2 hover:text-text transition-colors" onClick={closePlayback}>✕</button>
      </div>

      <div id="pb-graph-wrap" className="relative h-9 mb-1 cursor-pointer">
        <canvas id="pb-speed-canvas" className="w-full h-full block" />
        <div className="pb-graph-cursor absolute top-0 bottom-0 w-px bg-cyan opacity-80 pointer-events-none" style={{ left: `${pct * 100}%` }} />
      </div>

      <div id="pb-scrubber" className="relative h-5 flex items-center mb-1.5 cursor-pointer" onMouseDown={scrubStart} onTouchStart={scrubStart}>
        <div id="pb-track" className="w-full h-1 bg-border rounded relative overflow-visible">
          <div id="pb-heatmap" className="absolute top-0 left-0 right-0 bottom-0 flex pointer-events-none" />
          <div id="pb-fill" className="h-full bg-cyan rounded pointer-events-none" style={{ width: `${pct * 100}%` }} />
          <div id="pb-thumb" className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-cyan border-2 border-[#0F1117] shadow-[0_0_8px_rgba(0,212,255,0.7)] pointer-events-none z-[2]" style={{ left: `${pct * 100}%` }} />
        </div>
      </div>

      <div className="flex justify-between font-mono text-[10px] text-text-muted mb-2">
        <span id="pb-elapsed">{secToMMSS(pb.currentSec || 0)}</span>
        <span id="pb-clock">{pb.tripData ? addMins(pb.tripData.startTime, Math.floor((pb.currentSec || 0) / 60)) : '—'}</span>
        <span id="pb-remaining">-{secToMMSS(remain)}</span>
      </div>

      <div className="flex items-center gap-2">
        <button className="pb-btn w-8 h-8 rounded-md bg-surface-2 border border-border text-text cursor-pointer flex items-center justify-center hover:bg-border transition-colors shrink-0" onClick={() => pbSkip(-15)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.96"/><text x="7.5" y="15" fontSize="6" fill="currentColor" stroke="none" fontFamily="monospace">15</text></svg>
        </button>
        <button className={`w-8 h-8 rounded-md border cursor-pointer flex items-center justify-center shrink-0 transition-colors ${playing ? 'bg-cyan-dim border-[rgba(0,212,255,0.3)] text-cyan' : 'bg-surface-2 border-border text-text hover:bg-border'}`} onClick={pbTogglePlay}>
          {playing ? (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
              <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>
        <button className="w-8 h-8 rounded-md bg-surface-2 border border-border text-text cursor-pointer flex items-center justify-center hover:bg-border transition-colors shrink-0" onClick={() => pbSkip(15)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-3.96"/><text x="7.5" y="15" fontSize="6" fill="currentColor" stroke="none" fontFamily="monospace">15</text></svg>
        </button>
        <button className="w-8 h-8 rounded-md bg-surface-2 border border-border text-text cursor-pointer flex items-center justify-center hover:bg-border transition-colors shrink-0" onClick={pbStop}>
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><rect x="4" y="4" width="16" height="16" rx="1"/></svg>
        </button>
        <select className="bg-surface-2 border border-border text-text font-mono text-xs px-1.5 py-1 rounded-md cursor-pointer outline-none" value={pb.speed} onChange={e => pbSetSpeed(e.target.value)}>
          <option value="1">1×</option>
          <option value="2">2×</option>
          <option value="5">5×</option>
          <option value="10">10×</option>
          <option value="20">20×</option>
          <option value="60">60×</option>
        </select>
        <div className="flex gap-1.5 ml-auto flex-wrap">
          <div className="flex flex-col items-center px-2.5 py-1 bg-surface border border-border rounded-md min-w-[64px]">
            <span className="text-[9px] text-text-muted uppercase tracking-wider">Speed</span>
            <span className="font-mono text-sm font-bold leading-tight" style={{ color: speedColor(spd) }}>{spd} mph</span>
          </div>
          {pb.speedLimits?.[idx] != null && (
            <div className="flex flex-col items-center px-2.5 py-1 bg-surface border border-border rounded-md min-w-[64px]">
              <span className="text-[9px] text-text-muted uppercase tracking-wider">Limit</span>
              <span className={`font-mono text-sm font-bold leading-tight ${spd > pb.speedLimits[idx]! ? 'text-red' : 'text-green'}`}>
                {pb.speedLimits[idx]} mph{pb.speedLimits[idx] && spd > pb.speedLimits[idx]! ? ' ⚠' : ''}
              </span>
            </div>
          )}
          <div className="flex flex-col items-center px-2.5 py-1 bg-surface border border-border rounded-md min-w-[64px]">
            <span className="text-[9px] text-text-muted uppercase tracking-wider">Covered</span>
            <span className="font-mono text-sm font-bold leading-tight">{coveredMi.toFixed(1)} mi</span>
          </div>
          <div className="flex flex-col items-center px-2.5 py-1 bg-surface border border-border rounded-md min-w-[64px]">
            <span className="text-[9px] text-text-muted uppercase tracking-wider">Remain</span>
            <span className="font-mono text-sm font-bold leading-tight text-text-muted">{(totalMi - coveredMi).toFixed(1)} mi</span>
          </div>
          <div className="flex flex-col items-center px-2.5 py-1 bg-surface border border-border rounded-md min-w-[64px]">
            <span className="text-[9px] text-text-muted uppercase tracking-wider">Heading</span>
            <span className="font-mono text-sm font-bold leading-tight">{hdg}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
