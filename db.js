'use strict';
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis:    30_000,
  connectionTimeoutMillis: 10_000,
  // Keepalive settings — prevent connection dropping on Supabase free tier
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
});

// Reconnect automatically if connection is lost
pool.on('error', (err, client) => {
  console.error('Unexpected pg pool error', err);
});

// Test connection on startup
pool.query('SELECT 1').then(() => {
  console.log('Database connected successfully');
}).catch(err => {
  console.error('Database connection failed on startup:', err);
});

module.exports = pool;
