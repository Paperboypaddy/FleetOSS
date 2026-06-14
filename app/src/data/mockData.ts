import type { Device, Trip, MaintItem, FuelEntry } from '../types';

export const devices: Device[] = [
  { name: 'T1N Sprinter', plate: 'ABC-1234', status: 'moving', speed: 34, odo: 187432, today: 68.4, engine: 'Running', year: 2004, latlng: [47.718, -116.945] },
  { name: 'Backup Unit', plate: 'XYZ-5678', status: 'stopped', speed: 0, odo: 94210, today: 0, engine: 'Off', year: 2018, latlng: [47.676, -117.051] },
];

export const tripsData: Trip[] = [
  {
    date: '2026-06-12', vehicle: 'T1N Sprinter', from: 'Post Falls', to: 'Spokane Valley',
    dist: 28.4, dur: '0:42', avg: 40, max: 67, startSpeed: 5, endSpeed: 8, startTime: '7:14',
    type: 'Work', purpose: 'AT&T Install #4481',
    waypoints: [[47.7193, -116.9454], [47.7211, -117.0000], [47.7100, -117.0800], [47.6900, -117.1800], [47.6730, -117.2200]],
  },
  {
    date: '2026-06-12', vehicle: 'T1N Sprinter', from: 'Spokane Valley', to: 'Liberty Lake',
    dist: 12.1, dur: '0:19', avg: 38, max: 55, startSpeed: 5, endSpeed: 5, startTime: '10:02',
    type: 'Work', purpose: 'AT&T Install #4482',
    waypoints: [[47.6730, -117.2200], [47.6680, -117.1900], [47.6620, -117.1400], [47.6570, -117.0900]],
  },
  {
    date: '2026-06-11', vehicle: 'T1N Sprinter', from: 'Post Falls', to: 'Airway Heights',
    dist: 41.2, dur: '1:02', avg: 39, max: 72, startSpeed: 5, endSpeed: 5, startTime: '7:05',
    type: 'Work', purpose: 'GPON Repair #3301',
    waypoints: [[47.7193, -116.9454], [47.7100, -117.0500], [47.6900, -117.2000], [47.6440, -117.4200], [47.6300, -117.5700]],
  },
  {
    date: '2026-06-11', vehicle: 'T1N Sprinter', from: 'Airway Heights', to: 'Post Falls',
    dist: 39.8, dur: '0:58', avg: 41, max: 68, startSpeed: 5, endSpeed: 5, startTime: '17:30',
    type: 'Personal', purpose: 'Return home',
    waypoints: [[47.6300, -117.5700], [47.6440, -117.4200], [47.6900, -117.2000], [47.7100, -117.0500], [47.7193, -116.9454]],
  },
  {
    date: '2026-06-10', vehicle: 'T1N Sprinter', from: 'Post Falls', to: 'Spokane',
    dist: 31.0, dur: '0:47', avg: 39, max: 70, startSpeed: 5, endSpeed: 8, startTime: '7:20',
    type: 'Work', purpose: 'AT&T Install #4479',
    waypoints: [[47.7193, -116.9454], [47.7150, -117.0300], [47.7050, -117.1500], [47.6910, -117.2700], [47.6588, -117.4260]],
  },
  {
    date: '2026-06-10', vehicle: 'Backup Unit', from: 'CDA', to: 'Rathdrum',
    dist: 14.5, dur: '0:22', avg: 39, max: 55, startSpeed: 5, endSpeed: 5, startTime: '14:10',
    type: 'Personal', purpose: 'Errand',
    waypoints: [[47.6777, -116.7805], [47.6980, -116.8500], [47.8120, -116.8960]],
  },
  {
    date: '2026-06-09', vehicle: 'T1N Sprinter', from: 'Post Falls', to: 'Cheney',
    dist: 48.7, dur: '1:10', avg: 41, max: 74, startSpeed: 5, endSpeed: 5, startTime: '6:55',
    type: 'Work', purpose: 'AT&T Install #4476',
    waypoints: [[47.7193, -116.9454], [47.7100, -117.0500], [47.6900, -117.2000], [47.6588, -117.4260], [47.5872, -117.5771]],
  },
  {
    date: '2026-06-08', vehicle: 'T1N Sprinter', from: 'Post Falls', to: 'Spokane',
    dist: 30.2, dur: '0:45', avg: 40, max: 68, startSpeed: 5, endSpeed: 8, startTime: '8:00',
    type: 'Work', purpose: 'GPON Repair #3298',
    waypoints: [[47.7193, -116.9454], [47.7150, -117.0300], [47.7050, -117.1500], [47.6910, -117.2700], [47.6588, -117.4260]],
  },
];

