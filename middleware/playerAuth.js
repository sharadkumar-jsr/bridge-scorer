'use strict';
// middleware/playerAuth.js
// Verifies a player JWT (role=player, sessionId, pairNumber)
const jwt = require('jsonwebtoken');

function requirePlayerAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Player token required' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    if (payload.role !== 'player') {
      return res.status(403).json({ error: 'Player access only' });
    }
    req.player = {
      sessionId:  payload.sessionId,
      pairNumber: payload.pairNumber,
      sessionToken: payload.sessionToken,
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired player token' });
  }
}

module.exports = { requirePlayerAuth };
