/* Pelham Sled Trails — unofficial GPS trail map. Plain JS, no build step. */
(() => {
'use strict';

// ---------- config ----------
const CFG = {
  center: [42.731, -71.318], zoom: 13,
  maxBounds: [[42.60, -71.52], [42.88, -71.12]],
  offlineBox: { w: -71.405, s: 42.682, e: -71.235, n: 42.782 },   // Pelham plus a margin into the neighbouring towns
  offlineZooms: [11, 12, 13, 14, 15, 16],
  tiles: {
    topo: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}',
    sat: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}',
  },
  tileCache: 'pst-tiles-v1',
  onTrailM: 35,          // within this of a line counts as on the trail
  offTrailM: 75,         // farther than this triggers the warning (lines are traced, so stay generous)
  offTrailApproxM: 110,  // looser where the nearest line is only approximate
  maxAccM: 40,           // ignore fixes worse than this for recording / warnings
};
const ZONES = {
  town: 'Town trails, power lines and connectors', peabody: 'Peabody Town Forest', kirby: 'Kirby-Ivers Town Forest',
  gumpas: 'Gumpas Pond Conservation Area', cutter: 'Merriam / Cutter Woods', littleisland: 'Little Island Pond area',
};
const STATE_LABEL = { open: 'OPEN', caution: 'CAUTION', closed: 'CLOSED', unknown: 'UNKNOWN' };
const STATE_COLOR = { open: '#12b76a', caution: '#ff9f0a', closed: '#f04438', unknown: '#8b5cf6' };

// ---------- tiny helpers ----------
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem('pst.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('pst.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
};
const M2FT = 3.28084, M2MI = 0.000621371, MS2MPH = 2.23694;
const fmtFt = m => m >= 1609 ? (m * M2MI).toFixed(1) + ' mi' : Math.round(m * M2FT / 10) * 10 + ' ft';
const fmtDur = s => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? h + 'h ' + String(m).padStart(2, '0') + 'm' : m + 'm ' + String(s % 60).padStart(2, '0') + 's'; };
const haversine = (a, b) => { const R = 6371000, p = Math.PI / 180, dla = (b[0] - a[0]) * p, dlo = (b[1] - a[1]) * p;
  const h = Math.sin(dla / 2) ** 2 + Math.cos(a[0] * p) * Math.cos(b[0] * p) * Math.sin(dlo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
let toastTimer;
const toast = (msg, ms = 3200) => { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, ms); };
const params = new URLSearchParams(location.search);
const H = {};   // hooks filled in by members.js

// ---------- map ----------
const map = L.map('map', { zoomControl: false, attributionControl: true, maxBounds: CFG.maxBounds, maxBoundsViscosity: 0.8, minZoom: 10, maxZoom: 19, tap: false })
  .setView(store.get('view', { c: CFG.center }).c, store.get('view', { z: CFG.zoom }).z || CFG.zoom);
L.control.zoom({ position: 'topright' }).addTo(map);
L.control.scale({ metric: false, position: 'bottomright' }).addTo(map);
map.attributionControl.setPrefix(false);
const USGS = 'Base map: USGS The National Map';
const base = {
  topo: L.tileLayer(CFG.tiles.topo, { maxNativeZoom: 16, maxZoom: 19, attribution: USGS + ' · Trails © OpenStreetMap contributors', crossOrigin: true }),
  sat: L.tileLayer(CFG.tiles.sat, { maxNativeZoom: 16, maxZoom: 19, attribution: USGS + ' · Trails © OpenStreetMap contributors', crossOrigin: true }),
};
let baseName = store.get('base', 'topo');
function setBase(name) {
  Object.values(base).forEach(l => map.removeLayer(l));
  base[name].addTo(map); baseName = name; store.set('base', name);
  $('map').classList.toggle('topo', name === 'topo'); $('map').classList.toggle('sat', name === 'sat');
}
setBase(baseName);
map.on('moveend', () => store.set('view', { c: [map.getCenter().lat, map.getCenter().lng], z: map.getZoom() }));
function setNight(on) { document.body.classList.toggle('night', on); store.set('night', on); }
setNight(store.get('night', false));

// ---------- data ----------
let trails = null, status = null, trailLayers = [], segIndex = null;
const getJSON = (url, opt) => fetch(url, opt).then(r => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
const zoneState = z => (status && status.zones && status.zones[z] && status.zones[z].state) || (status && status.overall && status.overall.state) || 'unknown';

function trailStyle(f) {
  const st = zoneState(f.properties.zone), pond = f.properties.note === 'pond';
  return { color: pond ? '#00c2ff' : STATE_COLOR[st], weight: 5, opacity: 1, dashArray: pond ? '4 9' : f.properties.acc === 'approx' ? '12 8' : null, lineCap: 'round' };
}
function trailPopup(f) {
  const p = f.properties, st = zoneState(p.zone), zn = (status && status.zones && status.zones[p.zone]) || {};
  return `<b>${esc(p.name || (p.note === 'pond' ? 'Pond crossing' : 'Snowmobile trail'))}</b><br>${esc(ZONES[p.zone] || '')}<br>` +
    `<span class="tag ${st}">${STATE_LABEL[st]}</span>${zn.note ? '<br>' + esc(zn.note) : ''}<br>` +
    `<small>${(p.km * 0.6214).toFixed(2)} mi · ${p.acc === 'mapped' ? 'Line follows a mapped path' : 'Approximate line, traced from a picture'}` +
    `${p.note === 'pond' ? '<br><b>Crosses ice. Check conditions.</b>' : ''}${p.note === 'closed2022' ? '<br>Shown as closed on the club\'s 2022 map.' : ''}</small>`;
}
function drawTrails() {
  trailLayers.forEach(l => map.removeLayer(l)); trailLayers = [];
  const casing = L.geoJSON(trails, { style: { color: '#fff', weight: 9, opacity: .9, lineCap: 'round' }, interactive: false }).addTo(map);
  const lines = L.geoJSON(trails, { style: trailStyle, onEachFeature: (f, l) => l.bindPopup(() => trailPopup(f), { maxWidth: 260 }) }).addTo(map);
  // fat invisible hit area so gloved fingers can tap a trail
  const hit = L.geoJSON(trails, { style: { color: '#000', weight: 30, opacity: 0 }, onEachFeature: (f, l) => l.bindPopup(() => trailPopup(f), { maxWidth: 260 }) }).addTo(map);
  trailLayers = [casing, lines, hit];
}

// nearest-trail lookup: segments in local metres, bucketed on a 150 m grid
const LAT0 = 42.73, LON0 = -71.32, KX = Math.cos(LAT0 * Math.PI / 180) * 111320, KY = 110540, CELL = 150;
const toXY = (lat, lon) => [(lon - LON0) * KX, (lat - LAT0) * KY];
function buildIndex() {
  const grid = new Map(), segs = [];
  for (const f of trails.features) {
    const c = f.geometry.coordinates;
    for (let i = 0; i < c.length - 1; i++) {
      const a = toXY(c[i][1], c[i][0]), b = toXY(c[i + 1][1], c[i + 1][0]), id = segs.length;
      segs.push([a[0], a[1], b[0], b[1], f]);
      const x0 = Math.floor((Math.min(a[0], b[0]) - CELL) / CELL), x1 = Math.floor((Math.max(a[0], b[0]) + CELL) / CELL);
      const y0 = Math.floor((Math.min(a[1], b[1]) - CELL) / CELL), y1 = Math.floor((Math.max(a[1], b[1]) + CELL) / CELL);
      for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) { const k = gx + ':' + gy; (grid.get(k) || grid.set(k, []).get(k)).push(id); }
    }
  }
  segIndex = { grid, segs };
}
function nearestTrail(lat, lon) {
  if (!segIndex) return null;
  const [x, y] = toXY(lat, lon), ids = segIndex.grid.get(Math.floor(x / CELL) + ':' + Math.floor(y / CELL));
  if (!ids) return { dist: Infinity, feature: null };
  let best = Infinity, bf = null;
  for (const id of ids) {
    const [ax, ay, bx, by, f] = segIndex.segs[id], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    const t = L2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2)) : 0;
    const d = Math.hypot(x - ax - t * dx, y - ay - t * dy);
    if (d < best) { best = d; bf = f; }
  }
  return { dist: best, feature: bf };
}

