'use strict';
// server.js — Express + Socket.io entry point
require('dotenv').config();

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const helmet     = require('helmet');
const cors       = require('cors');

const authRouter    = require('./routes/auth');
const sessionsRouter= require('./routes/sessions');
const pairsRouter   = require('./routes/pairs');
const resultsRouter = require('./routes/results');
const { registerDirectorSocket } = require('./socket/director');

const app    = express();
const server = http.createServer(app);

// ── Socket.io ─────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,  // 2 min resume window
    skipMiddlewares: true,
  },
});
registerDirectorSocket(io);

// Expose io on app so routes can emit events
app.set('io', io);

// ── Express middleware ────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',                             authRouter);
app.use('/api/sessions',                         sessionsRouter);
app.use('/api/sessions/:sessionId/pairs',        pairsRouter);
app.use('/api/sessions/:sessionId/results',      resultsRouter);

// Health-check (used by Render)
app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// 404 catch-all
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.message ?? 'Server error' });
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT ?? 4000;
server.listen(PORT, () => {
  console.log(`Bridge scoring server listening on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
});
