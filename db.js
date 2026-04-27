'use strict';
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
  idleTimeoutMillis:       60_000,
  connectionTimeoutMillis: 15_000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
});

pool.on('error', (err) => {
  console.error('[db] Pool error:', err.message);
});

// Keepalive every 45 seconds
setInterval(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('[keepalive] Database ping ok');
  } catch (err) {
    console.error('[keepalive] ping failed:', err.message);
  }
}, 45_000);

module.exports = pool;
