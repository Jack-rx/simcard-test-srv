'use strict';

const router = require('express').Router();
const store  = require('../store');

router.get('/poll', (req, res) => {
  const cmd = store.getPending();
  if (!cmd) {
    //console.log(`📡 [${new Date().toLocaleTimeString()}] Agente conectado — sin comandos pendientes`);
    return res.json({ command: null });
  }
  store.clearPending();
  console.log(`📱 [${new Date().toLocaleTimeString()}] Dispositivo tomó: [${cmd.type}] ${cmd.arg}`);
  res.json({ command: cmd });
});

router.post('/result', (req, res) => {
  const { id, result } = req.body;
  if (!id || result === undefined) {
    return res.status(400).json({ error: 'Se requieren id y result.' });
  }
  const resolved = store.resolveEntry(id, result);
  if (!resolved) {
    return res.status(404).json({ error: 'Comando no encontrado.' });
  }
  console.log(`✅ [${new Date().toLocaleTimeString()}] Resultado recibido para ${id}`);
  res.json({ ok: true });
});

module.exports = router;