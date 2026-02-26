'use strict';

const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const apiAgent = require('./src/routes/agent');
const apiCmd    = require('./src/routes/commands');
const apiUpload = require('./src/routes/upload');
const config   = require('./src/config');

const app = express();

// ── Middleware ──────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Servir archivos de uploads ──────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Ver y descargar uploads ─────────────────────────────
app.get('/files', (req, res) => {
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) return res.send('<h3>La carpeta uploads no existe aún.</h3>');

    const files = fs.readdirSync(uploadsDir);
    if (files.length === 0) return res.send('<h3>No hay archivos en uploads.</h3>');

    const links = files.map(f =>
        `<li><a href="/uploads/${encodeURIComponent(f)}" download>${f}</a></li>`
    ).join('');

    res.send(`
        <html>
        <head><style>
            body { font-family: sans-serif; padding: 20px; background: #111; color: #eee; }
            a { color: #4af; }
            li { margin: 8px 0; }
        </style></head>
        <body>
            <h2>📂 Uploads (${files.length} archivos)</h2>
            <ul>${links}</ul>
        </body>
        </html>
    `);
});

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
  console.log(`  📂  Archivos: http://localhost:${config.PORT}/files`);
  console.log('\n  Esperando agente Android...\n');
});