"use strict";

// ── Socket.IO ────────────────────────────────────
const socket = io();

// ── DOM ─────────────────────────────────────────
const output = document.getElementById("output");
const cmdInput = document.getElementById("cmdInput");
const btnExec = document.getElementById("btnExec");
const btnClear = document.getElementById("btnClear");
const historyList = document.getElementById("historyList");
const resultBody = document.getElementById("resultBody");
const resultLabel = document.getElementById("resultLabel");
const ledAgent = document.getElementById("ledAgent");
const agentLabel = document.getElementById("agentLabel");
const agentsList = document.getElementById("agentsList");
const activeAgentTag = document.getElementById("activeAgentTag");

// ── State ────────────────────────────────────────
const inputHistory = [];
let histIndex = -1;
let activeEntryId = null;
let selectedAgent = null;
let agents = new Map(); // id → agente

// ── Init ─────────────────────────────────────────
cmdInput.focus();
loadInitialAgents();
loadHistory();

// ── Socket eventos ────────────────────────────────

socket.on("connect", () => {
  document.getElementById("ledServer").className = "led on";
});
socket.on("disconnect", () => {
  document.getElementById("ledServer").className = "led";
});

// CAPTURAR EL PUERTO Y COLOCARLO EN EL BODY ARRIBA DEL TODO
socket.on("server:info", ({ port }) => {
  console.log(`🔌 Conectado al servidor por el puerto: ${port}`);

  // 1. Verificar si ya existe el indicador para no duplicarlo
  let portBanner = document.getElementById("server-port-banner");

  if (!portBanner) {
    // 2. Crear el contenedor del banner
    portBanner = document.createElement("div");
    portBanner = document.createElement("div");
    portBanner.id = "server-port-banner";

    // Estilos CSS integrados para que quede perfectamente integrado arriba del todo
    portBanner.style.backgroundColor = "#1e293b"; // Fondo gris oscuro/azulón elegante
    portBanner.style.color = "#3b82f6"; // Texto azul brillante para el puerto
    portBanner.style.padding = "8px 16px";
    portBanner.style.fontSize = "14px";
    portBanner.style.fontFamily = "monospace";
    portBanner.style.borderBottom = "1px solid #334155";
    portBanner.style.display = "flex";
    portBanner.style.alignItems = "center";
    portBanner.style.justifyContent = "space-between";
    portBanner.style.width = "100%";
    portBanner.style.boxSizing = "border-box";

    // 3. Insertarlo de primero en el <body> (Arriba del todo)
    document.body.insertBefore(portBanner, document.body.firstChild);
  }

  // 4. Asignar el contenido con el valor del puerto recibido
  portBanner.innerHTML = `
    <span><strong>SERVER STATUS:</strong> ONLINE</span>
    <span><strong>PUERTO:</strong> <span style="color: #22c55e;">${port}</span></span>
  `;
});

// Nuevo agente conectado
socket.on("agent:new", (agent) => {
  agents.set(agent.id, { ...agent, alive: true, lastSeen: Date.now() });
  renderAgentsList();
  // Auto-seleccionar si es el primero
  if (!selectedAgent) selectAgent(agents.get(agent.id));
});

// Agente sigue vivo (cada poll)
socket.on("agent:ping", ({ id, lastSeen }) => {
  const a = agents.get(id);
  if (a) {
    a.lastSeen = lastSeen;
    a.alive = true;
    updateAgentDot(id, true);
    if (selectedAgent?.id === id) updateTopbarLed(true);
  }
});

// Info del agente recibida
socket.on("agent:info", ({ id, info }) => {
  const a = agents.get(id);
  if (a) {
    a.info = info;
    agents.set(id, a);
    renderAgentsList();
    if (selectedAgent?.id === id) {
      selectedAgent.info = info;
      const name = info?.model ?? id.slice(0, 8);
      activeAgentTag.textContent = name;
    }
  }
});

// Resultado de comando recibido en tiempo real
socket.on("command:result", ({ id, result, agentId }) => {
  // Buscar la entrada en el output por su cmdId guardado en dataset
  const entry = document.querySelector(`[data-cmd-id="${id}"]`);
  if (entry) {
    const entryId = entry.id;
    finishEntry(
      entryId,
      result,
      result.startsWith("[TIMEOUT]") ? "error" : "ok",
    );
  }
  // Actualizar agente como vivo
  const a = agents.get(agentId);
  if (a) {
    a.alive = true;
    a.lastSeen = Date.now();
  }
});

