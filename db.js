'use strict';
const { Pool } = require('pg');

let pool = createPool();

function createPool() {
  const p = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis:       60_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });

  p.on('error', (err) => {
    console.error('[db] Pool error:', err.message);
    // Recreate pool after error
    setTimeout(() => {
      console.log('[db] Recreating pool after error...');
      pool = createPool();
    }, 5000);
  });

  return p;
}

// Keepalive ping every 30 seconds
setInterval(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('[keepalive] Database ping ok');
  } catch (err) {
    console.error('[keepalive] Database ping failed:', err.message);
    // Recreate pool on keepalive failure
    console.log('[keepalive] Recreating pool...');
    pool = createPool();
  }
}, 30_000);

// Proxy that always uses the current pool
const handler = {
  get(target, prop) {
    return (...args) => pool[prop](...args);
  }
};

module.exports = new Proxy({}, handler);
