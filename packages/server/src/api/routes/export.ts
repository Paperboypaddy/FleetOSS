import type { FastifyInstance } from 'fastify';
import { getPool } from '../../db/connection.js';

async function tripPageHtml(tripId: string): Promise<string> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const tripResult = await client.query(
      `SELECT device_id, start_time, end_time FROM trips WHERE id = $1`,
      [tripId],
    );
    const trip = tripResult.rows[0];
    if (!trip) return '<p style="padding:20px;font-family:sans-serif">Trip not found</p>';

    const posResult = await client.query(
      `SELECT latitude, longitude, speed
       FROM positions
       WHERE device_id = $1 AND device_timestamp BETWEEN $2 AND $3
       ORDER BY device_timestamp ASC`,
      [trip.device_id, trip.start_time, trip.end_time],
    );

    const rows = posResult.rows || [];
    if (rows.length < 2) return '<p style="padding:20px;font-family:sans-serif">Not enough GPS points</p>';

    const pts = rows.map(r => `[${r.latitude},${r.longitude},${r.speed ?? 0}]`).join(',');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Trip ${tripId.slice(0, 8)} — ${rows.length} pts</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  body { margin:0; padding:0; }
  #map { width:100vw; height:100vh; }
</style>
</head>
<body>
<div id="map"></div>
<script>
const data = [${pts}];
const coords = data.map(d => [d[0], d[1]]);
const speeds = data.map(d => d[2]);

const map = L.map('map').setView([coords[0][0], coords[0][1]], 14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '© OpenStreetMap'
}).addTo(map);

L.polyline(coords, { color: '#00D4FF', weight: 3, opacity: 0.8 }).addTo(map);

L.circleMarker(coords[0], { color: '#10B981', radius: 8, fillColor: '#10B981', fillOpacity: 1 }).addTo(map).bindPopup('Start');
L.circleMarker(coords[coords.length-1], { color: '#EF4444', radius: 8, fillColor: '#EF4444', fillOpacity: 1 }).addTo(map).bindPopup('End');

for (let i = 0; i < coords.length - 1; i++) {
  const spd = speeds[i];
  const color = spd >= 60 ? '#EF4444' : spd >= 40 ? '#F59E0B' : spd >= 20 ? '#10B981' : '#64748B';
  L.polyline([coords[i], coords[i+1]], { color, weight: 4, opacity: 0.6 }).addTo(map);
}

document.title += ' — ' + coords[0][0].toFixed(4) + ', ' + coords[0][1].toFixed(4);
map.fitBounds(L.latLngBounds(coords), { padding: [40,40] });
</script>
</body>
</html>`;
  } finally {
    client.release();
  }
}

export function registerExportRoutes(app: FastifyInstance) {
  app.get<{ Params: { tripId: string } }>('/trip/:tripId', async (request, reply) => {
    reply.type('text/html');
    return reply.send(await tripPageHtml(request.params.tripId));
  });

  app.get<{ Params: { tripId: string } }>('/api/trips/:tripId/export', async (request, reply) => {
    const { tripId } = request.params;
    const pool = getPool();
    const client = await pool.connect();
    try {
      const tripResult = await client.query(
        `SELECT device_id, start_time, end_time FROM trips WHERE id = $1`,
        [tripId],
      );
      const trip = tripResult.rows[0];
      if (!trip) return reply.code(404).send({ error: 'Trip not found' });

      const posResult = await client.query(
        `SELECT device_timestamp, latitude, longitude, altitude, speed, bearing, accuracy
         FROM positions
         WHERE device_id = $1 AND device_timestamp BETWEEN $2 AND $3
         ORDER BY device_timestamp ASC`,
        [trip.device_id, trip.start_time, trip.end_time],
      );

      const rows = posResult.rows || [];
      let csv = 'timestamp,latitude,longitude,altitude,speed_mph,bearing,accuracy\n';
      for (const r of rows) {
        csv += [
          `"${r.device_timestamp}"`,
          r.latitude,
          r.longitude,
          r.altitude ?? '',
          r.speed ?? '',
          r.bearing ?? '',
          r.accuracy ?? '',
        ].join(',') + '\n';
      }

      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', `attachment; filename="trip-${tripId.slice(0, 8)}.csv"`);
      return reply.send(csv);
    } finally {
      client.release();
    }
  });
}
