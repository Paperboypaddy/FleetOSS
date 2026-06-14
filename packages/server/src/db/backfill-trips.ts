import { getPool } from './connection.js';

const MOVING_THRESHOLD = 2 // mph
const STOP_GAP_SECONDS = 300 // 5 minutes — same as live trip detector

async function backfillTrips() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const devices = await client.query(`
      SELECT DISTINCT p.device_id, d.name, d.unique_id
      FROM positions p
      JOIN devices d ON d.id = p.device_id
      WHERE p.speed > $1
      AND p.device_id NOT IN (SELECT device_id FROM trips)
    `, [MOVING_THRESHOLD]);

    for (const dev of devices.rows) {
      console.log(`Processing ${dev.name} (${dev.unique_id})...`);

      // Get only moving positions (speed > threshold), ordered by time
      const positions = await client.query(`
        SELECT id, latitude, longitude, speed, device_timestamp
        FROM positions
        WHERE device_id = $1 AND speed > $2
        ORDER BY device_timestamp ASC
      `, [dev.device_id, MOVING_THRESHOLD]);

      if (positions.rows.length < 2) continue;

      let tripStart: any = null;
      let tripPositions: any[] = [];

      for (const pos of positions.rows) {
        const ts = new Date(pos.device_timestamp).getTime();

        if (!tripStart) {
          tripStart = pos;
          tripPositions = [pos];
          continue;
        }

        const prevTs = new Date(tripPositions[tripPositions.length - 1].device_timestamp).getTime();
        const gap = (ts - prevTs) / 1000;

        if (gap > STOP_GAP_SECONDS) {
          // Gap in positions = device was stopped for 5+ min
          if (tripPositions.length >= 2) {
            await saveTrip(client, dev.device_id, tripPositions);
          }
          tripStart = pos;
          tripPositions = [pos];
        } else {
          tripPositions.push(pos);
        }
      }

      // Handle last trip in progress
      if (tripStart && tripPositions.length >= 2) {
        await saveTrip(client, dev.device_id, tripPositions);
      }
    }

    console.log('Backfill complete');
  } finally {
    client.release();
    await pool.end();
  }
}

async function saveTrip(client: any, deviceId: string, tripPositions: any[]) {
  const first = tripPositions[0];
  const last = tripPositions[tripPositions.length - 1];
  let distance = 0;
  let maxSpeed = 0;

  for (let i = 1; i < tripPositions.length; i++) {
    const dlat = (tripPositions[i].latitude - tripPositions[i - 1].latitude) * 69;
    const dlng = (tripPositions[i].longitude - tripPositions[i - 1].longitude) * 69 * Math.cos(tripPositions[i].latitude * Math.PI / 180);
    distance += Math.sqrt(dlat * dlat + dlng * dlng);
    maxSpeed = Math.max(maxSpeed, tripPositions[i].speed || 0);
  }

  const duration = (new Date(last.device_timestamp).getTime() - new Date(first.device_timestamp).getTime()) / 1000;

  if (duration >= 30 && distance > 0.1) {
    await client.query(`
      INSERT INTO trips (device_id, start_position_id, end_position_id, start_time, end_time,
        start_lat, start_lng, end_lat, end_lng, distance, duration, avg_speed, max_speed)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      deviceId, first.id, last.id,
      first.device_timestamp, last.device_timestamp,
      first.latitude, first.longitude, last.latitude, last.longitude,
      distance, Math.round(duration), distance / (duration / 3600), maxSpeed,
    ]);
    console.log(`  Trip: ${distance.toFixed(1)} mi over ${Math.round(duration)}s (avg ${(distance / (duration / 3600)).toFixed(0)} mph, max ${maxSpeed} mph)`);
  }
}

backfillTrips().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