// ── Detectar agentes muertos ──────────────────────
setInterval(() => {
  const now = Date.now();
  agents.forEach((a, id) => {
    const wasAlive = a.alive;
    a.alive = now - a.lastSeen < 15000;
    if (wasAlive !== a.alive) {
      updateAgentDot(id, a.alive);
      if (selectedAgent?.id === id) updateTopbarLed(a.alive);
    }
  });
  // Actualizar contador topbar
  if (!selectedAgent) {
    const alive = [...agents.values()].filter((a) => a.alive).length;
    agentLabel.textContent = alive > 0 ? `${alive} activo(s)` : "sin agente";
    ledAgent.className = alive > 0 ? "led on" : "led";
  }
}, 5000);

// ── Cargar agentes iniciales ──────────────────────
async function loadInitialAgents() {
  try {
    const res = await fetch("/api/agent/list");
    const list = await res.json();
    list.forEach((a) => agents.set(a.id, a));
    renderAgentsList();
    if (!selectedAgent && list.length > 0) {
      const first = list.find((a) => a.alive) ?? list[0];
      selectAgent(first);
    }
  } catch (e) {}
}

// ── Render sidebar agentes ────────────────────────
function renderAgentsList() {
  if (!agents.size) {
    agentsList.innerHTML =
      '<div class="agents-empty">Sin agentes<br>conectados</div>';
    return;
  }
  agentsList.innerHTML = "";
  agents.forEach((agent) => {
    const name = agent.info?.model ?? agent.info?.brand ?? agent.id.slice(0, 8);
    const brand = agent.info?.brand ?? "";
    const ver = agent.info?.android_version
      ? `Android ${agent.info.android_version}`
      : "";
    const div = document.createElement("div");
    div.className =
      "agent-item" + (selectedAgent?.id === agent.id ? " selected" : "");
    div.dataset.agentId = agent.id;
    div.innerHTML = `
      <div class="ai-header">
        <span class="ai-id">${agent.id.slice(0, 8)}</span>
        <span class="ai-dot ${agent.alive ? "alive" : ""}" data-dot="${agent.id}"></span>
      </div>
      <span class="ai-name">${esc(name)}</span>
      ${brand ? `<span class="ai-sub">${esc(brand)}${ver ? " · " + esc(ver) : ""}</span>` : ""}
      <span class="ai-sub">${agent.ip ?? ""}</span>
    `;
    div.addEventListener("click", () => selectAgent(agent));
    agentsList.appendChild(div);
  });
}

function updateAgentDot(agentId, alive) {
  const dot = document.querySelector(`[data-dot="${agentId}"]`);
  if (dot) dot.className = "ai-dot" + (alive ? " alive" : "");
}

function updateTopbarLed(alive) {
  ledAgent.className = "led" + (alive ? " active" : "");
  agentLabel.textContent = alive
    ? (selectedAgent?.info?.model ?? "agente") + " ●"
    : "agente ○";
}

function selectAgent(agent) {
  selectedAgent = agent;
  renderAgentsList();
  activeAgentTag.textContent = agent.info?.model ?? agent.id.slice(0, 8);
  cmdInput.disabled = false;
  btnExec.disabled = false;
  cmdInput.placeholder = "comando [argumento]";
  cmdInput.focus();
  updateTopbarLed(agent.alive);
  // Recargar historial del agente
  historyList.innerHTML = "";
  [...output.children].forEach((el) => {
    if (el.id !== "bootMsg") el.remove();
  });
  loadHistory(agent.id);
}

// ── Events ────────────────────────────────────────
btnExec.addEventListener("click", sendCommand);
btnClear.addEventListener("click", () => {
  [...output.children].forEach((el) => {
    if (el.id !== "bootMsg") el.remove();
  });
  historyList.innerHTML = "";
  setResult("—", "Sin resultado aún.", "wait");
});
cmdInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    sendCommand();
    return;
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    histIndex = Math.min(histIndex + 1, inputHistory.length - 1);
    cmdInput.value = inputHistory[histIndex] ?? "";
  }
  if (e.key === "ArrowDown") {
    e.preventDefault();
    histIndex = Math.max(histIndex - 1, -1);
    cmdInput.value = histIndex >= 0 ? inputHistory[histIndex] : "";
  }
});

// ── Send command ──────────────────────────────────
async function sendCommand() {
  if (!selectedAgent) return;
  const raw = cmdInput.value.trim();
  if (!raw) return;

  const [type, ...rest] = raw.split(" ");
  const arg = rest.join(" ");

  inputHistory.unshift(raw);
  histIndex = -1;
  cmdInput.value = "";

  const entryId = "e" + Date.now();
  const entry = createOutputEntry(entryId, type, arg, selectedAgent);
  output.appendChild(entry);
  output.scrollTop = output.scrollHeight;

  const hItem = createHistoryItem(entryId, type, arg, "pending");
  historyList.prepend(hItem);

  setActive(entryId);
  setResult(raw, "▸ enviando comando…", "wait");

  try {
    const res = await fetch("/api/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, arg, agentId: selectedAgent.id }),
    });
    const data = await res.json();

    if (!res.ok) {
      finishEntry(entryId, data.error ?? "Error", "error");
      return;
    }

    // Guardar el cmdId en el elemento para que socket lo pueda encontrar
    document.getElementById(entryId).dataset.cmdId = data.id;
  } catch (err) {
    finishEntry(entryId, "Error de red: " + err.message, "error");
  }
}

