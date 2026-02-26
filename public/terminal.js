'use strict';

// ── DOM ─────────────────────────────────────────
const output      = document.getElementById('output');
const cmdInput    = document.getElementById('cmdInput');
const btnExec     = document.getElementById('btnExec');
const btnClear    = document.getElementById('btnClear');
const historyList = document.getElementById('historyList');
const resultBody  = document.getElementById('resultBody');
const resultLabel = document.getElementById('resultLabel');
const ledAgent    = document.getElementById('ledAgent');
const agentLabel  = document.getElementById('agentLabel');

// ── State ────────────────────────────────────────
const inputHistory = [];
let   histIndex    = -1;
let   agentLastSeen = null;
let   activeEntryId = null;

// ── Init ─────────────────────────────────────────
cmdInput.focus();
loadHistory();
setInterval(checkAgent, 5000);

// ── Events ───────────────────────────────────────
btnExec.addEventListener('click', sendCommand);
btnClear.addEventListener('click', () => {
  [...output.children].forEach(el => { if (el.id !== 'bootMsg') el.remove(); });
  historyList.innerHTML = '';
  setResult('—', 'Sin resultado aún.', 'wait');
});

cmdInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { sendCommand(); return; }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    histIndex = Math.min(histIndex + 1, inputHistory.length - 1);
    cmdInput.value = inputHistory[histIndex] ?? '';
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    histIndex = Math.max(histIndex - 1, -1);
    cmdInput.value = histIndex >= 0 ? inputHistory[histIndex] : '';
  }
});

// ── Send command ─────────────────────────────────
async function sendCommand() {
  const raw = cmdInput.value.trim();
  if (!raw) return;

  const [type, ...rest] = raw.split(' ');
  const arg = rest.join(' ');

  inputHistory.unshift(raw);
  histIndex = -1;
  cmdInput.value = '';

  // Crear entrada en output
  const entryId = 'e' + Date.now();
  const entry = createOutputEntry(entryId, type, arg);
  output.appendChild(entry);
  output.scrollTop = output.scrollHeight;

  // Crear item en historial
  const hItem = createHistoryItem(entryId, type, arg, 'pending');
  historyList.prepend(hItem);

  // Mostrar en panel resultado
  setActive(entryId);
  setResult(raw, '▸ enviando comando…', 'wait');

  try {
    const res  = await fetch('/api/commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, arg })
    });
    const data = await res.json();

    if (!res.ok) {
      finishEntry(entryId, data.error ?? 'Error', 'error');
      return;
    }

    pollResult(data.id, entryId, raw);

  } catch (err) {
    finishEntry(entryId, 'Error de red: ' + err.message, 'error');
  }
}

// ── Poll result ───────────────────────────────────
async function pollResult(cmdId, entryId, label, attempts = 0) {
  if (attempts > 45) {
    finishEntry(entryId, 'Timeout: el dispositivo no respondió.', 'error');
    return;
  }
  try {
    const res  = await fetch(`/api/commands/${cmdId}`);
    const data = await res.json();
    if (data.status === 'done' || data.status === 'timeout') {
      finishEntry(entryId, data.result ?? '', data.status === 'done' ? 'ok' : 'error');
      return;
    }
  } catch(e) {}
  setTimeout(() => pollResult(cmdId, entryId, label, attempts + 1), 2000);
}

// ── UI helpers ────────────────────────────────────
function createOutputEntry(id, type, arg) {
  const div = document.createElement('div');
  div.className = 'output-entry';
  div.id = id;
  div.innerHTML = `
    <div>
      <span class="oe-prompt">›</span>
      <span class="oe-cmd">${esc(type)}</span>
      ${arg ? `<span class="oe-arg"> ${esc(arg)}</span>` : ''}
      <span class="oe-time">${new Date().toLocaleTimeString('es', {hour12:false})}</span>
    </div>
    <div class="oe-result wait" data-res>esperando respuesta del dispositivo…</div>
  `;
  div.addEventListener('click', () => {
    setActive(id);
    const res = div.querySelector('[data-res]');
    if (res) setResult(
      type + (arg ? ' ' + arg : ''),
      res.textContent,
      res.classList.contains('json') ? 'json' : res.classList.contains('err') ? 'error' : 'ok'
    );
  });
  return div;
}

