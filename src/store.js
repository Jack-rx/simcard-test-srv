'use strict';

const { MAX_HISTORY } = require('./config');

/**
 * Estado global en memoria.
 * Para persistencia real, reemplaza con Redis o SQLite.
 */
const state = {
  pendingCommand: null,   // { id, type, arg, sentAt }
  history: [],            // Array de entradas (más reciente primero)
};

// ── Leer ────────────────────────────────────────────────

function getPending() {
  return state.pendingCommand;
}

function getHistory(limit = 50) {
  return state.history.slice(0, limit);
}

function findById(id) {
  return state.history.find(e => e.id === id) ?? null;
}

// ── Escribir ────────────────────────────────────────────

function setPending(cmd) {
  state.pendingCommand = cmd;
}

function clearPending() {
  state.pendingCommand = null;
}

function addToHistory(entry) {
  state.history.unshift(entry);
  if (state.history.length > MAX_HISTORY) state.history.pop();
}

function resolveEntry(id, result) {
  const entry = findById(id);
  if (!entry) return false;
  entry.result      = result;
  entry.completedAt = new Date().toISOString();
  entry.status      = 'done';
  return true;
}

module.exports = {
  getPending,
  getHistory,
  findById,
  setPending,
  clearPending,
  addToHistory,
  resolveEntry,
};
