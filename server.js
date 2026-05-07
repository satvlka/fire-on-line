// ─────────────────────────────────────────────────────────────────
//  Distance Alert Server  –  Node.js
//  Install:  npm install express ws
//  Run:      node server.js
//  Then open: http://localhost:3000
// ─────────────────────────────────────────────────────────────────

const express   = require('express');
const http      = require('http');
const WebSocket = require('ws');
const os        = require('os');

const PORT = 3000;

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

app.use(express.json());

// ── State ─────────────────────────────────────────────────────────
let state = {
  triggered : false,
  distance  : null,
  timestamp : null,
  alertCount: 0
};

// ── Broadcast to all dashboard clients ───────────────────────────
function broadcast(payload) {
  const msg = JSON.stringify(payload);
  wss.clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

// ── POST /alert  (called by Arduino) ─────────────────────────────
app.post('/alert', (req, res) => {
  const { triggered, distance } = req.body;

  if (typeof triggered !== 'boolean' || typeof distance !== 'number') {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const wasTriggered = state.triggered;
  state.triggered  = triggered;
  state.distance   = distance;
  state.timestamp  = new Date().toISOString();
  if (triggered && !wasTriggered) state.alertCount++;

  console.log(
    triggered ? '\x1b[31m[ALERT]\x1b[0m' : '\x1b[32m[CLEAR]\x1b[0m',
    `${distance.toFixed(1)} cm`
  );

  broadcast(state);
  res.json({ ok: true });
});

// ── GET /state  (initial load for new dashboard clients) ─────────
app.get('/state', (req, res) => res.json(state));

// ── Serve dashboard ───────────────────────────────────────────────
app.get('/', (req, res) => res.send(DASHBOARD_HTML));

// ── WebSocket: send current state on connect ──────────────────────
wss.on('connection', ws => {
  ws.send(JSON.stringify(state));
  ws.on('error', () => {});
});

// ── Start ──────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  const ifaces = os.networkInterfaces();
  let localIP  = 'localhost';
  Object.values(ifaces).flat().forEach(i => {
    if (i.family === 'IPv4' && !i.internal) localIP = i.address;
  });
  console.log(`\n  Dashboard  → http://localhost:${PORT}`);
  console.log(`  Arduino IP → ${localIP}   (use this in the .ino file)\n`);
});