function poiIcon(p) {
  return L.divIcon({ className: '', iconSize: [34, 34], iconAnchor: [17, 17],
    html: `<div class="poi ${p.type}${p.flag === 'x2022' ? ' x' : ''}">${p.type === 'parking' ? 'P' : '!'}</div>` });
}
function addPois(data) {
  for (const p of data.pois) {
    const nav = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;
    L.marker([p.lat, p.lon], { icon: poiIcon(p), title: p.name }).addTo(map).bindPopup(
      `<b>${esc(p.name)}</b><br>${esc(p.detail || '')}<br><small>${p.src === 'club' ? 'Location from the club\'s website.' : 'Position read from the club\'s 2022 map picture; may be off by 100 ft.'}</small>` +
      (p.type === 'parking' ? `<br><a href="${nav}" target="_blank" rel="noopener">Driving directions</a>` : ''), { maxWidth: 260 });
  }
}
function addTownLine(g) { L.geoJSON(g, { style: { color: '#5b2a86', weight: 2, opacity: .7, dashArray: '2 8' }, interactive: false }).addTo(map).bringToBack(); }
function addZoneLabels() {
  const by = {};
  for (const f of trails.features) { if (f.properties.zone === 'town') continue; const b = (by[f.properties.zone] = by[f.properties.zone] || { x: 0, y: 0, n: 0 });
    for (const c of f.geometry.coordinates) { b.x += c[0]; b.y += c[1]; b.n++; } }
  const layer = L.layerGroup();
  for (const [z, b] of Object.entries(by)) L.marker([b.y / b.n, b.x / b.n], { interactive: false, icon: L.divIcon({ className: 'zone-label', iconSize: [200, 16], iconAnchor: [100, -14], html: esc(ZONES[z]) }) }).addTo(layer);
  const sync = () => map.getZoom() >= 13 ? layer.addTo(map) : map.removeLayer(layer);
  map.on('zoomend', sync); sync();
}

// ---------- trail status ----------
function renderStatusBar() {
  const bar = $('statusBar'), st = (status && status.overall && status.overall.state) || 'unknown';
  bar.className = 'status ' + st;
  const states = status ? Object.keys(ZONES).map(zoneState) : [];
  const mixed = new Set(states).size > 1;
  $('statusText').textContent = !status ? 'Trail status unavailable' : mixed ? 'Trails: mixed. Tap for details' : 'Trails ' + STATE_LABEL[st];
  let age = '';
  if (status && status.updated) {
    const d = (Date.now() - new Date(status.updated).getTime()) / 86400000;
    age = d < 1 ? 'updated today' : d < 2 ? 'updated yesterday' : 'updated ' + Math.floor(d) + ' days ago';
    if (d > 7 && st !== 'closed') age = '⚠ ' + age;
  }
  $('statusAge').textContent = age;
}
// website integration: when the app sits inside the club website (in its ride/ folder), the status the
// officers post in the website's assets/site-config.js is used, so there is one place to update.
// Anywhere else that file is missing and the app falls back to its own data/status.json.
function siteStatus() {
  const P = window.PBR; if (!P || !P.status) return null;
  const to = { open: 'open', limited: 'caution', closed: 'closed' }, zones = {};
  (P.areas || []).forEach(a => { if (a.zone) zones[a.zone] = { state: to[a.status] || 'unknown', note: '' }; });
  return { updated: P.status.updated + 'T12:00:00', overall: { state: to[P.status.overall] || 'unknown', message: P.status.note || '' }, zones,
    notices: ['Stay on marked trails. Most of this network crosses private land by permission.', 'Observe quiet zones near homes.', 'Signs and gates on the trail always win over this app.'] };
}
function loadSiteStatus() {
  return new Promise((ok, no) => { const s = document.createElement('script'); s.src = '../assets/site-config.js?t=' + Date.now();
    s.onload = () => { s.remove(); const st = siteStatus(); st ? ok(st) : no(new Error('no status')); }; s.onerror = () => { s.remove(); no(new Error('no site config')); };
    document.head.appendChild(s); });
}
function loadStatus() {
  return loadSiteStatus().catch(() => getJSON('data/status.json', { cache: 'no-store' })).then(s => { status = s; store.set('status', s); })
    .catch(() => { status = store.get('status', null); })
    .then(() => { renderStatusBar(); if (trails) drawTrails(); });
}

// ---------- GPS ----------
const gps = { on: false, follow: false, watch: null, last: null, lastT: 0, heading: null, wake: null };
const meIcon = L.divIcon({ className: '', iconSize: [44, 44], iconAnchor: [22, 22], html: '<div class="me"><div class="arrow" hidden></div><div class="dot"></div></div>' });
let meMarker = null, accCircle = null;

// simulated rider for demos and testing: add ?sim=1 to the address
function simWatch(cb) {
  const f = trails.features.slice().sort((a, b) => b.properties.km - a.properties.km)[0], c = f.geometry.coordinates;
  let i = 0, t = 0, off = 0, prev = null;
  const id = setInterval(() => {
    let lat, lon;
    if (i < c.length - 1) {
      const a = c[i], b = c[i + 1], d = haversine([a[1], a[0]], [b[1], b[0]]) || 1; t += 14 / d;
      if (t >= 1) { t = 0; i++; }
      const A = c[Math.min(i, c.length - 1)], B = c[Math.min(i + 1, c.length - 1)];
      lon = A[0] + (B[0] - A[0]) * t; lat = A[1] + (B[1] - A[1]) * t;
    } else { off += 14; lat = c[c.length - 1][1] + off / 110540; lon = c[c.length - 1][0] + off * .4 / KX; if (off > 400) { i = 0; off = 0; } }
    const here = [lat, lon], heading = prev ? (Math.atan2((lon - prev[1]) * KX, (lat - prev[0]) * KY) * 180 / Math.PI + 360) % 360 : null;
    prev = here;
    cb({ coords: { latitude: lat, longitude: lon, accuracy: 6, speed: 14, heading }, timestamp: Date.now() });
  }, 1000);
  return id;
}
async function wakeLock() {
  try { if ('wakeLock' in navigator && document.visibilityState === 'visible') gps.wake = await navigator.wakeLock.request('screen'); } catch (e) { /* not granted */ }
}
document.addEventListener('visibilitychange', () => { if (gps.on && document.visibilityState === 'visible') wakeLock(); });

