'use strict';

const { SECRET_TOKEN } = require('../config');

/**
 * Middleware: verifica que la petición incluya el token correcto.
 * Header esperado: Authorization: Bearer <token>
 */
function requireToken(req, res, next) {
  const auth = req.headers['authorization'] ?? '';
  if (auth !== `Bearer ${SECRET_TOKEN}`) {
    return res.status(401).json({ error: 'Token inválido o ausente.' });
  }
  next();
}

module.exports = { requireToken };
