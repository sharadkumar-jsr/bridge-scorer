'use strict';
require('dotenv').config();

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const helmet     = require('helmet');
const cors       = require('cors');

const authRouter      = require('./routes/auth');
const sessionsRouter  = require('./routes/sessions');
const pairsRouter     = require('./routes/pairs');
const resultsRouter   = require('./routes/results');
const playRouter      = require('./routes/play');
const pdfRouter       = require('./routes/pdf');
const csvRouter       = require('./routes/csv');
const travellerRouter = require('./routes/traveller');
const { registerDirectorSocket } = require('./socket/director');

const app    = express();
const server = http.createServer(app);

// Behind Render's proxy: needed so req.ip is the real client (rate limiting).
app.set('trust proxy', 1);

// Optional lock-down: CORS_ORIGIN="https://your-app.vercel.app,https://other.example"
// Unset keeps the previous behaviour (allow any origin).
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean)
  : '*';

const io = new Server(server, {
  cors: { origin: corsOrigin, methods: ['GET','POST'] },
  connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 },
});
registerDirectorSocket(io);
app.set('io', io);

app.use(cors({ origin: corsOrigin, methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
               allowedHeaders: ['Content-Type','Authorization'] }));
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json());

// Routes
app.use('/api/auth',                         authRouter);
app.use('/api/sessions',                     sessionsRouter);
app.use('/api/sessions/:sessionId/pairs',    pairsRouter);
app.use('/api/sessions/:sessionId/results',  resultsRouter);
app.use('/api/sessions/:id/pdf',             pdfRouter);
app.use('/api/sessions/:id/csv',             csvRouter);
app.use('/api/play/:token',                  playRouter);
app.use('/api/play/:token/traveller',        travellerRouter);

app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Deeper check that also confirms the database is reachable.
app.get('/health/db', async (_req, res) => {
  try {
    await require('./db').query('SELECT 1');
    res.json({ ok: true, db: 'up', ts: new Date().toISOString() });
  } catch (err) {
    console.error('[health] db check failed:', err.message);
    res.status(503).json({ ok: false, db: 'down' });
  }
});
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.message ?? 'Server error' });
});

const PORT = process.env.PORT ?? 4000;
server.listen(PORT, () => {
  console.log(`Bridge scoring server listening on port ${PORT}`);
});
