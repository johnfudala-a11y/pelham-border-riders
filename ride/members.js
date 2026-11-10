/* Pelham Sled Trails — member features: sign-in, shared work spots, work parties, live rider locations.
   Talks to Supabase when app/config.js is filled in. With ?demo=1 and no config it runs on this phone only, for trying the screens. */
(() => {
'use strict';
const P = window.PST; if (!P) return;
const { map, $, on, esc, toast, openSheet, closeSheet, store, fmtFt, haversine, WORK_TYPES } = P;
const cfg = window.PST_CONFIG || {};
const configured = !!(cfg.supabaseUrl && cfg.supabaseKey && window.supabase);
const demo = !configured && new URLSearchParams(location.search).get('demo');
let me = null;                       // { id, email, name, approved, admin }
const isMember = () => !!(me && me.approved);
const when = d => new Date(d).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const ago = d => { const s = (Date.now() - new Date(d).getTime()) / 1000; return s < 90 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' d ago'; };
const fail = e => { console.warn(e); toast(navigator.onLine ? (e && e.message) || 'Something went wrong' : 'No signal. Try again when you are back in coverage.', 5000); };

// ---------- backends ----------
function supabaseBackend() {
  const c = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
  const must = r => { if (r.error) throw new Error(r.error.message); return r.data; };
  return {
    async me() {
      const { data: { session } } = await c.auth.getSession(); if (!session) return null;
      const p = must(await c.from('profiles').select('display_name,approved,is_admin').eq('id', session.user.id).maybeSingle());
      return { id: session.user.id, email: session.user.email, name: p ? p.display_name : '', approved: !!(p && p.approved), admin: !!(p && p.is_admin) };
    },
    async signUp(email, password) { const d = must(await c.auth.signUp({ email, password })); if (!d.session) throw new Error('Check your email to confirm your address, then sign in.'); },
    async signIn(email, password) { must(await c.auth.signInWithPassword({ email, password })); },
    async signOut() { await c.auth.signOut(); },
    async join(code, name) { return must(await c.rpc('join_with_code', { p_code: code, p_name: name })); },
    async spots() { return must(await c.from('work_spots').select('*').order('created_at', { ascending: false }).limit(300)); },
    async addSpot(s) { return must(await c.from('work_spots').insert(s).select().single()); },
    async fixSpot(id, fixed) { must(await c.from('work_spots').update({ fixed, fixed_by_name: fixed ? me.name : null, fixed_at: fixed ? new Date().toISOString() : null }).eq('id', id)); },
    async delSpot(id) { must(await c.from('work_spots').delete().eq('id', id)); },
    async parties() {
      const rows = must(await c.from('work_parties').select('*, party_signups(count)').gt('starts_at', new Date(Date.now() - 86400000).toISOString()).order('starts_at').limit(100));
      return rows.map(r => ({ ...r, going: (r.party_signups && r.party_signups[0] && r.party_signups[0].count) || 0 }));
    },
    async party(id) {
      const [party, signups, comments] = await Promise.all([
        c.from('work_parties').select('*').eq('id', id).single(), c.from('party_signups').select('*').eq('party_id', id).order('created_at'),
        c.from('party_comments').select('*').eq('party_id', id).order('created_at')]);
      return { party: must(party), signups: must(signups), comments: must(comments) };
    },
    async addParty(p) { return must(await c.from('work_parties').insert(p).select().single()); },
    async cancelParty(id, cancelled) { must(await c.from('work_parties').update({ cancelled }).eq('id', id)); },
    async signup(party_id, note) { must(await c.from('party_signups').upsert({ party_id, user_id: me.id, name: me.name, note })); },
    async unsign(party_id) { must(await c.from('party_signups').delete().eq('party_id', party_id).eq('user_id', me.id)); },
    async comment(party_id, body) { must(await c.from('party_comments').insert({ party_id, name: me.name, body })); },
    async upload(blob) { const path = `${me.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`; must(await c.storage.from('work-photos').upload(path, blob, { contentType: 'image/jpeg' })); return path; },
    async urls(paths) { if (!paths.length) return []; const d = must(await c.storage.from('work-photos').createSignedUrls(paths, 3600)); return d.map(x => x.signedUrl); },
    async shareLoc(row) { must(await c.from('rider_locations').upsert({ ...row, user_id: me.id, name: me.name, updated_at: new Date().toISOString() })); },
    async stopLoc() { await c.from('rider_locations').delete().eq('user_id', me.id); },
    async riders() { return must(await c.from('rider_locations').select('*').gt('updated_at', new Date(Date.now() - 10 * 60000).toISOString())); },
  };
}
// Demo backend: everything stays in this browser. Lets you try the screens before the database exists.
function demoBackend() {
  const db = store.get('demo', { me: null, spots: [], parties: [], signups: [], comments: [], photos: {} });
  const save = () => store.set('demo', db), id = () => 'd' + Date.now() + Math.random().toString(36).slice(2, 6), now = () => new Date().toISOString();
  const others = [{ user_id: 'r1', name: 'Dana (demo)', lat: 42.7262, lon: -71.3712, heading: 40, speed: 9 }, { user_id: 'r2', name: 'Chris (demo)', lat: 42.7312, lon: -71.3015, heading: 200, speed: 0 }];
  return {
    async me() { return db.me; },
    async signUp(email) { db.me = { id: 'me', email, name: '', approved: false, admin: true }; save(); },
    async signIn(email) { db.me = db.me || { id: 'me', email, name: '', approved: false, admin: true }; save(); },
    async signOut() { db.me = null; save(); },
    async join(code, name) { if (code !== 'demo') return false; db.me.name = name; db.me.approved = true; save(); return true; },
    async spots() { return db.spots; },
    async addSpot(s) { const r = { id: id(), fixed: false, created_by: 'me', created_at: now(), ...s }; db.spots.unshift(r); save(); return r; },
    async fixSpot(i, fixed) { const s = db.spots.find(x => x.id === i); if (s) { s.fixed = fixed; s.fixed_by_name = fixed ? db.me.name : null; } save(); },
    async delSpot(i) { db.spots = db.spots.filter(x => x.id !== i); save(); },
    async parties() { return db.parties.filter(p => new Date(p.starts_at) > Date.now() - 86400000).sort((a, b) => a.starts_at < b.starts_at ? -1 : 1).map(p => ({ ...p, going: db.signups.filter(s => s.party_id === p.id).length })); },
    async party(i) { return { party: db.parties.find(p => p.id === i), signups: db.signups.filter(s => s.party_id === i), comments: db.comments.filter(s => s.party_id === i) }; },
    async addParty(p) { const r = { id: id(), cancelled: false, created_by: 'me', created_at: now(), ...p }; db.parties.push(r); save(); return r; },
    async cancelParty(i, cancelled) { db.parties.find(p => p.id === i).cancelled = cancelled; save(); },
    async signup(party_id, note) { db.signups = db.signups.filter(s => !(s.party_id === party_id && s.user_id === 'me')); db.signups.push({ party_id, user_id: 'me', name: db.me.name, note, created_at: now() }); save(); },
    async unsign(party_id) { db.signups = db.signups.filter(s => !(s.party_id === party_id && s.user_id === 'me')); save(); },
    async comment(party_id, body) { db.comments.push({ id: id(), party_id, user_id: 'me', name: db.me.name, body, created_at: now() }); save(); },
    async upload(blob) { const k = id(); db.photos[k] = await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); }); save(); return k; },
    async urls(paths) { return paths.map(p => db.photos[p]); },
    async shareLoc(row) { this._mine = { ...row, user_id: 'me', name: db.me.name, updated_at: now() }; },
    async stopLoc() { this._mine = null; },
    async riders() { for (const o of others) { o.lat += (Math.random() - .5) * .0004; o.lon += (Math.random() - .5) * .0004; o.updated_at = now(); } return this._mine ? [...others, this._mine] : others; },
  };
}
const be = configured ? supabaseBackend() : demo ? demoBackend() : null;

