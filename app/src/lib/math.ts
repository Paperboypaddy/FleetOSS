export function haversineMi(a: [number, number], b: [number, number]): number {
  const R = 3958.8;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLon = (b[1] - a[1]) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}

export function bearing(a: [number, number], b: [number, number]): string {
  const lat1 = a[0] * Math.PI / 180, lat2 = b[0] * Math.PI / 180;
  const dLon = (b[1] - a[1]) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const brng = Math.atan2(y, x) * 180 / Math.PI;
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(((brng + 360) % 360) / 45) % 8];
}

export function buildCumDist(coords: [number, number][]): number[] {
  let d = 0; const cum = [0];
  for (let i = 1; i < coords.length; i++) { d += haversineMi(coords[i - 1], coords[i]); cum.push(d); }
  return cum;
}

export function secToMMSS(s: number): string {
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return `${m}:${String(ss).padStart(2, '0')}`;
}

export function speedColor(mph: number): string {
  if (mph >= 60) return '#EF4444';
  if (mph >= 40) return '#F59E0B';
  return '#10B981';
}

export function addMins(timeStr: string, mins: number): string {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + mins;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  const ampm = hh >= 12 ? 'PM' : 'AM';
  return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${ampm}`;
}

export function interpAtSec(
  sec: number,
  coords: [number, number][],
  speeds: number[],
  totalDur: number,
): { latlng: [number, number]; spd: number; idx: number; pct: number } {
  const pct = Math.min(1, Math.max(0, sec / totalDur));
  const fIdx = pct * (coords.length - 1);
  const lo = Math.floor(fIdx);
  const hi = Math.min(coords.length - 1, lo + 1);
  const t = fIdx - lo;
  const lat = coords[lo][0] + (coords[hi][0] - coords[lo][0]) * t;
  const lng = coords[lo][1] + (coords[hi][1] - coords[lo][1]) * t;
  const spd = Math.round(speeds[lo] + (speeds[hi] - speeds[lo]) * t);
  return { latlng: [lat, lng] as [number, number], spd, idx: lo, pct };
}

export function buildSpeedProfile(coords: [number, number][], t: { startSpeed: number; avg: number; max: number; endSpeed: number }): number[] {
  return coords.map((_, i) => {
    const pct = i / Math.max(coords.length - 1, 1);
    let spd;
    if (pct < 0.12) spd = t.startSpeed + (t.avg - t.startSpeed) * (pct / 0.12);
    else if (pct < 0.38) spd = t.avg + (t.max - t.avg) * ((pct - 0.12) / 0.26);
    else if (pct < 0.62) spd = t.max - (t.max - t.avg) * ((pct - 0.38) / 0.24);
    else spd = t.avg - (t.avg - t.endSpeed) * ((pct - 0.62) / 0.38);
    return Math.max(0, Math.round(spd));
  });
}