// ─────────────────────────────────────────────────────────────────
//  Embedded Dashboard HTML
// ─────────────────────────────────────────────────────────────────
const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sensor Alert Dashboard</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:        #0f1117;
    --surface:   #1a1d27;
    --border:    #2c2f3f;
    --text:      #e8eaf0;
    --muted:     #6b7080;
    --safe:      #22c55e;
    --alert:     #ef4444;
    --amber:     #f59e0b;
    --blue:      #3b82f6;
    --radius:    12px;
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: system-ui, -apple-system, sans-serif;
    min-height: 100vh;
    padding: 24px;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
  }

  header h1 { font-size: 1.25rem; font-weight: 600; letter-spacing: .01em; }

  #ws-badge {
    font-size: .75rem;
    padding: 4px 10px;
    border-radius: 20px;
    background: #1f2937;
    color: var(--muted);
    border: 1px solid var(--border);
    transition: all .3s;
  }
  #ws-badge.connected { background: #14532d; color: var(--safe); border-color: #166534; }

  #status-card {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 24px;
    border-radius: var(--radius);
    background: var(--surface);
    border: 1.5px solid var(--border);
    margin-bottom: 20px;
    transition: border-color .4s, background .4s;
  }
  #status-card.alert-state {
    border-color: var(--alert);
    background: #1c0a0a;
    animation: pulse-border 1s infinite;
  }
  @keyframes pulse-border {
    0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,.3); }
    50%      { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
  }

  #status-dot {
    width: 20px; height: 20px;
    border-radius: 50%;
    background: var(--safe);
    flex-shrink: 0;
    transition: background .3s;
    box-shadow: 0 0 0 0 var(--safe);
  }
  #status-dot.alert-dot {
    background: var(--alert);
    animation: dot-pulse 1s infinite;
  }
  @keyframes dot-pulse {
    0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,.6); }
    50%      { box-shadow: 0 0 0 10px rgba(239,68,68,0); }
  }

  #status-label { font-size: 1.4rem; font-weight: 700; transition: color .3s; }
  #status-label.safe-text  { color: var(--safe); }
  #status-label.alert-text { color: var(--alert); }

  #distance-display {
    margin-left: auto;
    font-size: 2.2rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: var(--text);
    letter-spacing: -.02em;
  }
  #distance-display span { font-size: 1rem; font-weight: 400; color: var(--muted); margin-left: 4px; }

  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }

  .stat-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 18px 20px;
  }
  .stat-card .label { font-size: .75rem; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 6px; }
  .stat-card .value { font-size: 1.5rem; font-weight: 700; font-variant-numeric: tabular-nums; }

  #cam-panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    margin-bottom: 20px;
  }
  #cam-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 18px;
    border-bottom: 1px solid var(--border);
  }
  #cam-header h2 { font-size: .9rem; font-weight: 600; }
  #cam-status {
    margin-left: auto;
    font-size: .75rem;
    padding: 3px 10px;
    border-radius: 20px;
    background: #1f2937;
    color: var(--muted);
    border: 1px solid var(--border);
  }
  #cam-status.live { background: #14532d; color: var(--safe); border-color: #166534; }

  #cam-body {
    position: relative;
    background: #0a0a0a;
    min-height: 240px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  #video {
    width: 100%;
    max-height: 420px;
    display: none;
    object-fit: cover;
  }
  #cam-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    color: var(--muted);
    font-size: .9rem;
  }
  #cam-placeholder svg { opacity: .35; }

  #rec-badge {
    position: absolute;
    top: 12px; left: 12px;
    display: none;
    align-items: center;
    gap: 6px;
    background: rgba(0,0,0,.7);
    color: var(--alert);
    font-size: .75rem;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 20px;
    letter-spacing: .05em;
  }
  #rec-badge .dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--alert);
    animation: dot-pulse 1s infinite;
  }

  #log-panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }
  #log-panel h2 { font-size: .9rem; font-weight: 600; padding: 14px 18px; border-bottom: 1px solid var(--border); }
  #log-list {
    max-height: 180px;
    overflow-y: auto;
    padding: 8px 0;
    font-size: .82rem;
    font-family: monospace;
  }
  .log-entry {
    display: flex;
    gap: 12px;
    padding: 5px 18px;
    border-bottom: 1px solid rgba(255,255,255,.04);
  }
  .log-entry .ts   { color: var(--muted); flex-shrink: 0; }
  .log-entry .msg  { color: var(--text); }
  .log-entry.is-alert .msg { color: var(--alert); }
  .log-entry.is-clear .msg { color: var(--safe); }

  #toast {
    position: fixed;
    top: 20px; right: 20px;
    background: var(--alert);
    color: #fff;
    padding: 14px 20px;
    border-radius: var(--radius);
    font-weight: 600;
    font-size: .95rem;
    box-shadow: 0 8px 30px rgba(239,68,68,.4);
    transform: translateX(110%);
    transition: transform .35s cubic-bezier(.175,.885,.32,1.275);
    z-index: 999;
    max-width: 300px;
  }
  #toast.show { transform: translateX(0); }

  @media (max-width: 540px) {
    .grid { grid-template-columns: 1fr; }
    #distance-display { font-size: 1.6rem; }
  }
</style>
</head>
<body>

<header>
  <h1>&#x1F52D; Sensor Alert Dashboard</h1>
  <span id="ws-badge">&#x25CF; Connecting&hellip;</span>
</header>

<div id="status-card">
  <div id="status-dot"></div>
  <div id="status-label" class="safe-text">Zone clear</div>
  <div id="distance-display">&mdash;<span>cm</span></div>
</div>

<div class="grid">
  <div class="stat-card">
    <div class="label">Alert count</div>
    <div class="value" id="alert-count">0</div>
  </div>
  <div class="stat-card">
    <div class="label">Threshold</div>
    <div class="value" id="threshold-val">50 cm</div>
  </div>
</div>