async function shrink(file, max = 1280) {         // phone photos are huge; send a ~200 KB copy
  const bmp = await createImageBitmap(file), k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  return new Promise(r => cv.toBlob(r, 'image/jpeg', 0.8));
}
async function uploadAll(files) { const out = []; for (const f of [...files].slice(0, 3)) out.push(await be.upload(await shrink(f, demo ? 640 : 1280))); return out; }

// ---------- account ----------
async function refreshMe() {
  if (!be) return;
  try { me = await be.me(); store.set('member', me); } catch (e) { me = store.get('member', null); }   // offline: trust the last known sign-in for display
  if (isMember()) { syncSpots(); syncParties(); pollRiders(); } else { P.setSharedSpots([]); riderLayer.clearLayers(); partyLayer.clearLayers(); }
}
function openAccount() {
  if (!be) return openSheet('Members', `<div class="card"><b>Member features are not connected yet.</b><p>Work parties, the shared work board and live rider locations need the member database.
    The person who runs this app sets that up once (see SETUP-MEMBERS).</p></div>`);
  if (!me) {
    openSheet('Members', `
      <p>Sign in to see the shared work board, join work parties and see who is out riding.</p>
      <input class="field" id="acEmail" type="email" autocomplete="email" placeholder="Email address">
      <input class="field" id="acPw" type="password" autocomplete="current-password" placeholder="Password (8 or more characters)">
      <button class="big primary" id="acIn" style="justify-content:center">Sign in</button>
      <button class="big" id="acUp" style="justify-content:center">Create a new account</button>
      <p class="muted">New here? Create an account, then enter the join code you were given.${demo ? ' <b>Demo mode:</b> any email and password work, and the join code is “demo”. Nothing leaves this phone.' : ''}</p>`);
    const go = fn => async () => { const email = $('acEmail').value.trim(), pw = $('acPw').value; if (!email || pw.length < 8) return toast('Enter your email and a password of 8 or more characters');
      try { await be[fn](email, pw); await refreshMe(); openAccount(); } catch (e) { fail(e); } };
    on('acIn', go('signIn')); on('acUp', go('signUp'));
    return;
  }
  if (!me.approved) {
    openSheet('Join', `
      <p>Signed in as <b>${esc(me.email)}</b>. One more step: enter your name and the join code.</p>
      <input class="field" id="jnName" maxlength="40" placeholder="Your name, as other members will see it" value="${esc(store.get('name', ''))}">
      <input class="field" id="jnCode" autocapitalize="off" autocomplete="off" placeholder="Join code">
      <button class="big primary" id="jnGo" style="justify-content:center">Join</button>
      <button class="big" id="jnOut" style="justify-content:center">Sign out</button>`);
    on('jnGo', async () => { const name = $('jnName').value.trim(), code = $('jnCode').value.trim(); if (!name || !code) return toast('Enter your name and the join code');
      try { if (await be.join(code, name)) { store.set('name', name); await refreshMe(); toast('Welcome, ' + name); P.openMenu(); } else toast('That join code is not right'); } catch (e) { fail(e); } });
    on('jnOut', async () => { await be.signOut(); await refreshMe(); openAccount(); });
    return;
  }
  openSheet('My account', `
    <div class="card"><b>${esc(me.name)}</b><br><span class="muted">${esc(me.email)}${me.admin ? ' · admin' : ''}</span></div>
    <button class="big" id="acOut" style="justify-content:center">Sign out</button>
    <p class="muted">Signing out also stops sharing your location.</p>`);
  on('acOut', async () => { await stopSharing(true); await be.signOut(); await refreshMe(); closeSheet(); toast('Signed out'); });
}

