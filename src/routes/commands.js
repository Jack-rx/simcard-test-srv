'use strict';

/**
 * /api/commands  — Endpoints consumidos por la terminal web.
 * Sin autenticación: asume que el panel web es de uso local/privado.
 * Si expones el servidor a internet, añade sesión o token de UI aquí.
 */

const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const store  = require('../store');
const { CMD_TIMEOUT } = require('../config');

// ── POST /api/commands ──────────────────────────────────
// Encola un nuevo comando para que el dispositivo lo ejecute.
router.post('/', (req, res) => {
  const { type, arg = '' } = req.body;

  if (!type || typeof type !== 'string') {
    return res.status(400).json({ error: 'El campo "type" es obligatorio.' });
  }

  if (store.getPending()) {
    return res.status(409).json({
      error: 'Hay un comando pendiente. Espera a que el dispositivo lo procese.',
    });
  }

  const entry = {
    id:       uuidv4(),
    type:     type.trim(),
    arg:      arg.trim(),
    sentAt:   new Date().toISOString(),
    status:   'pending',
    result:   null,
    completedAt: null,
  };

  store.setPending(entry);
  store.addToHistory(entry);

  // Auto-timeout: si el dispositivo no responde en CMD_TIMEOUT ms
  setTimeout(() => {
    const live = store.findById(entry.id);
    if (live && live.status === 'pending') {
      store.resolveEntry(entry.id, '[TIMEOUT] El dispositivo no respondió.');
      live.status = 'timeout';
    }
  }, CMD_TIMEOUT);

  console.log(`📤 [${new Date().toLocaleTimeString()}] Comando encolado: [${entry.type}] ${entry.arg}`);
  res.status(201).json({ ok: true, id: entry.id });
});

// ── GET /api/commands/history ───────────────────────────
// Devuelve el historial de comandos (últimos 50).
router.get('/history', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  res.json(store.getHistory(limit));
});

// ── GET /api/commands/:id ───────────────────────────────
// Consulta el estado de un comando específico (para polling del cliente).
router.get('/:id', (req, res) => {
  const entry = store.findById(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Comando no encontrado.' });
  res.json(entry);
});

module.exports = router;
