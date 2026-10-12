'use strict';
// middleware/rateLimit.js — tiny dependency-free, in-memory rate limiter.
//
// Fixed-window counter per key. Good enough for a single Render instance;
// counters reset on restart. Used to slow brute-forcing of login credentials
// and of the 2-digit pair PINs (only 90 possible values).

/**
 * @param {Object}   o
 * @param {number}   o.windowMs  window length in ms
 * @param {number}   o.max       max requests per key per window
 * @param {Function} [o.keyFn]   (req) => string; defaults to client IP
 * @param {string}   [o.message]
 */
function rateLimit({ windowMs, max, keyFn, message = 'Too many attempts. Please wait and try again.' }) {
  const hits = new Map(); // key -> { count, resetAt }

  // Periodically drop expired entries so the map can't grow without bound.
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, Math.max(windowMs, 60_000));
  sweeper.unref();

  return function limiter(req, res, next) {
    const key = keyFn ? keyFn(req) : req.ip;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: message, retryAfterSeconds: retryAfter });
    }
    next();
  };
}

module.exports = { rateLimit };
