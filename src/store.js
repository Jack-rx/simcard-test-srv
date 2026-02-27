'use strict';

const { MAX_HISTORY } = require('./config');
const { v4: uuidv4 } = require('uuid');

const state = {
  agents:  new Map(),  // ip → agente
  history: [],
};

// ── Agentes ─────────────────────────────────────────────

function registerAgent(ip) {
  if (!state.agents.has(ip)) {
    state.agents.set(ip, {
      id:             uuidv4(),
      ip,
      info:           null,
      lastSeen:       Date.now(),
      pendingCommand: null,
      isNew:          true,
    });
    console.log(`🆕 Nuevo agente: ${ip}`);
  } else {
    state.agents.get(ip).lastSeen = Date.now();
  }
  return state.agents.get(ip);
}

function getAgentByIp(ip)  { return state.agents.get(ip) ?? null; }

function getAgentById(id) {
  for (const a of state.agents.values()) if (a.id === id) return a;
  return null;
}

function getAgents() {
  const now = Date.now();
  return [...state.agents.values()].map(a => ({
    id: a.id, ip: a.ip, info: a.info,
    lastSeen: a.lastSeen,
    alive: (now - a.lastSeen) < 15000,
  }));
}

function setAgentInfo(id, info) {
  const a = getAgentById(id);
  if (a) a.info = info;
}

// ── Comandos ─────────────────────────────────────────────

function getPending(agentId) {
  const a = getAgentById(agentId);
  return a ? a.pendingCommand : null;
}

function clearPending(agentId) {
  const a = getAgentById(agentId);
  if (a) a.pendingCommand = null;
}

function setPending(agentId, cmd) {
  const a = getAgentById(agentId);
  if (a) a.pendingCommand = cmd;
}

// ── Historial ────────────────────────────────────────────

function getHistory(limit = 50, agentId = null) {
  let list = state.history;
  if (agentId) list = list.filter(e => e.agentId === agentId);
  return list.slice(0, limit);
}

function findById(id) { return state.history.find(e => e.id === id) ?? null; }

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
  if (entry.type === 'info' && entry.agentId) {
    try { setAgentInfo(entry.agentId, JSON.parse(result)); } catch(_) {}
  }
  return true;
}

module.exports = {
  registerAgent, getAgentByIp, getAgentById, getAgents, setAgentInfo,
  getPending, clearPending, setPending,
  getHistory, findById, addToHistory, resolveEntry,
};