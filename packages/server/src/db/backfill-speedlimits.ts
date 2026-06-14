import { getPool } from './connection.js';
import { getSpeedLimit } from '../core/speed-limits.js';

async function backfillSpeedLimits() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    // Get all distinct ~100m grid cells that have positions without speed limits
    const cells = await client.query(`
      SELECT DISTINCT ROUND(latitude::numeric, 3) AS lat, ROUND(longitude::numeric, 3) AS lng
      FROM positions
      WHERE speed_limit IS NULL
    `);

    console.log(`Found ${cells.rows.length} unique grid cells without speed limits`);

    let done = 0;
    let errors = 0;
    for (const cell of cells.rows) {
      const lat = parseFloat(cell.lat);
      const lng = parseFloat(cell.lng);
      try {
        const result = await getSpeedLimit(lat, lng);
        if (result.speed != null) {
          await client.query(
            `UPDATE positions SET speed_limit = $1
             WHERE speed_limit IS NULL
             AND ROUND(latitude::numeric, 3) = $2
             AND ROUND(longitude::numeric, 3) = $3`,
            [result.speed, cell.lat, cell.lng]
          );
          done++;
        }
        const cnt = await client.query(
          `SELECT COUNT(*)::int FROM positions WHERE ROUND(latitude::numeric, 3) = $1 AND ROUND(longitude::numeric, 3) = $2`,
          [cell.lat, cell.lng]
        );
        console.log(`  [${done}/${cells.rows.length}] ${lat},${lng} → ${result.speed ?? 'N/A'} mph (${result.source}) — ${cnt.rows[0].count} positions`);
      } catch (e: any) {
        errors++;
        console.log(`  [ERR ${errors}] ${lat},${lng} — ${e.message?.slice(0, 40) || 'unknown'}`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    console.log(`\nDone. Updated ${done} unique cells.`);
  } finally {
    client.release();
    await pool.end();
  }
}

backfillSpeedLimits().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
