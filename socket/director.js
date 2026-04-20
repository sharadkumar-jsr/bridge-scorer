'use strict';
// socket/director.js — Real-time director dashboard via Socket.io
//
// ROOM CONVENTION:
//   "session:<uuid>"  — all clients watching a specific session
//
// CLIENT → SERVER EVENTS:
//   join_session   { sessionId }          → join the session room
//   leave_session  { sessionId }          → leave the session room
//   request_scores { sessionId }          → pull current standings on demand
//
// SERVER → CLIENT EVENTS:
//   result:updated  { result, boardMatchpoints }  → single board scored/updated
//   scores:updated  { sessionId, rankings }       → full recalculated standings
//   session:status  { sessionId, status }         → setup|active|completed
//   error           { message }                   → something went wrong

const jwt = require('jsonwebtoken');
const { computeSessionScores } = require('../routes/results');

/**
 * Attach Socket.io event handlers.
 * @param {import('socket.io').Server} io
 */
function registerDirectorSocket(io) {
  // ── JWT handshake middleware ──────────────────────────────
  // Clients must pass { auth: { token: '<accessToken>' } } when connecting.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      socket.user = { id: payload.sub, email: payload.email, role: payload.role };
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id} (user: ${socket.user.email})`);

    // ── join_session ────────────────────────────────────────
    socket.on('join_session', async ({ sessionId } = {}) => {
      if (!isUUID(sessionId)) {
        return socket.emit('error', { message: 'Invalid sessionId' });
      }
      const room = `session:${sessionId}`;
      await socket.join(room);
      console.log(`[socket] ${socket.id} joined ${room}`);

      // Send current scores immediately on join
      try {
        const rankings = await computeSessionScores(sessionId);
        socket.emit('scores:updated', { sessionId, rankings });
      } catch (err) {
        console.error('[socket] score load error', err);
      }
    });

    // ── leave_session ────────────────────────────────────────
    socket.on('leave_session', async ({ sessionId } = {}) => {
      await socket.leave(`session:${sessionId}`);
    });

    // ── request_scores ───────────────────────────────────────
    // On-demand pull from a client (e.g. after reconnect)
    socket.on('request_scores', async ({ sessionId } = {}) => {
      if (!isUUID(sessionId)) {
        return socket.emit('error', { message: 'Invalid sessionId' });
      }
      try {
        const rankings = await computeSessionScores(sessionId);
        socket.emit('scores:updated', { sessionId, rankings });
      } catch (err) {
        socket.emit('error', { message: 'Failed to load scores' });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[socket] disconnected: ${socket.id} (${reason})`);
    });
  });
}

/**
 * Broadcast a full score recalculation to everyone in a session room.
 * Called from REST routes after a result is saved.
 * @param {import('socket.io').Server} io
 * @param {string} sessionId
 */
async function broadcastScoreUpdate(io, sessionId) {
  try {
    const rankings = await computeSessionScores(sessionId);
    io.to(`session:${sessionId}`).emit('scores:updated', { sessionId, rankings });
  } catch (err) {
    console.error('[socket] broadcastScoreUpdate error', err);
  }
}

/**
 * Broadcast a session status change (setup → active → completed).
 */
function broadcastStatusChange(io, sessionId, status) {
  io.to(`session:${sessionId}`).emit('session:status', { sessionId, status });
}

function isUUID(str) {
  return typeof str === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

module.exports = { registerDirectorSocket, broadcastScoreUpdate, broadcastStatusChange };
