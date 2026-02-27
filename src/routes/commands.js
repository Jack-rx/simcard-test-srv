'use strict';

const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const store  = require('../store');
const { CMD_TIMEOUT } = require('../config');

let _io = null;
function setIo(io) { _io = io; }

// POST /api/commands
router.post('/', (req, res) => {
  const { type, arg = '', agentId } = req.body;

  if (!type || typeof type !== 'string')
    return res.status(400).json({ error: 'El campo "type" es obligatorio.' });
  if (!agentId)
    return res.status(400).json({ error: 'El campo "agentId" es obligatorio.' });

  const agent = store.getAgentById(agentId);
  if (!agent)
    return res.status(404).json({ error: 'Agente no encontrado.' });

  if (store.getPending(agentId))
    return res.status(409).json({ error: 'Hay un comando pendiente para este agente.' });

  const entry = {
    id:       uuidv4(),
    type:     type.trim(),
    arg:      arg.trim(),
    agentId,
    sentAt:   new Date().toISOString(),
    status:   'pending',
    result:   null,
    completedAt: null,
  };

  store.setPending(agentId, entry);
  store.addToHistory(entry);

  // Notificar al frontend que el comando fue encolado
  if (_io) _io.emit('command:sent', { id: entry.id, type: entry.type, arg: entry.arg, agentId });

  setTimeout(() => {
    const live = store.findById(entry.id);
    if (live && live.status === 'pending') {
      store.resolveEntry(entry.id, '[TIMEOUT] El dispositivo no respondió.');
      store.clearPending(agentId);
      if (_io) _io.emit('command:result', { id: entry.id, result: '[TIMEOUT]', agentId });
    }
  }, CMD_TIMEOUT);

  console.log(`📤 [${new Date().toLocaleTimeString()}] [${agentId.slice(0,8)}] [${entry.type}] ${entry.arg}`);
  res.status(201).json({ ok: true, id: entry.id });
});

// GET /api/commands/history
router.get('/history', (req, res) => {
  const limit   = Math.min(parseInt(req.query.limit) || 50, 100);
  const agentId = req.query.agentId ?? null;
  res.json(store.getHistory(limit, agentId));
});

// GET /api/commands/:id
router.get('/:id', (req, res) => {
  const entry = store.findById(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Comando no encontrado.' });
  res.json(entry);
});

module.exports = router;
module.exports.setIo = setIo;