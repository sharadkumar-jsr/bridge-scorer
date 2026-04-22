'use strict';
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
const playRouter    = require('./routes/play');
const pdfRouter     = require('./routes/pdf');
const { registerDirectorSocket } = require('./socket/director');

const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST'] },
  connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 },
});
registerDirectorSocket(io);
app.set('io', io);

// ── CORS — allow all origins so Vercel can call Render directly ──
app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

app.use(helmet({
  crossOriginResourcePolicy: false,  // allow cross-origin PDF downloads
}));
app.use(express.json());

// Routes
app.use('/api/auth',                         authRouter);
app.use('/api/sessions',                     sessionsRouter);
app.use('/api/sessions/:sessionId/pairs',    pairsRouter);
app.use('/api/sessions/:sessionId/results',  resultsRouter);
app.use('/api/sessions/:id/pdf',             pdfRouter);
app.use('/api/play/:token',                  playRouter);

app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.message ?? 'Server error' });
});

const PORT = process.env.PORT ?? 4000;
server.listen(PORT, () => {
  console.log(`Bridge scoring server listening on port ${PORT}`);
});