function createHistoryItem(entryId, type, arg, status) {
  const div = document.createElement('div');
  div.className = 'history-item';
  div.dataset.entryId = entryId;
  div.innerHTML = `
    <span class="hi-type">›</span>
    <span class="hi-cmd">${esc(type)}${arg ? ' ' + esc(arg) : ''}</span>
    <span class="hi-dot pending" data-dot></span>
  `;
  div.addEventListener('click', () => {
    document.getElementById(entryId)?.scrollIntoView({ behavior: 'smooth' });
    setActive(entryId);
  });
  return div;
}

function finishEntry(entryId, result, status) {
  const entry = document.getElementById(entryId);
  const hItem = historyList.querySelector(`[data-entry-id="${entryId}"]`);

  let formatted = result;
  let cls = '';
  try {
    const parsed = JSON.parse(result);
    formatted = JSON.stringify(parsed, null, 2);
    cls = 'json';
  } catch(_) {
    cls = status === 'error' ? 'err' : '';
  }

  if (entry) {
    const res = entry.querySelector('[data-res]');
    if (res) {
      res.textContent = formatted;
      res.className = 'oe-result ' + cls;
    }
  }

  if (hItem) {
    const dot = hItem.querySelector('[data-dot]');
    if (dot) dot.className = 'hi-dot ' + (status === 'error' ? 'error' : '');
    if (status === 'error') hItem.querySelector('.hi-type').style.color = 'var(--red)';
  }

  // Actualizar agente visto
  if (status !== 'error') agentLastSeen = Date.now();

  // Si esta entrada está activa, actualizar panel resultado
  if (activeEntryId === entryId) {
    setResult(
      entry?.querySelector('.oe-cmd')?.textContent ?? '',
      formatted,
      cls === 'json' ? 'json' : status === 'error' ? 'error' : 'ok'
    );
  }

  output.scrollTop = output.scrollHeight;
}

function setResult(label, text, type) {
  resultLabel.textContent = label;
  resultBody.textContent  = text;
  resultBody.className    = 'result-body ' + (type ?? '');
}

function setActive(entryId) {
  activeEntryId = entryId;
  document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
  const hItem = historyList.querySelector(`[data-entry-id="${entryId}"]`);
  if (hItem) hItem.classList.add('active');
}

async function checkAgent() {
  try {
    const res  = await fetch('/api/commands/history?limit=3');
    const list = await res.json();
    const recent = list.find(e => e.completedAt &&
      Date.now() - new Date(e.completedAt).getTime() < 20000);
    if (recent) agentLastSeen = Date.now();
  } catch(e) {}
  const alive = agentLastSeen && Date.now() - agentLastSeen < 30000;
  ledAgent.className   = 'led' + (alive ? ' active' : '');
  agentLabel.textContent = alive ? 'agente ●' : 'agente';
}

async function loadHistory() {
  try {
    const res  = await fetch('/api/commands/history?limit=30');
    const list = await res.json();
    list.reverse().forEach(e => {
      if (e.status !== 'done') return;
      const entryId = 'h' + e.id;
      const entry = createOutputEntry(entryId, e.type, e.arg ?? '');
      output.appendChild(entry);

      let formatted = e.result ?? '';
      let cls = '';
      try { formatted = JSON.stringify(JSON.parse(e.result), null, 2); cls = 'json'; } catch(_) {}
      const res2 = entry.querySelector('[data-res]');
      if (res2) { res2.textContent = formatted; res2.className = 'oe-result ' + cls; }

      const hItem = createHistoryItem(entryId, e.type, e.arg ?? '', 'done');
      const dot = hItem.querySelector('[data-dot]');
      if (dot) dot.className = 'hi-dot';
      historyList.prepend(hItem);
    });
  } catch(e) {}
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}