export const maintData: MaintItem[] = [
  {
    name: 'Tie Rod Ends', vehicle: 'T1N Sprinter', pct: 15, fill: 'fill-red', due: 'OVERDUE', tag: 'tag-red', history: [
      { action: 'Diagnosed worn inner/outer tie rods', meta: 'May 2026 — DIY inspection' },
      { action: 'Parts ordered — Moog ES800624A', meta: 'May 2026' },
      { action: 'Scheduled Les Schwab alignment post-install', meta: 'Pending' },
    ],
  },
  {
    name: 'Front Struts (Bilstein B6 HD)', vehicle: 'T1N Sprinter', pct: 25, fill: 'fill-amber', due: 'Sourced — install pending', tag: 'tag-amber', history: [
      { action: 'Bilstein B6 HD sourced', meta: 'May 2026' },
      { action: 'Rear diff fluid changed — ~6 dB noise reduction', meta: 'May 2026' },
    ],
  },
  {
    name: 'Exhaust Leak', vehicle: 'T1N Sprinter', pct: 40, fill: 'fill-amber', due: 'Monitor', tag: 'tag-amber', history: [
      { action: 'Exhaust leak diagnosed near manifold', meta: 'May 2026' },
      { action: 'Turbo linkage sticking also noted', meta: 'May 2026' },
    ],
  },
  {
    name: 'Oil Change', vehicle: 'T1N Sprinter', pct: 70, fill: 'fill-green', due: 'Due ~2,800 mi', tag: 'tag-green', history: [
      { action: 'Oil change completed', meta: 'Apr 2026 — 184,600 mi' },
    ],
  },
  {
    name: 'Wheel Bearings', vehicle: 'T1N Sprinter', pct: 50, fill: 'fill-amber', due: 'OEM parts researched', tag: 'tag-amber', history: [
      { action: 'Bearing noise noted on left front', meta: 'May 2026' },
      { action: 'OEM part numbers documented', meta: 'May 2026' },
    ],
  },
  {
    name: 'Tire Rotation', vehicle: 'Backup Unit', pct: 85, fill: 'fill-green', due: 'Due in ~3,000 mi', tag: 'tag-green', history: [
      { action: 'Rotation completed', meta: 'Mar 2026' },
    ],
  },
];

export const fuelData: FuelEntry[] = [
  { date: '2026-06-10', vehicle: 'T1N Sprinter', odo: 187312, gal: 14.432, ppg: 3.799, mpg: 18.2, station: 'Shell — Division St' },
  { date: '2026-06-06', vehicle: 'T1N Sprinter', odo: 187050, gal: 13.891, ppg: 3.819, mpg: 17.8, station: 'Chevron — Sprague' },
  { date: '2026-06-02', vehicle: 'T1N Sprinter', odo: 186793, gal: 14.110, ppg: 3.779, mpg: 18.5, station: 'Shell — Division St' },
  { date: '2026-05-28', vehicle: 'T1N Sprinter', odo: 186531, gal: 13.645, ppg: 3.849, mpg: 17.6, station: 'Costco — CDA' },
  { date: '2026-05-24', vehicle: 'T1N Sprinter', odo: 186290, gal: 14.001, ppg: 3.809, mpg: 18.1, station: 'Shell — Division St' },
  { date: '2026-05-20', vehicle: 'T1N Sprinter', odo: 186036, gal: 13.754, ppg: 3.829, mpg: 17.9, station: 'Chevron — Sprague' },
  { date: '2026-05-16', vehicle: 'T1N Sprinter', odo: 185788, gal: 14.213, ppg: 3.799, mpg: 18.3, station: 'Costco — CDA' },
  { date: '2026-05-12', vehicle: 'T1N Sprinter', odo: 185526, gal: 13.980, ppg: 3.819, mpg: 17.7, station: 'Shell — Division St' },
  { date: '2026-05-08', vehicle: 'T1N Sprinter', odo: 185279, gal: 14.090, ppg: 3.789, mpg: 18.0, station: 'Chevron — Sprague' },
  { date: '2026-05-04', vehicle: 'T1N Sprinter', odo: 185028, gal: 14.322, ppg: 3.759, mpg: 17.5, station: 'Costco — CDA' },
];