// ---------- shared work board ----------
let sharedSpots = [];
async function syncSpots() {
  if (!isMember()) return;
  try {
    const rows = await be.spots();
    sharedSpots = rows.map(r => ({ lat: r.lat, lon: r.lon, type: r.type, note: r.note, by: r.created_by_name, d: new Date(r.created_at).getTime(), fixed: r.fixed, fixedBy: r.fixed_by_name, src: 'db', dbId: r.id, photo: r.photo_path, own: r.created_by === me.id }));
    store.set('sharedSpots', sharedSpots);
  } catch (e) { sharedSpots = store.get('sharedSpots', []); }
  P.setSharedSpots(sharedSpots);
}
async function postSpot(s, file) {
  const row = { lat: s.lat, lon: s.lon, type: s.type, note: s.note, created_by_name: me.name };
  if (file) row.photo_path = (await uploadAll([file]))[0];
  await be.addSpot(row); await syncSpots();
}
P.member = isMember;
P.spotSaved = (s, file) => {          // called by the report form; true = we take it from here
  if (!isMember()) return false;
  postSpot(s, file).then(() => { toast('Posted to the members’ work board'); const m = sharedSpots.find(x => Math.abs(x.lat - s.lat) < 1e-5 && Math.abs(x.lon - s.lon) < 1e-5); if (m) P.focusSpot(m); })
    .catch(() => { P.work.mine.unshift(s); store.set('spots', P.work.mine); P.drawSpots(); P.focusSpot(s); toast('No signal. Saved on your phone. Open the pin later and tap “Post to members”.', 6000); });
  return true;
};
P.spotExtras = s => {
  if (!isMember()) return '';
  if (s.src !== 'db') return `<div class="spot-actions"><button data-mact="post">Post to members</button></div>`;
  return (s.photo ? `<div class="spot-photo" data-photo="${esc(s.photo)}">Loading photo…</div>` : '') + (s.fixed && s.fixedBy ? `<small>Fixed by ${esc(s.fixedBy)}</small>` : '') +
    `<div class="spot-actions"><button data-mact="party">Plan a work party</button><button data-mact="fix">${s.fixed ? 'Not fixed yet' : 'Mark fixed'}</button>` +
    (s.own || me.admin ? `<button data-mact="del">Remove</button>` : '') + `</div>`;
};
let popupSpot = null;
map.on('popupopen', e => {
  const el = e.popup.getElement(), src = e.popup._source;
  popupSpot = P.allSpots().find(s => P.work.markers[P.spotId(s)] === src) || null;
  const ph = el.querySelector('[data-photo]');
  if (ph && be) be.urls([ph.dataset.photo]).then(([u]) => { ph.innerHTML = u ? `<img src="${u}" alt="Photo of the work needed">` : ''; }).catch(() => { ph.textContent = 'Photo needs a signal to load.'; });
  el.querySelectorAll('[data-mact]').forEach(b => b.onclick = async () => {
    const s = popupSpot; if (!s) return;
    try {
      if (b.dataset.mact === 'post') { await postSpot(s); P.work.mine = P.work.mine.filter(x => P.spotId(x) !== P.spotId(s)); store.set('spots', P.work.mine); P.drawSpots(); map.closePopup(); toast('Posted to the members’ work board'); }
      else if (b.dataset.mact === 'fix') { await be.fixSpot(s.dbId, !s.fixed); map.closePopup(); await syncSpots(); toast(s.fixed ? 'Reopened' : 'Marked fixed. Thank you!'); }
      else if (b.dataset.mact === 'del') { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Tap again to remove'; return; } await be.delSpot(s.dbId); map.closePopup(); await syncSpots(); }
      else if (b.dataset.mact === 'party') { map.closePopup(); openPartyForm(s); }
    } catch (err) { fail(err); }
  });
});

// ---------- work parties ----------
const partyLayer = L.layerGroup().addTo(map);
let partyCache = [];
async function syncParties() {
  if (!isMember()) return;
  try { partyCache = await be.parties(); store.set('parties', partyCache); } catch (e) { partyCache = store.get('parties', []); }
  partyLayer.clearLayers();
  for (const p of partyCache) if (!p.cancelled) L.marker([p.lat, p.lon], { zIndexOffset: 600, title: p.title, icon: L.divIcon({ className: '', iconSize: [40, 40], iconAnchor: [20, 20], html: '<div class="poi party">📅</div>' }) })
    .on('click', () => openParty(p.id)).addTo(partyLayer);
}
async function openParties() {
  if (!isMember()) return openAccount();
  await syncParties();
  openSheet('Work parties', `
    <button class="big primary" id="wpNew"><span class="grow">Plan a work party<small>Pick a time and place, describe the job, add photos</small></span><span>＋</span></button>
    <h3>${partyCache.length ? 'Coming up' : 'Nothing scheduled yet'}</h3>
    ${partyCache.map(p => `<button class="big" data-party="${esc(p.id)}"><span class="grow">${p.cancelled ? '<s>' : ''}${esc(p.title)}${p.cancelled ? '</s>' : ''}<small>${esc(when(p.starts_at))}${p.meet_place ? ' · ' + esc(p.meet_place) : ''}<br>Organised by ${esc(p.created_by_name)}</small></span>
      <span class="tag ${p.cancelled ? 'closed' : 'open'}">${p.cancelled ? 'CANCELLED' : p.going + ' going'}</span></button>`).join('')}
    <p class="muted">Tip: open a pin on the work board and tap “Plan a work party” to schedule a crew for that exact spot.</p>`);
  on('wpNew', () => openPartyForm());
  document.querySelectorAll('[data-party]').forEach(b => b.onclick = () => openParty(b.dataset.party));
}
function openPartyForm(spot) {
  const g = P.gps.last, c = map.getCenter();
  const loc = spot ? { lat: spot.lat, lon: spot.lon, what: 'At the pinned work spot' } : g && Date.now() - g.t < 60000 ? { lat: g.lat, lon: g.lon, what: 'At your current GPS position' } : { lat: c.lat, lon: c.lng, what: 'At the centre of the map (move the map first to change it)' };
  const d = new Date(Date.now() + 86400000 * 3); d.setHours(9, 0, 0, 0);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  openSheet('Plan a work party', `
    <h3>What</h3>
    <input class="field" id="pfTitle" maxlength="80" placeholder="Short title, e.g. Clear blowdowns on the Gumpas loop" value="${spot ? esc((WORK_TYPES[spot.type] || 'Trail work') + (spot.note ? ': ' + spot.note : '')).slice(0, 80) : ''}">
    <textarea class="field" id="pfDetails" rows="4" maxlength="2000" placeholder="Describe the work: what is wrong, how big the job is, how many people it needs"></textarea>
    <input class="field" id="pfTools" maxlength="400" placeholder="What to bring: chainsaw, loppers, gloves, planks…">
    <h3>When</h3>
    <input class="field" id="pfWhen" type="datetime-local" value="${local}">
    <select class="field" id="pfHours">${[1, 2, 3, 4, 6, 8].map(h => `<option value="${h}"${h === 2 ? ' selected' : ''}>About ${h} hour${h > 1 ? 's' : ''}</option>`).join('')}</select>
    <h3>Where</h3>
    <div class="card"><b>${loc.what}</b><br><span class="muted">${loc.lat.toFixed(5)}, ${loc.lon.toFixed(5)}</span></div>
    <input class="field" id="pfMeet" maxlength="200" placeholder="Where to meet, e.g. Veterans Park trailer drop">
    <h3>Photos</h3>
    <label class="big" for="pfPhotos"><span class="grow">Add up to 3 photos<small id="pfPhotoTxt">Show people what they are signing up for</small></span><span>📷</span></label>
    <input id="pfPhotos" type="file" accept="image/*" multiple hidden>
    <button class="big primary" id="pfSave" style="justify-content:center">Post work party</button>`);
  $('pfPhotos').onchange = () => { $('pfPhotoTxt').textContent = Math.min(3, $('pfPhotos').files.length) + ' photo(s) chosen'; };
  on('pfSave', async () => {
    const title = $('pfTitle').value.trim(), starts = new Date($('pfWhen').value);
    if (!title) return toast('Give the work party a title'); if (isNaN(starts)) return toast('Pick a date and time');
    $('pfSave').disabled = true; $('pfSave').textContent = 'Posting…';
    try {
      const photo_paths = await uploadAll($('pfPhotos').files);
      const p = await be.addParty({ title, details: $('pfDetails').value.trim(), tools: $('pfTools').value.trim(), meet_place: $('pfMeet').value.trim(), lat: +loc.lat.toFixed(5), lon: +loc.lon.toFixed(5),
        starts_at: starts.toISOString(), hours: +$('pfHours').value, photo_paths, spot_id: spot && spot.dbId ? spot.dbId : null, created_by_name: me.name });
      await be.signup(p.id, 'Organiser'); await syncParties(); toast('Work party posted'); openParty(p.id);
    } catch (e) { fail(e); $('pfSave').disabled = false; $('pfSave').textContent = 'Post work party'; }
  });
}
function ics(p) {
  const f = d => new Date(d).toISOString().replace(/[-:]|\.\d{3}/g, ''), end = new Date(new Date(p.starts_at).getTime() + p.hours * 3600000), x = s => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Pelham Sled Trails//EN', 'BEGIN:VEVENT', 'UID:' + p.id + '@pelham-sled-trails', 'DTSTAMP:' + f(Date.now()), 'DTSTART:' + f(p.starts_at), 'DTEND:' + f(end),
    'SUMMARY:' + x('Trail work: ' + p.title), 'DESCRIPTION:' + x(p.details + (p.tools ? '\nBring: ' + p.tools : '')), 'LOCATION:' + x(p.meet_place || `${p.lat}, ${p.lon}`), 'GEO:' + p.lat + ';' + p.lon, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}
async function openParty(id) {
  if (!isMember()) return openAccount();
  let d; try { d = await be.party(id); } catch (e) { return fail(e); }
  const p = d.party; if (!p) return toast('That work party no longer exists');
  const mine = d.signups.find(s => s.user_id === me.id), canEdit = p.created_by === me.id || me.admin;
  openSheet('Work party', `
    <div class="card"><b style="font-size:20px">${esc(p.title)}</b>${p.cancelled ? ' <span class="tag closed">CANCELLED</span>' : ''}
      <p><b>${esc(when(p.starts_at))}</b> · about ${+p.hours} h<br>${p.meet_place ? 'Meet: ' + esc(p.meet_place) + '<br>' : ''}<span class="muted">Organised by ${esc(p.created_by_name)}</span></p>
      ${p.details ? `<p style="white-space:pre-wrap">${esc(p.details)}</p>` : ''}${p.tools ? `<p><b>Bring:</b> ${esc(p.tools)}</p>` : ''}</div>
    <div class="photos" id="wpPhotos"></div>
    <div class="row2"><button class="big" id="wpMap">Show on map</button><a class="big" href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}" target="_blank" rel="noopener">Directions</a></div>
    <h3>${d.signups.length} going</h3>
    ${d.signups.length ? '<div class="card"><ul>' + d.signups.map(s => `<li><b>${esc(s.name)}</b>${s.note ? ' · ' + esc(s.note) : ''}</li>`).join('') + '</ul></div>' : '<p class="muted">Nobody yet. Be the first.</p>'}
    ${p.cancelled ? '' : mine ? `<button class="big" id="wpOut" style="justify-content:center">I can’t make it after all</button>` : `
      <input class="field" id="wpNote" maxlength="200" placeholder="Optional: what you can bring, or when you can arrive">
      <button class="big primary" id="wpIn" style="justify-content:center">I’m in</button>`}
    <button class="big" id="wpCal" style="justify-content:center">Add to my calendar</button>
    <h3>Discussion</h3>
    ${d.comments.map(cm => `<div class="card comment"><b>${esc(cm.name)}</b> <span class="muted">${esc(ago(cm.created_at))}</span><br>${esc(cm.body)}</div>`).join('') || '<p class="muted">No messages yet.</p>'}
    <textarea class="field" id="wpMsg" rows="2" maxlength="500" placeholder="Message the crew: questions, who is bringing what…"></textarea>
    <button class="big" id="wpSend" style="justify-content:center">Send message</button>
    ${canEdit ? `<button class="big" id="wpCancel" style="justify-content:center;min-height:48px">${p.cancelled ? 'Un-cancel this work party' : 'Cancel this work party'}</button>` : ''}`);
  if (p.photo_paths && p.photo_paths.length) be.urls(p.photo_paths).then(us => { const el = $('wpPhotos'); if (el) el.innerHTML = us.filter(Boolean).map(u => `<a href="${u}" target="_blank" rel="noopener"><img src="${u}" alt="Photo of the work site"></a>`).join(''); }).catch(() => {});
  const act = fn => async () => { try { await fn(); await syncParties(); openParty(id); } catch (e) { fail(e); } };
  on('wpIn', act(() => be.signup(id, $('wpNote').value.trim()))); on('wpOut', act(() => be.unsign(id)));
  on('wpSend', act(async () => { const b = $('wpMsg').value.trim(); if (b) await be.comment(id, b); }));
  on('wpCancel', act(() => be.cancelParty(id, !p.cancelled)));
  on('wpMap', () => { closeSheet(); map.setView([p.lat, p.lon], 16); });
  on('wpCal', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics(p)], { type: 'text/calendar' })); a.download = 'trail-work.ics'; document.body.appendChild(a); a.click(); a.remove(); });
}

