import { getPool } from './connection.js';

async function backfillTrips() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    // Find devices that have positions but no trips
    const devices = await client.query(`
      SELECT DISTINCT p.device_id, d.name, d.unique_id
      FROM positions p
      JOIN devices d ON d.id = p.device_id
      WHERE p.speed > 2
      AND p.device_id NOT IN (SELECT device_id FROM trips)
    `);

    for (const dev of devices.rows) {
      console.log(`Processing ${dev.name} (${dev.unique_id})...`);

      // Get positions ordered by time, find continuous driving segments
      const positions = await client.query(`
        SELECT id, latitude, longitude, speed, device_timestamp
        FROM positions
        WHERE device_id = $1 AND speed > 0
        ORDER BY device_timestamp ASC
      `, [dev.device_id]);

      if (positions.rows.length < 2) continue;

      let tripStart: any = null;
      let tripPositions: any[] = [];
      let lastSpeed = 0;

      for (const pos of positions.rows) {
        const speed = pos.speed || 0;
        const isMoving = speed > 2;

        if (isMoving && !tripStart) {
          // Start of a trip
          tripStart = pos;
          tripPositions = [pos];
        } else if (tripStart) {
          tripPositions.push(pos);
          if (!isMoving && lastSpeed <= 2) {
            // Been stopped for two consecutive positions — end trip
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
                dev.device_id, first.id, last.id,
                first.device_timestamp, last.device_timestamp,
                first.latitude, first.longitude, last.latitude, last.longitude,
                distance, Math.round(duration), distance / (duration / 3600), maxSpeed,
              ]);
              console.log(`  Trip: ${distance.toFixed(1)} mi, ${Math.round(duration)}s`);
            }
            tripStart = null;
            tripPositions = [];
          }
        }
        lastSpeed = speed;
      }

      // Handle trip still in progress (not yet stopped)
      if (tripStart && tripPositions.length >= 2) {
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
            dev.device_id, first.id, last.id,
            first.device_timestamp, last.device_timestamp,
            first.latitude, first.longitude, last.latitude, last.longitude,
            distance, Math.round(duration), distance / (duration / 3600), maxSpeed,
          ]);
          console.log(`  Trip (open): ${distance.toFixed(1)} mi, ${Math.round(duration)}s`);
        }
      }
    }

    console.log('Backfill complete');
  } finally {
    client.release();
    await pool.end();
  }
}

backfillTrips().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
