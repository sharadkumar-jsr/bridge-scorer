'use strict';
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis:       30_000,
  connectionTimeoutMillis: 10_000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
});

pool.on('error', (err) => {
  console.error('Unexpected pg pool error', err);
});

// ── Self-ping every 3 minutes ─────────────────────────────────
// Keeps the Supabase connection alive on the free tier
// so it never times out during a bridge session
setInterval(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('[keepalive] Database ping ok');
  } catch (err) {
    console.error('[keepalive] Database ping failed:', err.message);
  }
}, 60 * 1000);  // every 1 minute

module.exports = pool;