// ---------- live rider locations (opt-in, off every time the app starts) ----------
const riderLayer = L.layerGroup().addTo(map);
const live = { sharing: false, lastSent: 0, lastFix: 0, riders: [] };
async function pollRiders() {
  if (!isMember() || document.visibilityState !== 'visible') return;
  try { live.riders = await be.riders(); } catch (e) { return; }
  riderLayer.clearLayers();
  for (const r of live.riders) {
    if (r.user_id === me.id) continue;
    const initials = r.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    L.marker([r.lat, r.lon], { zIndexOffset: 400, title: r.name, icon: L.divIcon({ className: '', iconSize: [36, 36], iconAnchor: [18, 18], html: `<div class="rider">${esc(initials)}<span>${esc(r.name.split(/\s+/)[0])}</span></div>` }) })
      .bindPopup(`<b>${esc(r.name)}</b><br>${r.speed > 1 ? Math.round(r.speed * 2.237) + ' mph' : 'Stopped'} · updated ${esc(ago(r.updated_at))}` + (P.gps.last ? `<br>${fmtFt(haversine([P.gps.last.lat, P.gps.last.lon], [r.lat, r.lon]))} from you` : '')).addTo(riderLayer);
  }
}
setInterval(pollRiders, 20000);
async function startSharing() { if (!P.gps.on) P.startGPS(); if (!P.gps.on) return; live.sharing = true; live.lastSent = 0; live.lastFix = Date.now(); toast('Members can now see you on the map. It turns off when you close the app.', 5000); }
async function stopSharing(quiet) { if (!live.sharing) return; live.sharing = false; try { await be.stopLoc(); } catch (e) { /* row expires from view after 10 minutes anyway */ } if (!quiet) toast('Location sharing off'); }
P.fix = f => {
  if (!live.sharing || !isMember()) return;
  live.lastFix = Date.now();
  if (f.acc <= 60 && Date.now() - live.lastSent > 15000) { live.lastSent = Date.now(); be.shareLoc({ lat: +f.lat.toFixed(5), lon: +f.lon.toFixed(5), heading: P.gps.heading, speed: f.speed || 0 }).catch(() => {}); }
};
setInterval(() => { if (live.sharing && (!P.gps.on || Date.now() - live.lastFix > 5 * 60000)) stopSharing(); }, 30000);   // GPS off or lost: stop sharing
window.addEventListener('pagehide', () => { if (live.sharing) be.stopLoc(); });
function openRiders() {
  if (!isMember()) return openAccount();
  const others = live.riders.filter(r => r.user_id !== me.id);
  openSheet('Riders out now', `
    <button class="big ${live.sharing ? 'active' : ''}" id="rdShare"><span class="grow">Share my location with members<small>${live.sharing ? 'On. Members see your position, updated every 15 seconds.' : 'Off. Nobody can see where you are.'}</small></span><span class="tag ${live.sharing ? 'open' : ''}">${live.sharing ? 'ON' : 'OFF'}</span></button>
    <h3>${others.length ? others.length + ' sharing right now' : 'Nobody is sharing right now'}</h3>
    ${others.map((r, i) => `<button class="big" data-rider="${i}"><span class="grow">${esc(r.name)}<small>${r.speed > 1 ? Math.round(r.speed * 2.237) + ' mph' : 'Stopped'} · ${esc(ago(r.updated_at))}${P.gps.last ? ' · ' + fmtFt(haversine([P.gps.last.lat, P.gps.last.lon], [r.lat, r.lon])) + ' away' : ''}</small></span><span>›</span></button>`).join('')}
    <p class="muted">Sharing is always your choice and is off each time you open the app. Only signed-in members can see it, positions older than 10 minutes disappear, and no history is kept.
      It stops when you turn it off, turn GPS off, sign out or close the app.</p>`);
  on('rdShare', async () => { if (live.sharing) await stopSharing(); else await startSharing(); openRiders(); });
  document.querySelectorAll('[data-rider]').forEach(b => b.onclick = () => { const r = others[+b.dataset.rider]; closeSheet(); map.setView([r.lat, r.lon], 15); });
}

