'use strict';

const router = require('express').Router();
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// Guardar archivos en /uploads
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const ts   = Date.now();
    const name = ts + '_' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, name);
  }
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/upload
router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });
  console.log(`📥 [${new Date().toLocaleTimeString()}] Archivo recibido: ${req.file.originalname} (${req.file.size} bytes)`);
  res.json({ ok: true, filename: req.file.filename, size: req.file.size });
});

// GET /api/upload/list — listar archivos
router.get('/list', (req, res) => {
  try {
    const files = fs.readdirSync(uploadDir).map(f => {
      const stat = fs.statSync(path.join(uploadDir, f));
      return { name: f, size: stat.size, date: stat.mtime };
    }).sort((a, b) => b.date - a.date);
    res.json(files);
  } catch(e) {
    res.json([]);
  }
});

// GET /api/upload/file/:name — servir archivo para visualizar (el navegador decide cómo mostrarlo)
router.get('/file/:name', (req, res) => {
  const file = path.join(uploadDir, req.params.name.replace(/\.\./g, ''));
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'No encontrado' });
  res.sendFile(file);
});

// GET /api/upload/download/:name — forzar descarga
router.get('/download/:name', (req, res) => {
  const file = path.join(uploadDir, req.params.name.replace(/\.\./g, ''));
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'No encontrado' });
  res.download(file);
});

module.exports = router;