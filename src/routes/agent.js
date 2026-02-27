'use strict';

const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const store  = require('../store');
const { CMD_TIMEOUT } = require('../config');

let _io = null;
function setIo(io) { _io = io; }

function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
}

// GET /api/agent/poll
router.get('/poll', (req, res) => {
  const ip    = getClientIp(req);
  const agent = store.registerAgent(ip);

  // Primera conexión: encolar info automáticamente
  if (agent.isNew && !agent.pendingCommand) {
    agent.isNew = false;
    const infoEntry = {
      id:       uuidv4(),
      type:     'info',
      arg:      '',
      agentId:  agent.id,
      sentAt:   new Date().toISOString(),
      status:   'pending',
      result:   null,
      completedAt: null,
    };
    store.setPending(agent.id, infoEntry);
    store.addToHistory(infoEntry);

    // Notificar al frontend que hay un agente nuevo
    if (_io) _io.emit('agent:new', { id: agent.id, ip: agent.ip });

    setTimeout(() => {
      const live = store.findById(infoEntry.id);
      if (live && live.status === 'pending') {
        store.resolveEntry(infoEntry.id, '[TIMEOUT]');
        store.clearPending(agent.id);
      }
    }, CMD_TIMEOUT);
  }

  // Notificar al frontend que el agente sigue vivo
  if (_io) _io.emit('agent:ping', { id: agent.id, lastSeen: agent.lastSeen });

  const cmd = store.getPending(agent.id);
  if (!cmd) return res.json({ command: null });

  store.clearPending(agent.id);
  console.log(`📱 [${new Date().toLocaleTimeString()}] [${ip}] tomó: [${cmd.type}] ${cmd.arg}`);
  res.json({ command: cmd });
});

// POST /api/agent/result
router.post('/result', (req, res) => {
  const { id, result } = req.body;
  if (!id || result === undefined)
    return res.status(400).json({ error: 'Se requieren id y result.' });

  const resolved = store.resolveEntry(id, result);
  if (!resolved)
    return res.status(404).json({ error: 'Comando no encontrado.' });

  const entry = store.findById(id);

  // Notificar resultado al frontend en tiempo real
  if (_io) _io.emit('command:result', { id, result, agentId: entry?.agentId });

  // Si era info, notificar también la info actualizada del agente
  if (entry?.type === 'info' && entry?.agentId) {
    const agent = store.getAgentById(entry.agentId);
    if (_io && agent) _io.emit('agent:info', { id: agent.id, info: agent.info });
  }

  console.log(`✅ [${new Date().toLocaleTimeString()}] Resultado para ${id}`);
  res.json({ ok: true });
});

// GET /api/agent/list
router.get('/list', (req, res) => {
  res.json(store.getAgents());
});

module.exports = router;
module.exports.setIo = setIo;