<div id="cam-panel">
  <div id="cam-header">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>
    </svg>
    <h2>Live Camera Feed</h2>
    <span id="cam-status">Standby</span>
  </div>
  <div id="cam-body">
    <video id="video" autoplay playsinline muted style="display:none"></video>
    <canvas id="cam-canvas" style="width:100%;max-height:420px;display:none;"></canvas>
    <div id="cam-placeholder">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>
      </svg>
      <span>Camera activates when threshold is triggered</span>
    </div>
    <div id="rec-badge"><div class="dot"></div> LIVE</div>
  </div>
</div>

<div id="log-panel">
  <h2>Event log</h2>
  <div id="log-list"></div>
</div>

<div id="toast"></div>

<script>
  var $ = function(id) { return document.getElementById(id); };
  var statusCard  = $('status-card');
  var statusDot   = $('status-dot');
  var statusLabel = $('status-label');
  var distDisplay = $('distance-display');
  var alertCount  = $('alert-count');
  var camStatus   = $('cam-status');
  var video       = $('video');
  var placeholder = $('cam-placeholder');
  var recBadge    = $('rec-badge');
  var logList     = $('log-list');
  var toast       = $('toast');
  var wsBadge     = $('ws-badge');
  var canvas      = $('cam-canvas');
  var ctx         = canvas.getContext('2d');

  var lastTriggered = false;
  var camStream     = null;
  var animFrame     = null;
  var vegCount      = 0;
  var toastTimer    = null;

  function connectWS() {
    var ws = new WebSocket('ws://' + location.host);
    ws.onopen = function() {
      wsBadge.textContent = 'Connected';
      wsBadge.classList.add('connected');
    };
    ws.onclose = function() {
      wsBadge.textContent = 'Reconnecting...';
      wsBadge.classList.remove('connected');
      setTimeout(connectWS, 2000);
    };
    ws.onmessage = function(e) {
      try { applyState(JSON.parse(e.data)); } catch(err) {}
    };
  }

  function applyState(s) {
    var triggered = s.triggered;
    var distance  = s.distance;
    var timestamp = s.timestamp;
    var cnt       = s.alertCount;

    var dist = distance != null ? distance.toFixed(1) : '--';
    distDisplay.innerHTML = dist + '<span>cm</span>';

    if (triggered) {
      statusCard.classList.add('alert-state');
      statusDot.classList.add('alert-dot');
      statusLabel.className = 'alert-text';
      statusLabel.textContent = 'Threshold breached!';
    } else {
      statusCard.classList.remove('alert-state');
      statusDot.classList.remove('alert-dot');
      statusLabel.className = 'safe-text';
      statusLabel.textContent = 'Zone clear';
    }

    if (cnt != null) alertCount.textContent = cnt;

    if (triggered && !camStream) startCamera();
    if (!triggered && camStream) stopCamera();

    if (triggered && !lastTriggered) {
      addLog('ALERT - object detected at ' + dist + ' cm', 'is-alert', timestamp);
      showToast('Object detected at ' + dist + ' cm!');
    } else if (!triggered && lastTriggered) {
      addLog('CLEAR - zone is safe', 'is-clear', timestamp);
    }

    lastTriggered = triggered;
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function() { toast.classList.remove('show'); }, 4000);
  }

  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
    var h = 0, s = max === 0 ? 0 : d / max, v = max;
    if (d !== 0) {
      if      (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else                h = ((r - g) / d + 4) / 6;
    }
    return [h * 360, s * 100, v * 100];
  }

  function findGreenBoxes(imageData, w, h) {
    var mask = new Uint8Array(w * h);
    var data = imageData.data;
    var hsv, hue, sat, val;

    for (var i = 0; i < w * h; i++) {
      hsv = rgbToHsv(data[i*4], data[i*4+1], data[i*4+2]);
      hue = hsv[0]; sat = hsv[1]; val = hsv[2];
      if (hue >= 65 && hue <= 165 && sat >= 25 && val >= 15) mask[i] = 1;
    }

    var CELL = 20;
    var cols = Math.floor(w / CELL), rows = Math.floor(h / CELL);
    var boxes = [];
    var visited = new Uint8Array(cols * rows);

    function countCell(cx, cy) {
      var count = 0, px, py;
      for (var dy = 0; dy < CELL; dy++)
        for (var dx = 0; dx < CELL; dx++) {
          px = cx * CELL + dx; py = cy * CELL + dy;
          if (px < w && py < h && mask[py * w + px]) count++;
        }
      return count;
    }

    var queue, idx, qx, qy, nx, ny, ni, minX, maxX, minY, maxY, bw, bh;
    var neighbors = [[-1,0],[1,0],[0,-1],[0,1]];

    for (var cy = 0; cy < rows; cy++) {
      for (var cx = 0; cx < cols; cx++) {
        idx = cy * cols + cx;
        if (visited[idx] || countCell(cx, cy) < CELL * CELL * 0.25) continue;
        queue = [[cx, cy]];
        visited[idx] = 1;
        minX = cx; maxX = cx; minY = cy; maxY = cy;
        while (queue.length) {
          var cell = queue.shift();
          qx = cell[0]; qy = cell[1];
          if (qx < minX) minX = qx; if (qx > maxX) maxX = qx;
          if (qy < minY) minY = qy; if (qy > maxY) maxY = qy;
          for (var n = 0; n < neighbors.length; n++) {
            nx = qx + neighbors[n][0]; ny = qy + neighbors[n][1];
            ni = ny * cols + nx;
            if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !visited[ni] && countCell(nx, ny) >= CELL * CELL * 0.2) {
              visited[ni] = 1;
              queue.push([nx, ny]);
            }
          }
        }
        bw = (maxX - minX + 1) * CELL;
        bh = (maxY - minY + 1) * CELL;
        if (bw * bh > 1200) boxes.push([minX * CELL, minY * CELL, bw, bh]);
      }
    }
    return boxes;
  }

  function drawFrame() {
    if (!camStream) return;
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var boxes     = findGreenBoxes(imageData, canvas.width, canvas.height);

    vegCount = boxes.length;

    for (var i = 0; i < boxes.length; i++) {
      var x = boxes[i][0], y = boxes[i][1], w = boxes[i][2], h = boxes[i][3];
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth   = 2.5;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(x, y - 22, 110, 22);
      ctx.fillStyle = '#fff';
      ctx.font      = 'bold 13px system-ui';
      ctx.fillText('Vegetation', x + 6, y - 6);
    }

    var label = vegCount > 0
      ? '\u2714 ' + vegCount + ' vegetation zone' + (vegCount > 1 ? 's' : '') + ' detected'
      : 'No vegetation detected';

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(8, 8, 190, 28);
    ctx.fillStyle = vegCount > 0 ? '#22c55e' : '#9ca3af';
    ctx.font      = 'bold 13px system-ui';
    ctx.fillText(label, 16, 27);

    animFrame = requestAnimationFrame(drawFrame);
  }

  function startCamera() {
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(function(stream) {
        camStream = stream;
        video.srcObject = stream;
        video.onloadedmetadata = function() {
          video.play();
          canvas.style.display = 'block';
          placeholder.style.display = 'none';
          recBadge.style.display = 'flex';
          camStatus.textContent = 'LIVE';
          camStatus.classList.add('live');
          drawFrame();
        };
      })
      .catch(function(e) {
        addLog('Camera error: ' + e.message, '', null);
      });
  }

  function stopCamera() {
    if (!camStream) return;
    cancelAnimationFrame(animFrame);
    camStream.getTracks().forEach(function(t) { t.stop(); });
    camStream = null;
    video.srcObject = null;
    canvas.style.display = 'none';
    placeholder.style.display = 'flex';
    recBadge.style.display = 'none';
    camStatus.textContent = 'Standby';
    camStatus.classList.remove('live');
    vegCount = 0;
  }

  function addLog(msg, cls, iso) {
    var ts  = iso ? new Date(iso).toLocaleTimeString() : new Date().toLocaleTimeString();
    var row = document.createElement('div');
    row.className = 'log-entry ' + (cls || '');
    row.innerHTML = '<span class="ts">' + ts + '</span><span class="msg">' + msg + '</span>';
    logList.prepend(row);
    while (logList.children.length > 50) logList.removeChild(logList.lastChild);
  }

  addLog('Dashboard loaded - waiting for sensor...', '', null);
  connectWS();
</script>
</body>
</html>`;