// ---------- menu section ----------
P.menuHtml = () => {
  if (!be) return `<h3>Members</h3><button class="big" id="mmAcct"><span class="grow">Member features<small>Not connected yet</small></span><span>›</span></button>`;
  if (!isMember()) return `<h3>Members</h3><button class="big primary" id="mmAcct"><span class="grow">${me ? 'Finish joining' : 'Sign in or join'}<small>Work parties, shared work board, riders out now</small></span><span>›</span></button>`;
  const upcoming = partyCache.filter(p => !p.cancelled).length, out = live.riders.filter(r => r.user_id !== me.id).length;
  return `<h3>Members${demo ? ' (demo)' : ''}</h3>
    <button class="big" id="mmParties"><span class="grow">Work parties<small>Schedule a crew, sign up, coordinate</small></span><span class="tag">${upcoming} coming up</span></button>
    <button class="big ${live.sharing ? 'active' : ''}" id="mmRiders"><span class="grow">Riders out now<small>${live.sharing ? 'You are sharing your location' : 'Your location is not shared'}</small></span><span class="tag">${out} out</span></button>
    <button class="big" id="mmAcct"><span class="grow">${esc(me.name)}<small>Account</small></span><span>›</span></button>`;
};
P.menuWire = () => { on('mmAcct', openAccount); on('mmParties', openParties); on('mmRiders', openRiders); };

refreshMe();
window.addEventListener('online', refreshMe);
setInterval(() => { if (document.visibilityState === 'visible') { syncSpots(); syncParties(); } }, 60000);
})();
