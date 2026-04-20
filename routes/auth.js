'use strict';
// routes/auth.js — POST /api/auth/login|refresh|logout
const router  = require('express').Router();
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const db      = require('../db');
const { requireAuth } = require('../middleware/auth');

// ── Helpers ──────────────────────────────────────────────────

function signAccessToken(user) {
  return jwt.sign(
    { email: user.email, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { subject: user.id, expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m' }
  );
}

function signRefreshToken(userId) {
  const raw = uuidv4();                                 // random, opaque
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';
  // Sign it so we can verify expiry without hitting the DB every time
  const token = jwt.sign({ sub: userId }, process.env.JWT_REFRESH_SECRET, { expiresIn });
  return { raw: token, expiresIn };
}

async function storeRefreshToken(userId, rawToken, expiresIn) {
  const hash = await bcrypt.hash(rawToken, 10);
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
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });

  try {
    // Verify signature + expiry
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const userId  = payload.sub;

    // Find a matching, non-revoked token in DB
    const { rows } = await db.query(
      `SELECT id, token_hash FROM refresh_tokens
       WHERE user_id = $1 AND revoked = FALSE AND expires_at > NOW()`,
      [userId]
    );

    let validRow = null;
    for (const row of rows) {
      if (await bcrypt.compare(refreshToken, row.token_hash)) { validRow = row; break; }
    }
    if (!validRow) return res.status(401).json({ error: 'Refresh token invalid or revoked' });

    // Rotate: revoke old, issue new
    await db.query(`UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1`, [validRow.id]);

    const { rows: uRows } = await db.query(
      `SELECT id, email, display_name, role FROM users WHERE id = $1`,
      [userId]
    );
    const user = uRows[0];

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
      const payload = jwt.decode(refreshToken);
      if (payload?.sub) {
        const { rows } = await db.query(
          `SELECT id, token_hash FROM refresh_tokens
           WHERE user_id = $1 AND revoked = FALSE`,
          [payload.sub]
        );
        for (const row of rows) {
          if (await bcrypt.compare(refreshToken, row.token_hash)) {
            await db.query(`UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1`, [row.id]);
            break;
          }
        }
      }
    } catch (_) { /* intentional */ }
  }
  res.json({ ok: true });
});

module.exports = router;