// ── UI helpers ────────────────────────────────────
function createOutputEntry(id, type, arg, agent) {
  const agentName = agent?.info?.model ?? agent?.id?.slice(0, 8) ?? "?";
  const div = document.createElement("div");
  div.className = "output-entry";
  div.id = id;
  div.innerHTML = `
    <div>
      <span class="oe-prompt">›</span>
      <span class="oe-cmd">${esc(type)}</span>
      ${arg ? `<span class="oe-arg"> ${esc(arg)}</span>` : ""}
      <span class="oe-time">${new Date().toLocaleTimeString("es", { hour12: false })}</span>
      <span class="oe-agent">@ ${esc(agentName)}</span>
    </div>
    <div class="oe-result wait" data-res>esperando respuesta del dispositivo…</div>
  `;
  div.addEventListener("click", () => {
    setActive(id);
    const res = div.querySelector("[data-res]");
    if (res)
      setResult(
        type + (arg ? " " + arg : ""),
        res.textContent,
        res.classList.contains("json")
          ? "json"
          : res.classList.contains("err")
            ? "error"
            : "ok",
      );
  });
  return div;
}

function createHistoryItem(entryId, type, arg, status) {
  const div = document.createElement("div");
  div.className = "history-item";
  div.dataset.entryId = entryId;
  div.innerHTML = `
    <span class="hi-type">›</span>
    <span class="hi-cmd">${esc(type)}${arg ? " " + esc(arg) : ""}</span>
    <span class="hi-dot pending" data-dot></span>
  `;
  div.addEventListener("click", () => {
    document.getElementById(entryId)?.scrollIntoView({ behavior: "smooth" });
    setActive(entryId);
  });
  return div;
}

function finishEntry(entryId, result, status) {
  const entry = document.getElementById(entryId);
  const hItem = historyList.querySelector(`[data-entry-id="${entryId}"]`);

  let formatted = result;
  let cls = "";
  try {
    formatted = JSON.stringify(JSON.parse(result), null, 2);
    cls = "json";
  } catch (_) {
    cls = status === "error" ? "err" : "";
  }

  if (entry) {
    const res = entry.querySelector("[data-res]");
    if (res) {
      res.textContent = formatted;
      res.className = "oe-result " + cls;
    }
  }
  if (hItem) {
    const dot = hItem.querySelector("[data-dot]");
    if (dot) dot.className = "hi-dot" + (status === "error" ? " error" : "");
    if (status === "error")
      hItem.querySelector(".hi-type").style.color = "var(--red)";
  }
  if (activeEntryId === entryId) {
    setResult(
      entry?.querySelector(".oe-cmd")?.textContent ?? "",
      formatted,
      cls === "json" ? "json" : status === "error" ? "error" : "ok",
    );
  }
  output.scrollTop = output.scrollHeight;
}

function setResult(label, text, type) {
  resultLabel.textContent = label;
  resultBody.textContent = text;
  resultBody.className = "result-body " + (type ?? "");
}

function setActive(entryId) {
  activeEntryId = entryId;
  document
    .querySelectorAll(".history-item")
    .forEach((el) => el.classList.remove("active"));
  const hItem = historyList.querySelector(`[data-entry-id="${entryId}"]`);
  if (hItem) hItem.classList.add("active");
}

async function loadHistory(agentId) {
  try {
    const url = agentId
      ? `/api/commands/history?limit=30&agentId=${agentId}`
      : "/api/commands/history?limit=30";
    const res = await fetch(url);
    const list = await res.json();
    list.reverse().forEach((e) => {
      if (e.status !== "done") return;
      const entryId = "h" + e.id;
      const fakeAgent = { id: e.agentId, info: null };
      const entry = createOutputEntry(entryId, e.type, e.arg ?? "", fakeAgent);
      entry.dataset.cmdId = e.id;
      output.appendChild(entry);

      let formatted = e.result ?? "";
      let cls = "";
      try {
        formatted = JSON.stringify(JSON.parse(e.result), null, 2);
        cls = "json";
      } catch (_) {}
      const res2 = entry.querySelector("[data-res]");
      if (res2) {
        res2.textContent = formatted;
        res2.className = "oe-result " + cls;
      }

      const hItem = createHistoryItem(entryId, e.type, e.arg ?? "", "done");
      const dot = hItem.querySelector("[data-dot]");
      if (dot) dot.className = "hi-dot";
      historyList.prepend(hItem);
    });
  } catch (e) {}
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
