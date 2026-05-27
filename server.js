'use strict';
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');
const apiAgent  = require('./src/routes/agent');
const apiCmd    = require('./src/routes/commands');
const apiUpload = require('./src/routes/upload');
const config    = require('./src/config');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

// ── Keep-alive ──────────────────────────────────────────
server.keepAliveTimeout = 65000;
server.headersTimeout   = 70000;

// Pasar io a las rutas
apiAgent.setIo(io);
apiCmd.setIo(io);

// ── Middleware ──────────────────────────────────────────
app.use(express.json());

app.use((req, res, next) => {
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', 'timeout=65');
    next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Página de archivos ──────────────────────────────────
app.get('/files', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'files.html'));
});

// ── Heartbeat del agente ────────────────────────────────
app.get('/api/agent/ping', (req, res) => {
    res.json({ status: 'ok', time: Date.now() });
});

// ── API routes ──────────────────────────────────────────
app.use('/api/agent',    apiAgent);
app.use('/api/commands', apiCmd);
app.use('/api/upload',   apiUpload);

// ── Socket.IO — conexiones del frontend web ─────────────
io.on('connection', (socket) => {
    console.log(`🖥️  Panel web conectado: ${socket.id}`);
<<<<<<< HEAD
    
    // Al conectarse, enviamos inmediatamente el puerto configurado al frontend
    socket.emit('server:info', { port: config.PORT });

=======
>>>>>>> 02612dd63bc48e2fe60d6a411cddcdb21217e80c
    socket.on('disconnect', () => {
        console.log(`🖥️  Panel web desconectado: ${socket.id}`);
    });
});

// ── Start ───────────────────────────────────────────────
server.listen(config.PORT, '0.0.0.0', () => {
    console.log('\n┌─────────────────────────────────────────┐');
    console.log('│        REMOTE COMMANDER — SERVER        │');
    console.log('└─────────────────────────────────────────┘');
    console.log(`\n  ▶  http://localhost:${config.PORT}`);
    console.log(`  🔑  Token: ${config.SECRET_TOKEN}`);
    console.log(`  📂  Archivos: http://localhost:${config.PORT}/files`);
    console.log('\n  Esperando agente Android...\n');
});