function startGPS() {
  if (gps.on) return;
  if (params.get('sim')) { gps.on = true; gps.sim = simWatch(onFix); }
  else {
    if (!('geolocation' in navigator)) { toast('This device does not provide GPS to the browser.'); return; }
    gps.on = true;
    gps.watch = navigator.geolocation.watchPosition(onFix, onGpsError, { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
  }
  wakeLock(); $('hud').hidden = false; document.body.classList.add('gps'); toast('Finding your location…', 2000);
}
function onGpsError(e) {
  if (e.code === 1) { toast('Location permission was denied. Allow location for this site in your phone settings.', 6000); stopGPS(); }
  else toast('Waiting for a GPS signal…', 2500);
}
function stopGPS() {
  if (gps.watch != null) navigator.geolocation.clearWatch(gps.watch);
  if (gps.sim) clearInterval(gps.sim);
  gps.on = false; gps.follow = false; gps.watch = gps.sim = null; $('btnLocate').classList.remove('on'); document.body.classList.remove('gps');
}
function onFix(pos) {
  const c = pos.coords, ll = [c.latitude, c.longitude];
  const fix = { lat: c.latitude, lon: c.longitude, acc: c.accuracy || 0, speed: (c.speed != null && c.speed >= 0) ? c.speed : null, t: pos.timestamp || Date.now() };
  if (fix.speed == null && gps.last) { const dt = (fix.t - gps.last.t) / 1000; if (dt > 0.5) fix.speed = haversine([gps.last.lat, gps.last.lon], ll) / dt; }
  if (c.heading != null && !isNaN(c.heading) && (fix.speed || 0) > 1) gps.heading = c.heading;
  gps.last = fix;
  if (!meMarker) { meMarker = L.marker(ll, { icon: meIcon, interactive: false, zIndexOffset: 1000 }).addTo(map); accCircle = L.circle(ll, { radius: fix.acc, color: '#1a73ff', weight: 1, fillOpacity: .12, interactive: false }).addTo(map); }
  meMarker.setLatLng(ll); accCircle.setLatLng(ll).setRadius(fix.acc);
  const el = meMarker.getElement();
  if (el) { const ar = el.querySelector('.arrow'); ar.hidden = gps.heading == null; if (gps.heading != null) ar.style.transform = `rotate(${gps.heading}deg)`; el.querySelector('.me').classList.remove('stale'); }
  if (gps.follow) { if (map.getZoom() < 14) map.setView(ll, 16, { animate: false }); else map.panTo(ll, { animate: true, duration: 0.5 }); }
  // HUD
  $('hudSpeed').textContent = Math.round((fix.speed || 0) * MS2MPH);
  $('hudAcc').textContent = Math.round(fix.acc * M2FT);
  const near = nearestTrail(fix.lat, fix.lon);
  const cell = $('hudTrail').parentElement;
  if (near) {
    const on = near.dist <= CFG.onTrailM + Math.min(fix.acc, 30);
    $('hudTrail').textContent = on ? 'ON' : near.dist === Infinity ? '500+' : fmtFt(near.dist).replace(' ft', '');
    $('hudTrailLbl').textContent = on ? 'on trail' : near.dist === Infinity || near.dist < 1609 ? 'ft to trail' : 'to trail';
    cell.classList.toggle('ok', on); cell.classList.toggle('warn', !on);
    checkOffTrail(fix, near, on);
  }
  recordFix(fix);
  if (H.fix) H.fix(fix);
}
setInterval(() => { // grey the dot if fixes stop arriving
  if (meMarker && gps.last && Date.now() - gps.last.t > 15000) { const el = meMarker.getElement(); if (el) el.querySelector('.me').classList.add('stale'); }
}, 5000);
map.on('dragstart', () => { if (gps.follow) { gps.follow = false; $('btnLocate').classList.remove('on'); } });
$('btnLocate').onclick = () => {
  if (!gps.on) startGPS();
  if (!gps.on) return;
  gps.follow = true; $('btnLocate').classList.add('on');
  if (gps.last) map.setView([gps.last.lat, gps.last.lon], Math.max(map.getZoom(), 16), { animate: false });
};

// ---------- off-trail warning ----------
const ot = { enabled: store.get('offTrail', true), lastOn: 0, offSince: 0, alarm: false, mutedUntil: 0, audio: null };
function beep() {
  try {
    ot.audio = ot.audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = ot.audio.createOscillator(), g = ot.audio.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(ot.audio.destination);
    g.gain.setValueAtTime(.25, ot.audio.currentTime); g.gain.exponentialRampToValueAtTime(.001, ot.audio.currentTime + .5);
    o.start(); o.stop(ot.audio.currentTime + .5);
  } catch (e) { /* no audio */ }
}
function checkOffTrail(fix, near, on) {
  const now = fix.t;
  if (on) { ot.lastOn = now; ot.offSince = 0; if (ot.alarm) { ot.alarm = false; $('alert').hidden = true; toast('Back on the trail'); } return; }
  if (!ot.enabled || fix.acc > CFG.maxAccM) return;
  const limit = near.feature && near.feature.properties.acc === 'approx' ? CFG.offTrailApproxM : CFG.offTrailM;
  const wasRiding = ot.lastOn && now - ot.lastOn < 10 * 60000;      // only warn someone who was just on a trail
  if (near.dist > limit && wasRiding) {
    if (!ot.offSince) ot.offSince = now;
    if (now - ot.offSince >= 4000 && now > ot.mutedUntil) {
      $('alertDist').textContent = near.dist === Infinity ? 'more than 500 ft from the trail' : fmtFt(near.dist) + ' from the trail';
      if (!ot.alarm) { ot.alarm = true; $('alert').hidden = false; }
      if (!ot.lastBuzz || now - ot.lastBuzz > 5000) { ot.lastBuzz = now; if (navigator.vibrate) navigator.vibrate([400, 150, 400]); beep(); }
    }
  } else ot.offSince = 0;
}
$('alertMute').onclick = () => { ot.mutedUntil = Date.now() + 5 * 60000; ot.alarm = false; $('alert').hidden = true; toast('Off-trail warning silenced for 5 minutes'); };

// ---------- ride recording (IndexedDB) ----------
const db = {
  open() { return this.p || (this.p = new Promise((res, rej) => { const r = indexedDB.open('pst', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('rides', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); })); },
  tx(mode, fn) { return this.open().then(d => new Promise((res, rej) => { const t = d.transaction('rides', mode), rq = fn(t.objectStore('rides')); t.oncomplete = () => res(rq && rq.result); t.onerror = () => rej(t.error); })); },
  put(r) { return this.tx('readwrite', s => s.put(r)); }, del(id) { return this.tx('readwrite', s => s.delete(id)); },
  all() { return this.tx('readonly', s => s.getAll()).then(a => (a || []).sort((x, y) => y.id - x.id)); },
};
const rec = { ride: null, line: null, lastSave: 0 };
function startRecording() {
  if (!gps.on) startGPS();
  if (!gps.on) return;
  rec.ride = { id: Date.now(), start: Date.now(), end: null, dist: 0, moving: 0, max: 0, pts: [], done: false };
  rec.line = L.polyline([], { color: '#1a73ff', weight: 5, opacity: .9 }).addTo(map);
  document.body.classList.add('recording'); $('btnRecord').querySelector('.lbl').textContent = 'Stop';
  $('hudDist').textContent = '0.0'; toast('Recording. Keep this screen on while you ride.', 4000);
}
function recordFix(fix) {
  const r = rec.ride; if (!r || fix.acc > CFG.maxAccM) return;
  const last = r.pts[r.pts.length - 1];
  if (last) {
    const d = haversine([last[0], last[1]], [fix.lat, fix.lon]), dt = (fix.t - last[2]) / 1000;
    if (d < 5) return;                              // standing still / GPS jitter
    if (dt > 0 && d / dt < 60) { r.dist += d; if (dt < 30) r.moving += dt; r.max = Math.max(r.max, Math.min(fix.speed != null ? fix.speed : d / dt, 60)); }
  }
  r.pts.push([+fix.lat.toFixed(6), +fix.lon.toFixed(6), fix.t]); rec.line.addLatLng([fix.lat, fix.lon]);
  $('hudDist').textContent = (r.dist * M2MI).toFixed(1);
  if (Date.now() - rec.lastSave > 15000) { rec.lastSave = Date.now(); db.put(r).catch(() => {}); }   // checkpoint so a closed tab loses little
}
function stopRecording() {
  const r = rec.ride; if (!r) return;
  r.end = Date.now(); r.done = true; rec.ride = null;
  document.body.classList.remove('recording'); $('btnRecord').querySelector('.lbl').textContent = 'Record';
  if (rec.line) { map.removeLayer(rec.line); rec.line = null; }
  if (r.pts.length < 2) { db.del(r.id).catch(() => {}); toast('Nothing recorded. No GPS movement was picked up.'); return; }
  db.put(r).then(() => { toast('Ride saved: ' + (r.dist * M2MI).toFixed(1) + ' miles'); openRides(); }).catch(() => toast('Could not save the ride on this device.'));
}
$('btnRecord').onclick = () => rec.ride ? stopRecording() : startRecording();
function gpx(r) {
  const pts = r.pts.map(p => `<trkpt lat="${p[0]}" lon="${p[1]}"><time>${new Date(p[2]).toISOString()}</time></trkpt>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Pelham Sled Trails" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Ride ${new Date(r.start).toISOString().slice(0, 16)}</name><trkseg>${pts}</trkseg></trk></gpx>`;
}
async function exportRide(r) {
  const name = 'ride-' + new Date(r.start).toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.gpx';
  const file = new File([gpx(r)], name, { type: 'application/gpx+xml' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; } } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
let shownRide = null;
function showRide(r) {
  if (shownRide) map.removeLayer(shownRide);
  shownRide = L.polyline(r.pts.map(p => [p[0], p[1]]), { color: '#1a73ff', weight: 5, opacity: .9 }).addTo(map);
  map.fitBounds(shownRide.getBounds(), { padding: [40, 40] }); closeSheet(); toast('Showing saved ride. Open Menu › My rides to clear it.', 4000);
}

// ---------- sheets ----------
function openSheet(title, html) { $('sheetTitle').textContent = title; $('sheetBody').innerHTML = html; $('sheet').hidden = false; $('sheetBody').scrollTop = 0; }
function closeSheet() { $('sheet').hidden = true; }
$('sheetClose').onclick = closeSheet;
const on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };

function openMenu() {
  openSheet('Menu', `
    <h3>Map</h3>
    <div class="row2">
      <button class="big ${baseName === 'topo' ? 'active' : ''}" id="mTopo">Street / terrain</button>
      <button class="big ${baseName === 'sat' ? 'active' : ''}" id="mSat">Satellite</button>
    </div>
    <button class="big" id="mNight"><span class="grow">Night mode<small>Dims the screen colours for riding after dark</small></span><span class="tag">${document.body.classList.contains('night') ? 'ON' : 'OFF'}</span></button>
    <button class="big" id="mOff"><span class="grow">Off-trail warning<small>Alarm when you drift away from the mapped trail</small></span><span class="tag">${ot.enabled ? 'ON' : 'OFF'}</span></button>
    <h3>Trails</h3>
    <button class="big" id="mWork"><span class="grow">Trail work spots<small>Pin a spot that needs maintenance, see what others reported</small></span><span class="tag">${allSpots().filter(s => !s.fixed).length} open</span></button>
    <button class="big" id="mStatus"><span class="grow">Trail status and closures</span><span>›</span></button>
    <button class="big" id="mRides"><span class="grow">My rides<small>Saved recordings, export as GPX</small></span><span>›</span></button>
    <button class="big" id="mOffline"><span class="grow">Offline maps<small>Download before you leave cell coverage</small></span><span>›</span></button>
    ${H.menuHtml ? H.menuHtml() : ''}
    <h3>Info</h3>
    <button class="big" id="mLegend"><span class="grow">Map legend</span><span>›</span></button>
    <button class="big" id="mAbout"><span class="grow">About, safety and data sources</span><span>›</span></button>
    ${gps.on ? '<button class="big" id="mGpsOff"><span class="grow">Turn GPS off<small>Saves battery when you are stopped</small></span></button>' : ''}`);
  on('mTopo', () => { setBase('topo'); openMenu(); }); on('mSat', () => { setBase('sat'); openMenu(); });
  on('mNight', () => { setNight(!document.body.classList.contains('night')); openMenu(); });
  on('mOff', () => { ot.enabled = !ot.enabled; store.set('offTrail', ot.enabled); if (!ot.enabled) { ot.alarm = false; $('alert').hidden = true; } openMenu(); });
  if (H.menuWire) H.menuWire();
  on('mWork', openWork); on('mStatus', openStatus); on('mRides', openRides); on('mOffline', openOffline); on('mLegend', openLegend); on('mAbout', openAbout);
  on('mGpsOff', () => { if (rec.ride) stopRecording(); stopGPS(); $('hud').hidden = true; closeSheet(); toast('GPS off'); });
}
$('btnMenu').onclick = openMenu;

function openStatus() {
  const s = status;
  if (!s) { openSheet('Trail status', '<p>No trail status is available yet. Connect to the internet once to load it.</p>'); return; }
  const when = s.updated ? new Date(s.updated).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'unknown';
  const zones = Object.keys(ZONES).map(z => { const st = zoneState(z), zn = (s.zones && s.zones[z]) || {};
    return `<button class="big" data-zone="${z}"><span class="grow">${esc(ZONES[z])}${zn.note ? `<small>${esc(zn.note)}</small>` : ''}</span><span class="tag ${st}">${STATE_LABEL[st]}</span></button>`; }).join('');
  openSheet('Trail status', `
    <div class="card"><span class="tag ${esc(s.overall.state)}" style="display:inline-block;padding:4px 12px;border-radius:999px;font-weight:700">${STATE_LABEL[s.overall.state] || 'UNKNOWN'}</span>
      <p>${esc(s.overall.message || '')}</p><p class="muted">Last updated ${esc(when)}${s.updatedBy ? ' by ' + esc(s.updatedBy) : ''}.</p></div>
    <h3>By area</h3>${zones}
    ${(s.notices || []).length ? '<h3>Notices</h3><div class="card"><ul>' + s.notices.map(n => `<li>${esc(n)}</li>`).join('') + '</ul></div>' : ''}
    <p class="muted">This app is unofficial. Status here is entered by the app's maintainer and can lag. Signs on the trail and the
      <a href="../#conditions">Pelham Border Riders' trail conditions page</a> always win.</p>
    <button class="big" id="sRefresh">Check for a newer status</button>`);
  document.querySelectorAll('[data-zone]').forEach(b => b.onclick = () => {
    const pts = []; for (const f of trails.features) if (f.properties.zone === b.dataset.zone) for (const c of f.geometry.coordinates) pts.push([c[1], c[0]]);
    if (pts.length) { map.fitBounds(L.latLngBounds(pts), { padding: [30, 30] }); closeSheet(); }
  });
  on('sRefresh', () => loadStatus().then(() => { openStatus(); toast(navigator.onLine ? 'Status is up to date' : 'Offline. Showing the last saved status.'); }));
}
$('statusBar').onclick = openStatus;

function openSOS() {
  const f = gps.last, fresh = f && Date.now() - f.t < 60000;
  if (!gps.on) startGPS();
  if (!f) { openSheet('Share my location', `<div class="card"><p><b>Getting your location…</b></p><p class="muted">Stand in the open if you can. This screen updates when GPS locks on.</p></div>
    <a class="big danger" href="tel:911"><span class="grow">Call 911<small>For any emergency, call first</small></span></a>`);
    const t = setInterval(() => { if ($('sheet').hidden || $('sheetTitle').textContent !== 'Share my location') return clearInterval(t); if (gps.last) { clearInterval(t); openSOS(); } }, 1000); return; }
  const lat = f.lat.toFixed(5), lon = f.lon.toFixed(5), time = new Date(f.t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const link = `https://maps.google.com/?q=${lat},${lon}`;
  const msg = `I'm on the snowmobile trails in Pelham NH and need help. My GPS location at ${time}: ${lat}, ${lon} (within ${Math.round(f.acc * M2FT)} ft). Map: ${link}`;
  const sms = (/iPhone|iPad|iPod/.test(navigator.userAgent) ? 'sms:&body=' : 'sms:?body=') + encodeURIComponent(msg);
  openSheet('Share my location', `
    <div class="card"><div class="muted">Your GPS position${fresh ? '' : ' (last known, ' + time + ')'}</div>
      <div class="coords">${lat}, ${lon}</div><div class="muted">Accurate to about ${Math.round(f.acc * M2FT)} ft · read these numbers to a 911 dispatcher</div></div>
    <a class="big danger" href="tel:911"><span class="grow">Call 911<small>For any emergency, call first</small></span></a>
    <a class="big primary" href="${sms}"><span class="grow">Text my location<small>Opens a text message with your coordinates. You pick who gets it.</small></span></a>
    ${navigator.share ? '<button class="big" id="sosShare"><span class="grow">Share another way<small>Messenger, WhatsApp, email…</small></span></button>' : ''}
    <button class="big" id="sosCopy"><span class="grow">Copy coordinates</span></button>
    <p class="muted">Texts and calls need cell signal. If you have none, move to higher or open ground. GPS itself works without signal.</p>`);
  on('sosShare', () => navigator.share({ text: msg }).catch(() => {}));
  on('sosCopy', () => { (navigator.clipboard ? navigator.clipboard.writeText(`${lat}, ${lon}`) : Promise.reject()).then(() => toast('Coordinates copied'), () => toast('Could not copy. Press and hold the numbers instead.')); });
}
$('btnSOS').onclick = openSOS;

function openRides() {
  db.all().then(rides => {
    rides = rides.filter(r => r.done);
    const html = rides.length ? rides.map(r => { const mph = r.moving ? r.dist / r.moving * MS2MPH : 0;
      return `<div class="card"><b>${new Date(r.start).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</b>
        <div class="stats"><div><b>${(r.dist * M2MI).toFixed(1)}</b><small>miles</small></div><div><b>${fmtDur(r.moving)}</b><small>moving</small></div><div><b>${mph.toFixed(0)}</b><small>avg mph</small></div><div><b>${(r.max * MS2MPH).toFixed(0)}</b><small>top mph</small></div></div>
        <div class="row2" style="margin-top:10px"><button class="big" data-show="${r.id}">Show on map</button><button class="big" data-gpx="${r.id}">Export GPX</button></div>
        <button class="big" data-del="${r.id}" style="justify-content:center;min-height:48px;margin-bottom:0">Delete</button></div>`; }).join('')
      : '<p>No rides saved yet. Tap <b>Record</b> on the map to start one.</p>';
    openSheet('My rides', html + (shownRide ? '<button class="big" id="rClear">Clear the ride shown on the map</button>' : '') +
      `<p class="muted">Rides are stored only on this phone. A web app can record only while it is open with the screen on, so a locked phone leaves gaps.
      Exported GPX files can also be used to correct this app's trail lines.</p>`);
    const find = id => rides.find(r => String(r.id) === id);
    document.querySelectorAll('[data-show]').forEach(b => b.onclick = () => showRide(find(b.dataset.show)));
    document.querySelectorAll('[data-gpx]').forEach(b => b.onclick = () => exportRide(find(b.dataset.gpx)));
    document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { if (b.dataset.sure) db.del(+b.dataset.del).then(openRides); else { b.dataset.sure = 1; b.textContent = 'Tap again to delete for good'; } });
    on('rClear', () => { map.removeLayer(shownRide); shownRide = null; openRides(); });
  }).catch(() => openSheet('My rides', '<p>Ride storage is not available in this browser (private browsing blocks it).</p>'));
}

// ---------- trail work spots (maintenance pins) ----------
// Kept on the phone; passed between people as links; the maintainer can also publish a shared list (data/worksites.json).
const WORK_TYPES = { tree: 'Downed tree', brush: 'Brush / limbs to cut', washout: 'Washout or ruts', water: 'Water / wet crossing', bridge: 'Bridge or culvert', sign: 'Sign missing or damaged', gate: 'Gate or fence', other: 'Other' };
const work = { mine: store.get('spots', []), posted: [], shared: [], layer: L.layerGroup().addTo(map), markers: {} };
const spotId = s => `${(+s.lat).toFixed(5)},${(+s.lon).toFixed(5)},${s.d || 0}`;
const allSpots = () => { const seen = new Set(), out = []; for (const s of [...work.shared, ...work.mine, ...work.posted]) { const id = spotId(s); if (!seen.has(id)) { seen.add(id); out.push(s); } } return out; };
const saveSpots = () => store.set('spots', work.mine);
const spotLink = s => { const u = new URL(location.href); u.search = ''; u.hash = '';
  u.searchParams.set('spot', `${(+s.lat).toFixed(5)},${(+s.lon).toFixed(5)}`); u.searchParams.set('t', s.type); if (s.note) u.searchParams.set('n', s.note); if (s.by) u.searchParams.set('by', s.by); u.searchParams.set('d', s.d); return u.toString(); };
const spotText = s => `${WORK_TYPES[s.type] || 'Trail work'} on the Pelham trails${s.note ? ': ' + s.note : ''}. Location ${(+s.lat).toFixed(5)}, ${(+s.lon).toFixed(5)}.`;
function shareText(text, url) {
  if (navigator.share) return navigator.share(url ? { text, url } : { text }).catch(() => {});
  const full = url ? text + ' ' + url : text;
  return (navigator.clipboard ? navigator.clipboard.writeText(full) : Promise.reject()).then(() => toast('Copied. Paste it into a text or email.'), () => toast('Sharing is not available in this browser.'));
}
function spotPopup(s) {
  const id = spotId(s), mine = work.mine.some(m => spotId(m) === id), dist = gps.last ? fmtFt(haversine([gps.last.lat, gps.last.lon], [s.lat, s.lon])) + ' from you · ' : '';
  return `<b>${s.fixed ? '✓ Fixed: ' : ''}${esc(WORK_TYPES[s.type] || 'Trail work')}</b><br>${esc(s.note || 'No details given.')}<br>` +
    `<small>${dist}Reported ${s.d ? new Date(+s.d).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}${s.by ? ' by ' + esc(s.by) : ''}<br>${(+s.lat).toFixed(5)}, ${(+s.lon).toFixed(5)}</small>` +
    `<div class="spot-actions"><button data-act="help" data-id="${id}">I can help</button><button data-act="share" data-id="${id}">Share spot</button>` +
    `<a href="https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}" target="_blank" rel="noopener">Directions</a>` +
    (mine ? `<button data-act="fixed" data-id="${id}">${s.fixed ? 'Not fixed yet' : 'Mark fixed'}</button><button data-act="remove" data-id="${id}">Remove</button>` : '') + `</div>` + (H.spotExtras ? H.spotExtras(s) : '');
}
function drawSpots() {
  work.layer.clearLayers(); work.markers = {};
  for (const s of allSpots()) {
    const m = L.marker([s.lat, s.lon], { zIndexOffset: 500, title: WORK_TYPES[s.type] || 'Trail work',
      icon: L.divIcon({ className: '', iconSize: [38, 38], iconAnchor: [19, 19], html: `<div class="poi work${s.fixed ? ' fixed' : ''}">${s.fixed ? '✓' : '🔧'}</div>` }) })
      .bindPopup(() => spotPopup(s), { maxWidth: 280, minWidth: 230 }).addTo(work.layer);
    work.markers[spotId(s)] = m;
  }
}
map.on('popupopen', e => {
  e.popup.getElement().querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
    const s = allSpots().find(x => spotId(x) === b.dataset.id); if (!s) return;
    const act = b.dataset.act;
    if (act === 'share') shareText('Trail work needed. ' + spotText(s) + ' Open it on the map:', spotLink(s));
    else if (act === 'help') { const me = store.get('name', ''); shareText(`${me ? me + ' here. ' : ''}I can help with this one. ${spotText(s)}`, spotLink(s)); }
    else if (act === 'fixed') { s.fixed = !s.fixed; saveSpots(); drawSpots(); map.closePopup(); toast(s.fixed ? 'Marked as fixed' : 'Marked as still needing work'); }
    else if (act === 'remove') { if (b.dataset.sure) { work.mine = work.mine.filter(x => spotId(x) !== b.dataset.id); saveSpots(); drawSpots(); map.closePopup(); } else { b.dataset.sure = 1; b.textContent = 'Tap again to remove'; } }
  });
});
function focusSpot(s) { closeSheet(); map.setView([s.lat, s.lon], Math.max(map.getZoom(), 16)); const m = work.markers[spotId(s)]; if (m) m.openPopup(); }
function openReport(at) {
  const here = gps.last && Date.now() - gps.last.t < 30000 ? { lat: gps.last.lat, lon: gps.last.lon, acc: gps.last.acc } : null;
  const c = map.getCenter(), pick = at || (here ? null : { lat: c.lat, lon: c.lng });
  let loc = pick || here, type = 'tree';
  openSheet('Report trail work', `
    <h3>Where</h3>
    <div class="card" id="rwWhere"></div>
    ${pick && here ? '<button class="big" id="rwUseGps">Use my GPS position instead</button>' : ''}
    <h3>What needs doing</h3>
    <div class="row2" id="rwTypes">${Object.entries(WORK_TYPES).map(([k, v]) => `<button class="big ${k === type ? 'active' : ''}" data-type="${k}">${esc(v)}</button>`).join('')}</div>
    <h3>Details</h3>
    <textarea id="rwNote" class="field" rows="3" maxlength="240" placeholder="e.g. 14-inch oak across the trail, needs a chainsaw and two people"></textarea>
    <input id="rwBy" class="field" maxlength="40" placeholder="Your name (optional)" value="${esc(store.get('name', ''))}">
    ${H.member && H.member() ? '<label class="big" for="rwPhoto"><span class="grow">Add a photo<small id="rwPhotoTxt">Optional. Helps the crew see the job.</small></span><span>📷</span></label><input id="rwPhoto" type="file" accept="image/*" hidden>' : ''}
    <button class="big primary" id="rwSave" style="justify-content:center">${H.member && H.member() ? 'Post to members' : 'Save and share'}</button>
    ${H.member && H.member() ? '' : '<button class="big" id="rwSaveOnly" style="justify-content:center">Save without sharing</button>'}
    <p class="muted">${H.member && H.member() ? 'Every signed-in member sees the pin on their map right away and can plan a work party for it.' : 'The pin is saved on your phone. Sharing sends a link by text, email or your group chat; anyone who opens it gets the pin on their own map and can reply to offer help. Sign in as a member (Menu) to post pins to a shared board instead.'}</p>`);
  if ($('rwPhoto')) $('rwPhoto').onchange = () => { $('rwPhotoTxt').textContent = $('rwPhoto').files.length ? 'Photo added' : 'Optional. Helps the crew see the job.'; };
  const where = () => { $('rwWhere').innerHTML = `<b>${loc === here ? 'Your GPS position' : at ? 'The spot you pressed on the map' : 'The centre of the map'}</b><br><span class="muted">${loc.lat.toFixed(5)}, ${loc.lon.toFixed(5)}${loc === here ? ' · within ' + Math.round(here.acc * M2FT) + ' ft' : ''}${!at && loc !== here ? '<br>GPS is off. Close this, move the map so the spot is in the middle, or press and hold on the exact spot.' : ''}</span>`; };
  where();
  on('rwUseGps', () => { loc = here; where(); });
  document.querySelectorAll('#rwTypes [data-type]').forEach(b => b.onclick = () => { type = b.dataset.type; document.querySelectorAll('#rwTypes .big').forEach(x => x.classList.toggle('active', x === b)); });
  const save = share => {
    const s = { lat: +loc.lat.toFixed(5), lon: +loc.lon.toFixed(5), type, note: $('rwNote').value.trim(), by: $('rwBy').value.trim(), d: Date.now(), src: 'mine' };
    store.set('name', s.by);
    if (H.spotSaved && H.spotSaved(s, $('rwPhoto') && $('rwPhoto').files[0])) { closeSheet(); return; } work.mine.unshift(s); saveSpots(); drawSpots(); focusSpot(s);
    if (share) shareText('Trail work needed. ' + spotText(s) + ' Open it on the map:', spotLink(s)); else toast('Work spot saved');
  };
  on('rwSave', () => save(true)); on('rwSaveOnly', () => save(false));
}
map.on('contextmenu', e => openReport({ lat: e.latlng.lat, lon: e.latlng.lng }));   // press and hold on the map
function openWork() {
  const spots = allSpots().sort((a, b) => (a.fixed ? 1 : 0) - (b.fixed ? 1 : 0) || b.d - a.d);
  const dist = s => gps.last ? fmtFt(haversine([gps.last.lat, gps.last.lon], [s.lat, s.lon])) + ' away · ' : '';
  openSheet('Trail work spots', `
    <button class="big primary" id="wNew"><span class="grow">Report trail work needed<small>Pins your current GPS position</small></span><span>＋</span></button>
    <h3>${spots.length ? spots.filter(s => !s.fixed).length + ' open' : 'Nothing reported'}</h3>
    ${spots.map((s, i) => `<button class="big" data-spot="${i}"><span class="grow">${esc(WORK_TYPES[s.type] || 'Trail work')}<small>${esc(s.note || 'No details')}<br>${dist(s)}${s.d ? new Date(+s.d).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}${s.by ? ' · ' + esc(s.by) : ''}</small></span><span class="tag ${s.fixed ? 'open' : 'caution'}">${s.fixed ? 'FIXED' : 'OPEN'}</span></button>`).join('')}
    <p class="muted">You can also press and hold anywhere on the map to drop a pin there. Pins live on each person's phone and travel as shared links, so send new ones to your work-party group.</p>`);
  on('wNew', () => openReport());
  document.querySelectorAll('[data-spot]').forEach(b => b.onclick = () => focusSpot(spots[+b.dataset.spot]));
}
function loadPostedSpots() {
  return getJSON('data/worksites.json', { cache: 'no-store' }).then(w => { work.posted = (w.spots || []).map(s => ({ ...s, src: 'posted' })); store.set('posted', work.posted); })
    .catch(() => { work.posted = store.get('posted', []); }).then(drawSpots);
}
function importSpotFromLink() {
  const sp = params.get('spot'); if (!sp) return;
  const [lat, lon] = sp.split(',').map(Number);
  if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
  const s = { lat, lon, type: WORK_TYPES[params.get('t')] ? params.get('t') : 'other', note: (params.get('n') || '').slice(0, 240), by: (params.get('by') || '').slice(0, 40), d: +params.get('d') || Date.now(), src: 'shared' };
  if (!allSpots().some(x => spotId(x) === spotId(s))) { work.mine.unshift(s); saveSpots(); }
  drawSpots(); history.replaceState(null, '', location.pathname);
  setTimeout(() => { if ($('sheet').hidden) { focusSpot(s); toast('Work spot added to your map'); } else { const t = setInterval(() => { if ($('sheet').hidden) { clearInterval(t); focusSpot(s); } }, 500); } }, 600);
}

// ---------- offline maps ----------
function tileList(kind) {
  const out = [], b = CFG.offlineBox;
  for (const z of CFG.offlineZooms) {
    const n = 2 ** z, x = lon => Math.floor((lon + 180) / 360 * n), y = lat => Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
    for (let tx = x(b.w); tx <= x(b.e); tx++) for (let ty = y(b.n); ty <= y(b.s); ty++) out.push(CFG.tiles[kind].replace('{z}', z).replace('{y}', ty).replace('{x}', tx));
  }
  return out;
}
const dl = { running: false, cancel: false };
async function cachedCount(kind) { try { const c = await caches.open(CFG.tileCache), keys = await c.keys(), pre = CFG.tiles[kind].split('{z}')[0]; return keys.filter(k => k.url.startsWith(pre)).length; } catch (e) { return 0; } }
async function download(kind) {
  if (dl.running) return; dl.running = true; dl.cancel = false;
  const urls = tileList(kind), cache = await caches.open(CFG.tileCache);
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  let done = 0, failed = 0; const bar = $('dlBar'), txt = $('dlTxt');
  const next = async () => { while (urls.length && !dl.cancel) { const u = urls.pop();
    try { if (!(await cache.match(u))) { const r = await fetch(u, { mode: 'cors' }); if (r.ok) await cache.put(u, r); else failed++; } } catch (e) { failed++; }
    done++; if (bar && document.body.contains(bar)) { bar.value = done; txt.textContent = `${done} of ${bar.max} map pieces`; } } };
  if (bar) { bar.max = urls.length; bar.hidden = false; }
  await Promise.all(Array.from({ length: 6 }, next));
  dl.running = false; store.set('offline.' + kind, Date.now());
  toast(dl.cancel ? 'Download stopped' : failed ? `Done, but ${failed} pieces failed. Tap download again to retry them.` : 'Offline map saved', 5000);
  if (!$('sheet').hidden && $('sheetTitle').textContent === 'Offline maps') openOffline();
}
async function openOffline() {
  if (!('caches' in window)) { openSheet('Offline maps', '<p>This browser cannot store maps for offline use. Open the app over https in Safari or Chrome.</p>'); return; }
  const nT = tileList('topo').length, nS = tileList('sat').length, [cT, cS] = await Promise.all([cachedCount('topo'), cachedCount('sat')]);
  let usage = ''; try { const e = await navigator.storage.estimate(); usage = `Using ${(e.usage / 1048576).toFixed(0)} MB on this phone.`; } catch (e) { /* unsupported */ }
  const row = (kind, label, n, c, mb) => `<button class="big ${c >= n ? 'active' : ''}" data-dl="${kind}"><span class="grow">${label}<small>${c >= n ? 'Saved on this phone' : c ? `${Math.round(c / n * 100)}% saved. Tap to finish.` : `About ${mb} MB. Use Wi-Fi.`}</small></span><span class="tag">${c >= n ? '✓' : 'Download'}</span></button>`;
  openSheet('Offline maps', `
    <p>The trail lines, parking spots and last known trail status are always saved on your phone. Download the background map too so it still shows where there is no signal.</p>
    ${row('topo', 'Street / terrain map', nT, cT, 20)}${row('sat', 'Satellite photos', nS, cS, 35)}
    <progress id="dlBar" value="0" max="1" hidden></progress><p id="dlTxt" class="muted"></p>
    ${dl.running ? '<button class="big" id="dlStop">Stop download</button>' : ''}
    <p class="muted">Covers all of Pelham plus about a mile into Hudson, Windham, Salem, Dracut and Methuen, down to trail-level zoom. ${usage}</p>
    <button class="big" id="dlClear" style="min-height:48px">Remove downloaded maps</button>`);
  document.querySelectorAll('[data-dl]').forEach(b => b.onclick = () => { if (!navigator.onLine) return toast('You are offline. Connect to Wi-Fi to download.'); download(b.dataset.dl); toast('Downloading. Keep this screen open.'); });
  on('dlStop', () => { dl.cancel = true; });
  on('dlClear', () => caches.delete(CFG.tileCache).then(() => { toast('Downloaded maps removed'); openOffline(); }));
}

function openLegend() {
  openSheet('Map legend', `
    <div class="card"><div class="legend">
      <span><i style="border-color:${STATE_COLOR.open}"></i>Open</span><span><i style="border-color:${STATE_COLOR.caution}"></i>Caution</span>
      <span><i style="border-color:${STATE_COLOR.closed}"></i>Closed</span><span><i style="border-color:${STATE_COLOR.unknown}"></i>Status unknown</span></div></div>
    <div class="card"><div class="legend"><span><i style="border-color:#888"></i>Line follows a mapped path</span><span><i class="dash" style="border-color:#888"></i>Approximate, traced from a picture</span>
      <span><i class="dash" style="border-color:#00c2ff"></i>Pond crossing (ice)</span><span><i class="dash" style="border-color:#5b2a86;border-top-width:2px"></i>Pelham town line</span></div></div>
    <div class="card"><p><span class="poi parking" style="display:inline-flex;vertical-align:middle">P</span> Parking or trailer drop &nbsp;
      <span class="poi parking x" style="display:inline-flex;vertical-align:middle">P</span> Parking crossed out on the 2022 map</p>
      <p><span class="poi work" style="display:inline-flex;vertical-align:middle">🔧</span> Work needed &nbsp; <span class="poi party" style="display:inline-flex;vertical-align:middle">📅</span> Work party &nbsp; <span class="rider" style="display:inline-flex;vertical-align:middle">AB</span> Member riding</p>
      <p><span class="poi hazard" style="display:inline-flex;vertical-align:middle">!</span> Caution point &nbsp; <span class="me" style="display:inline-block;vertical-align:middle"><span class="dot"></span></span> You</p></div>
    <p class="muted">Tap any trail, P or ! on the map for details.</p>`);
}
function openAbout() {
  const miles = trails ? (trails.features.reduce((s, f) => s + f.properties.km, 0) * 0.6214).toFixed(0) : '?';
  openSheet('About and safety', `
    <div class="card"><b>This is an unofficial app.</b>
      <p>It is not made by, endorsed by or connected to the Pelham Border Riders, the NH Snowmobile Association or the Town of Pelham.</p></div>
    <h3>Ride safe and legal</h3>
    <div class="card"><ul>
      <li>Ride only on trails that are signed and open. Most of this network crosses private land by the landowners' permission.</li>
      <li>Trail signs and the club's postings always win over this map.</li>
      <li>Never cross a pond unless you know the ice is safe.</li>
      <li>Your sled must be registered. Keep right, watch for groomers, respect quiet zones.</li>
      <li>Do not work the phone while moving.</li></ul></div>
    <h3>How accurate is it?</h3>
    <div class="card"><p>The ${miles} miles of trail shown were traced from the picture map on the Pelham Border Riders' website (dated 2022) and lined up with paths in OpenStreetMap.
      Solid lines follow a mapped path and are usually within 30 ft. Dashed lines are approximate and can be 100 ft or more off. Trails may have been rerouted or closed since 2022, and trails into neighbouring towns are not yet included.</p>
      <p>Your blue dot comes from your phone's GPS and is typically good to 15–30 ft in the open, worse under heavy tree cover.</p></div>
    <h3>Support the people who make the trails</h3>
    <a class="big" href="../"><span class="grow">Pelham Border Riders<small>Join the club, see official conditions</small></span><span>↗</span></a>
    <a class="big" href="https://slednh.evtrails.com/" target="_blank" rel="noopener"><span class="grow">SledNH statewide trail map<small>The NH Snowmobile Association's official map</small></span><span>↗</span></a>
    <h3>Data sources</h3>
    <p class="muted">Trail geometry © OpenStreetMap contributors, available under the Open Database License. Base maps and imagery: U.S. Geological Survey, The National Map.
      Trail network, parking and caution points referenced from the Pelham Border Riders' public trail map. Map library: Leaflet.</p>
    <p class="muted">Version 0.1 · data built 2026-11-10</p>`);
}
function firstRun() {
  if (store.get('agreed', false)) return;
  openSheet('Before you ride', `
    <div class="card"><b>Unofficial map.</b> Not made by or connected to the Pelham Border Riders or the NHSA.</div>
    <div class="card"><ul>
      <li>Trail lines were traced from a 2022 picture and can be wrong or out of date.</li>
      <li>Ride only on signed, open trails. Signs and the club's postings always win.</li>
      <li>Never trust this map about pond ice.</li>
      <li>GPS works only while this app is open and the screen is on.</li></ul></div>
    <button class="big primary" id="agree" style="justify-content:center">I understand</button>`);
  $('sheetClose').hidden = true;
  on('agree', () => { store.set('agreed', true); $('sheetClose').hidden = false; closeSheet(); });
}

// ---------- boot ----------
Promise.all([getJSON('data/trails.geojson'), getJSON('data/pois.json'), getJSON('data/townline.geojson')]).then(([t, p, tl]) => {
  trails = t; buildIndex(); addTownLine(tl); drawTrails(); addPois(p); addZoneLabels();
  if (!store.get('view', null)) map.fitBounds(L.geoJSON(t).getBounds(), { padding: [20, 20] });
  if (params.get('sim')) { $('btnLocate').click(); }
}).catch(e => { console.error(e); toast('Could not load the trail data. Check your connection and reopen the app.', 8000); });
loadStatus();
loadPostedSpots();
firstRun();
importSpotFromLink();
window.addEventListener('online', () => { loadStatus(); loadPostedSpots(); });
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(e => console.warn('offline support unavailable', e));
window.__pst = { map, gps, nearestTrail, tileList, onFix };
window.PST = Object.assign(H, { map, gps, store, $, on, esc, toast, openSheet, closeSheet, fmtFt, haversine, WORK_TYPES, work, spotId, allSpots, drawSpots, focusSpot, openMenu, startGPS,
  setSharedSpots(list) { work.shared = list; drawSpots(); } });   // handy for debugging
})();
