export interface Device {
  name: string;
  plate: string;
  status: 'moving' | 'stopped' | 'offline';
  speed: number;
  odo: number;
  today: number;
  engine: string;
  year: number;
  latlng: [number, number];
}

export interface Trip {
  date: string;
  vehicle: string;
  from: string;
  to: string;
  dist: number;
  dur: string;
  avg: number;
  max: number;
  startSpeed: number;
  endSpeed: number;
  startTime: string;
  type: 'Work' | 'Personal';
  purpose: string;
  waypoints: [number, number][];
}

export interface MaintHistory {
  action: string;
  meta: string;
}

export interface MaintItem {
  name: string;
  vehicle: string;
  pct: number;
  fill: string;
  due: string;
  tag: string;
  history: MaintHistory[];
}

export interface FuelEntry {
  date: string;
  vehicle: string;
  odo: number;
  gal: number;
  ppg: number;
  mpg: number;
  station: string;
}

export interface PlaybackState {
  active: boolean;
  playing: boolean;
  route: any | null;
  coords: [number, number][];
  speeds: number[];
  speedLimits: (number | null | undefined)[];
  totalDur: number;
  currentSec: number;
  speed: number;
  rafId: number | null;
  lastTs: number | null;
  tripData: Trip | null;
  cumDist: number[];
  fullLine: any | null;
  doneLine: any | null;
  vehicleMarker: any | null;
  startMarker: any | null;
  endMarker: any | null;
  segLayers: any[];
}

export type PanelId = 'map' | 'trips' | 'maint' | 'fuel' | 'settings';
