'use strict';
// routes/auth.js — POST /api/auth/login|refresh|logout
const router  = require('express').Router();
const bcrypt  = require('bcrypt');
const crypto  = require('crypto');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const db      = require('../db');
const { requireAuth } = require('../middleware/auth');
const { rateLimit }   = require('../middleware/rateLimit');

// 10 login attempts / 15 min per client IP + email
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyFn: (req) => `${req.ip}|${String(req.body?.email ?? '').toLowerCase()}`,
  message: 'Too many login attempts. Please wait a few minutes and try again.',
});
const refreshLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 });

// ── Helpers ──────────────────────────────────────────────────

function signAccessToken(user) {
  return jwt.sign(
    { email: user.email, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { subject: user.id, expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m' }
  );
}

function signRefreshToken(userId) {
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';
  // jwtid makes every refresh token unique, even if two are issued in the same second.
  const token = jwt.sign({ sub: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn,
    jwtid: uuidv4(),
  });
  return { raw: token, expiresIn };
}

// Refresh tokens are stored as SHA-256 digests.
// (bcrypt was used before, but it only reads the first 72 bytes of its input —
//  for a JWT that is just the header plus the start of the payload, i.e. the
//  same for every token of a user — so a revoked old token still "matched"
//  the user's newest stored hash and could be replayed.)
function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

async function storeRefreshToken(userId, rawToken, expiresIn) {
  const hash = hashToken(rawToken);
  const ms   = parseDuration(expiresIn);
  const exp  = new Date(Date.now() + ms);
  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, hash, exp]
  );
}

/** Very simple duration parser: "15m" → ms, "7d" → ms */
function parseDuration(str) {
  const n = parseInt(str, 10);
  if (str.endsWith('d')) return n * 86_400_000;
  if (str.endsWith('h')) return n * 3_600_000;
  return n * 60_000;   // default minutes
}

// ── POST /api/auth/login ─────────────────────────────────────
router.post(
  '/login',
  loginLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;

    try {
      const { rows } = await db.query(
        `SELECT id, email, password_hash, display_name, role FROM users WHERE email = $1`,
        [email]
      );
      const user = rows[0];

      // Constant-time compare to prevent user enumeration
      const match = user
        ? await bcrypt.compare(password, user.password_hash)
        : await bcrypt.compare(password, '$2b$10$invalidhashpadding000000000000000000000000000000000000');

      if (!user || !match) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const accessToken           = signAccessToken(user);
      const { raw: refreshToken } = signRefreshToken(user.id);
      await storeRefreshToken(user.id, refreshToken, process.env.JWT_REFRESH_EXPIRES_IN ?? '7d');

      res.json({
        accessToken,
        refreshToken,
        user: { id: user.id, email: user.email, displayName: user.display_name, role: user.role },
      });
    } catch (err) {
      console.error('Login error', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// ── POST /api/auth/refresh ───────────────────────────────────
router.post('/refresh', refreshLimiter, async (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });

  try {
    // Verify signature + expiry
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const userId  = payload.sub;

    // Look the token up by its digest
    const { rows } = await db.query(
      `SELECT id, revoked, expires_at FROM refresh_tokens
       WHERE user_id = $1 AND token_hash = $2`,
      [userId, hashToken(refreshToken)]
    );
    const found = rows[0];
    if (!found) return res.status(401).json({ error: 'Refresh token invalid or revoked' });

    if (found.revoked) {
      // A rotated-out token is being replayed — assume it leaked and end every session.
      await db.query(`UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1`, [userId]);
      return res.status(401).json({ error: 'Refresh token invalid or revoked' });
    }
    if (new Date(found.expires_at) <= new Date()) {
      return res.status(401).json({ error: 'Refresh token invalid or revoked' });
    }

    // Rotate: revoke old (atomically — only one concurrent refresh can win), issue new
    const { rowCount } = await db.query(
      `UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1 AND revoked = FALSE`,
      [found.id]
    );
    if (rowCount === 0) return res.status(401).json({ error: 'Refresh token invalid or revoked' });

    const { rows: uRows } = await db.query(
      `SELECT id, email, display_name, role FROM users WHERE id = $1`,
      [userId]
    );
    const user = uRows[0];
    if (!user) return res.status(401).json({ error: 'Refresh token invalid or revoked' });

    const accessToken           = signAccessToken(user);
    const { raw: newRefresh }   = signRefreshToken(user.id);
    await storeRefreshToken(user.id, newRefresh, process.env.JWT_REFRESH_EXPIRES_IN ?? '7d');

    res.json({ accessToken, refreshToken: newRefresh });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    console.error('Refresh error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/auth/logout ────────────────────────────────────
router.post('/logout', requireAuth, async (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (refreshToken) {
    // Best-effort revocation — don't fail the logout if this errors
    try {
      // Only revoke a token that belongs to the authenticated user
      await db.query(
        `UPDATE refresh_tokens SET revoked = TRUE
         WHERE user_id = $1 AND token_hash = $2`,
        [req.user.id, hashToken(refreshToken)]
      );
    } catch (_) { /* intentional */ }
  }
  res.json({ ok: true });
});

module.exports = router;
