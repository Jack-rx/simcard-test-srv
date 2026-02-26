'use strict';

const express  = require('express');
const path     = require('path');
const apiAgent = require('./src/routes/agent');
const apiCmd    = require('./src/routes/commands');
const apiUpload = require('./src/routes/upload');
const config   = require('./src/config');

const app = express();

// ── Middleware ──────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── API routes ──────────────────────────────────────────
app.use('/api/agent',    apiAgent);
app.use('/api/commands', apiCmd);
app.use('/api/upload',   apiUpload);

// ── Start ───────────────────────────────────────────────
app.listen(config.PORT, '0.0.0.0', () => {
  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│        REMOTE COMMANDER — SERVER        │');
  console.log('└─────────────────────────────────────────┘');
  console.log(`\n  ▶  http://localhost:${config.PORT}`);
  console.log(`  🔑  Token: ${config.SECRET_TOKEN}`);
  console.log('\n  Esperando agente Android...\n');
});