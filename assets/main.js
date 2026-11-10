/* Pelham Border Riders — home page behaviour. All content lives in site-config.js */
(function () {
  "use strict";
  const C = window.PBR, IMG = window.PBR_IMG;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const icon = (n) => `<svg aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const LABEL = { open: "Open", limited: "Limited", closed: "Closed" };
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const fmt = (d, o) => d.toLocaleDateString("en-US", o);
  const gmaps = (q) => "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(q);
  const ext = (u) => (/^https?:/.test(u) ? ' target="_blank" rel="noopener"' : "");

  /* a photo that fails to load gets two more tries before it is hidden */
  const retry = (im, giveUp) => { const n = +(im.dataset.try || 0); if (n >= 2) return giveUp(); im.dataset.try = n + 1; setTimeout(() => { im.src = im.src.split("?")[0] + "?retry=" + (n + 1); }, 700 * (n + 1)); };

  /* ---- nav ---- */
  const nav = $("#nav"), links = $("#links"), burger = $("#burger");
  const onScroll = () => nav.classList.toggle("scrolled", scrollY > 30);
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
  const setMenu = (open) => { links.classList.toggle("open", open); nav.classList.toggle("open", open); burger.setAttribute("aria-expanded", open); };
  burger.onclick = () => setMenu(!links.classList.contains("open"));
  links.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  addEventListener("keydown", (e) => e.key === "Escape" && setMenu(false));

  /* ---- logo ---- */
  if (C.logo) ["#navLogo", "#footLogo"].forEach((s) => { const el = $(s); el.onerror = () => (el.hidden = true); el.src = C.logo; el.hidden = false; });

  /* ---- status ---- */
  const st = C.status.overall, upd = parse(C.status.updated);
  $("#heroDot").className = "dot " + st;
  $("#heroStatus").textContent = `Trails ${LABEL[st].toLowerCase()} · updated ${fmt(upd, { month: "short", day: "numeric" })}`;
  const b = $("#banner"); b.className = "banner reveal " + st;
  b.innerHTML = `<div class="big">Trails ${LABEL[st]}</div><div><p>${esc(C.status.note)}</p><small>Last updated ${fmt(upd, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</small></div>`;
  $("#areas").innerHTML = C.areas.map((a) => `
    <article class="area ${a.status} reveal"><div class="top"><h4>${esc(a.name)}</h4><span class="tag ${a.status}">${LABEL[a.status]}</span></div>
    <div class="meta">${esc(a.size)}${a.note ? " · " + esc(a.note) : ""}</div>
    <div class="acts">${a.map ? `<a class="textlink" href="${esc(a.map)}"${ext(a.map)}>${esc(a.mapLabel || "Printable map")}</a>` : ""}${a.kiosk ? `<a class="textlink" href="${esc(a.kiosk)}"${ext(a.kiosk)}>Town kiosk map</a>` : ""}</div></article>`).join("");

  /* ---- about ---- */
  if (C.crewPhoto) { const cp = $("#crewPhoto"); cp.onerror = () => retry(cp, () => cp.closest("figure").remove()); cp.src = IMG(C.crewPhoto, 1000, 625); } else $("#crewPhoto").closest("figure").remove();
  $("#projects").innerHTML = (C.projects || []).map((p) => `<li>${icon("check")}<span>${esc(p)}</span></li>`).join("");

  /* ---- membership / links ---- */
  $("#joinSeason").textContent = C.membership.season || "";
  $("#voucherText").textContent = C.membership.voucher;
  $("#joinBtn").href = C.membership.joinUrl;
  $("#priceNote").textContent = C.membership.price ? `Membership: ${C.membership.price}.` : "Your dues are shown at checkout, before you pay.";
  $("#shopBtn").href = C.shopUrl;
  $("#fbLink").href = $("#fbLink2").href = C.facebook;
  $("#yr").textContent = new Date().getFullYear();
  $("#footMail").textContent = C.mail;

  /* ---- GPS app ---- */
  if (C.gpsApp.ready) {
    const bd = $("#appBadge"); bd.textContent = "Live now"; bd.classList.add("live");
    const btn = $("#appBtn"); btn.href = C.gpsApp.url; btn.textContent = "Launch the GPS app";
    $("#footApp").href = C.gpsApp.url; const pl = $("#phoneLink"); pl.href = C.gpsApp.url; pl.setAttribute("aria-label", "Launch the GPS trail app");
  }

  /* ---- events: automatic 3rd-Wednesday meetings + events from the config ---- */
  const thirdWed = (y, m) => { const d = new Date(y, m, 1); return new Date(y, m, 1 + ((3 - d.getDay() + 7) % 7) + 14); };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const M = C.meeting, meetings = [];
  for (let i = 0; meetings.length < 3 && i < 14; i++) {
    const d = thirdWed(today.getFullYear(), today.getMonth() + i);
    if (d >= today && !(M.skipMonths || []).includes(d.getMonth() + 1))
      meetings.push({ date: ymd(d), time: M.time, title: "Monthly Club Meeting", where: `${M.place}, ${M.address}`, note: "All riders welcome. Trail report and season planning.", map: M.address });
  }
  const evs = [...(C.events || []).filter((e) => parse(e.date) >= today), ...meetings].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);

  function ics(e) {                       // "Add to calendar" file for one event
    const t = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(e.time || ""); let h = t ? +t[1] : 19; const mi = t ? +t[2] : 0;
    if (t && t[3]) { if (/pm/i.test(t[3]) && h < 12) h += 12; if (/am/i.test(t[3]) && h === 12) h = 0; }
    const d = e.date.replace(/-/g, ""), s = `${d}T${pad(h)}${pad(mi)}00`, en = `${d}T${pad(Math.min(h + 2, 23))}${pad(mi)}00`;
    const clean = (x) => String(x || "").replace(/([,;\\])/g, "\\$1");
    const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Pelham Border Riders//Site//EN", "BEGIN:VEVENT",
      `UID:${d}-${encodeURIComponent(e.title)}@pelhamborderriders`, `DTSTAMP:${d}T000000Z`,
      `DTSTART;TZID=America/New_York:${s}`, `DTEND;TZID=America/New_York:${en}`,
      `SUMMARY:${clean("Border Riders: " + e.title)}`, `LOCATION:${clean(e.where)}`, `DESCRIPTION:${clean(e.note)}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    return "data:text/calendar;charset=utf-8," + encodeURIComponent(body);
  }
  $("#eventList").innerHTML = evs.map((e) => { const d = parse(e.date); return `
    <article class="event reveal"><div class="date" aria-hidden="true"><span>${MONTHS[d.getMonth()]}</span><b>${d.getDate()}</b></div>
    <div><h4>${esc(e.title)}</h4><p>${fmt(d, { weekday: "long", month: "long", day: "numeric" })} · ${esc(e.time)}</p><p>${esc(e.where)}</p>${e.note ? `<p>${esc(e.note)}</p>` : ""}</div>
    <div class="acts"><a class="btn btn-line btn-sm" href="${ics(e)}" download="border-riders-${e.date}.ics">${icon("cal")} Add to calendar</a>
    <a class="btn btn-dark btn-sm" target="_blank" rel="noopener" href="${gmaps(e.map || e.where + ", Pelham NH")}">Directions</a></div></article>`; }).join("");
  $("#meetRule").textContent = M.rule;
  $("#meetPlace").innerHTML = `${esc(M.time)} at the ${esc(M.place)}<br>${esc(M.address)}`;
  $("#nextMeet").textContent = meetings[0] ? fmt(parse(meetings[0].date), { weekday: "long", month: "long", day: "numeric" }) : "To be announced";
  $("#meetMap").href = gmaps(M.address);

  /* ---- gallery + lightbox ---- */
  const P = C.photos || [], grid = $("#grid");
  if (!P.length) $("#photos").remove();
  else {
    grid.innerHTML = P.map((p, i) => `<button class="${p.tall ? "tall" : ""}" data-i="${i}" aria-label="View photo: ${esc(p.cap)}">
      <img loading="lazy" alt="${esc(p.cap)}" src="${esc(p.tall ? IMG(p.img, 480, 640) : IMG(p.img, 480, 360))}"><span>${esc(p.cap)}</span></button>`).join("");
    grid.querySelectorAll("img").forEach((im) => (im.onerror = () => retry(im, () => im.closest("button").remove())));
    const lb = $("#lightbox"), lbImg = $("#lbImg"), lbCap = $("#lbCap"); let cur = 0;
    const show = (i) => { cur = (i + P.length) % P.length; lbImg.src = P[cur].img; lbImg.alt = P[cur].cap; lbCap.textContent = P[cur].cap; };
    grid.addEventListener("click", (e) => { const bt = e.target.closest("button"); if (!bt) return; show(+bt.dataset.i); lb.showModal(); });
    $("#lbClose").onclick = () => lb.close(); $("#lbPrev").onclick = () => show(cur - 1); $("#lbNext").onclick = () => show(cur + 1);
    lb.addEventListener("click", (e) => { if (e.target === lb || e.target.classList.contains("lb")) lb.close(); });
    lb.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") show(cur - 1); if (e.key === "ArrowRight") show(cur + 1); });
    let sx = null;                         // swipe left or right on a phone
    lb.addEventListener("touchstart", (e) => { sx = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
    lb.addEventListener("touchend", (e) => { if (sx === null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 50) show(cur + (dx < 0 ? 1 : -1)); }, { passive: true });
    lbImg.addEventListener("load", () => { new Image().src = P[(cur + 1) % P.length].img; });   // the next photo is ready before you ask
  }

  /* ---- parking ---- */
  $("#parkGrid").innerHTML = C.parking.map((p, i) => `
    <article class="park reveal"><span class="kind">${esc(p.tag || "Parking")}</span><h4>${esc(p.name)}</h4><p>${esc(p.address)}${p.note ? "<br>" + esc(p.note) : ""}</p>
    <div class="acts"><a class="textlink" target="_blank" rel="noopener" href="${gmaps(p.directions || p.name + ", Pelham NH")}">Directions</a>
    ${p.lat ? `<a class="textlink" href="map.html#p=${i}">Show on trail map</a>` : ""}${p.kiosk ? `<a class="textlink" href="${esc(p.kiosk)}" target="_blank" rel="noopener">Kiosk map</a>` : ""}</div></article>`).join("");

  /* ---- shop + sponsors ---- */
  const S = C.shop || [];
  if (!S.length) $("#shopGrid").remove();
  else {
    $("#shopGrid").innerHTML = S.map((s) => `<a class="item" href="${esc(s.url || C.shopUrl)}" target="_blank" rel="noopener">
      <img loading="lazy" alt="" src="${esc(IMG(s.img, 400, 400))}"><div><span>${esc(s.name)}</span><em>${esc(s.price)}</em></div></a>`).join("");
    $("#shopGrid").querySelectorAll("img").forEach((im) => (im.onerror = () => retry(im, () => (im.style.visibility = "hidden"))));
  }
  $("#sponsorCloud").innerHTML = C.sponsors.map(([n, u]) => `<li>${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}</a>` : `<span>${esc(n)}</span>`}</li>`).join("");

  /* ---- officers ---- */
  $("#officers").innerHTML = C.officers.map((o) => `
    <div class="officer${o.open ? " open" : ""}"><small>${esc(o.role)}</small><b>${esc(o.name)}</b>
    ${o.open ? `<a href="mailto:${esc(C.email)}?subject=${encodeURIComponent(o.role + " position")}">${icon("mail")}Interested? Email the club</a>` : ""}
    ${o.phone ? `<a href="tel:+1${o.phone.replace(/\D/g, "")}">${icon("phone")}${esc(o.phone)}</a>` : ""}
    ${o.email ? `<a href="mailto:${esc(o.email)}">${icon("mail")}${esc(o.email)}</a>` : ""}</div>`).join("");
  $("#mailAddr").textContent = C.mail;
  const ce = $("#clubEmail"); ce.textContent = C.email; ce.href = "mailto:" + C.email;

  /* ---- mini map in the phone mockup (starts when scrolled into view) ---- */
  const mini = $("#miniMap");
  /* Leaflet is fetched only when the map is about to scroll into view */
  const LEAFLET = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.";
  const leaflet = () => window.L ? Promise.resolve() : Promise.all([
    new Promise((ok, no) => { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = LEAFLET + "css"; l.onload = ok; l.onerror = no; document.head.prepend(l); }),
    new Promise((ok, no) => { const s = document.createElement("script"); s.src = LEAFLET + "js"; s.onload = ok; s.onerror = no; document.head.appendChild(s); })]);
  function startMini() {
    if (mini.dataset.on) return; mini.dataset.on = 1;
    const m = L.map(mini, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false, zoomSnap: 0.1 });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(m);
    L.control.attribution({ prefix: false, position: "bottomright" }).addAttribution("&copy; OpenStreetMap").addTo(m);
    m.setView([42.727, -71.325], 12.6);
    fetch("data/trails.geojson").then((r) => r.json()).then((g) => {
      const layer = L.geoJSON(g, { style: (f) => window.PBR_TRAIL_STYLE(f, 3), interactive: false }).addTo(m);
      m.invalidateSize(); m.setView(layer.getBounds().getCenter(), 12.6);
      $("#hudTrails").textContent = g.features.length;
      $("#hudMiles").textContent = Math.round(g.features.reduce((s, f) => s + (f.properties.km || 0), 0) * 0.621371);
      const vp = C.parking[0];
      if (vp && vp.lat) L.circleMarker([vp.lat, vp.lng], { radius: 7, color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1, interactive: false }).addTo(m);
    }).catch(() => {});
  }
  if (mini) new IntersectionObserver((es, o) => es.some((e) => e.isIntersecting) && (leaflet().then(startMini).catch(() => {}), o.disconnect()), { rootMargin: "600px" }).observe(mini);

  /* ---- highlight the section you are reading in the menu ---- */
  const spy = new Map([...links.querySelectorAll('a[href^="#"]:not(.btn)')].map((a) => [a.getAttribute("href").slice(1), a]));
  const spyIO = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    spy.forEach((a) => a.removeAttribute("aria-current"));
    const a = spy.get(e.target.id); if (a) a.setAttribute("aria-current", "true");
  }), { rootMargin: "-45% 0px -50% 0px" });
  document.querySelectorAll("main section[id], header[id]").forEach((el) => spyIO.observe(el));

  /* ---- reveal on scroll ---- */
  const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))), { threshold: 0.1 });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  /* ---- snowfall (paused when the hero is off screen) ---- */
  const cv = $("#snow");
  if (cv && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const ctx = cv.getContext("2d"); let W, H, flakes = [], run = true, raf;
    const size = () => { W = cv.width = cv.offsetWidth; H = cv.height = cv.offsetHeight;
      flakes = Array.from({ length: Math.min(150, Math.round(W / 9)) }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 2.2 + 0.6, s: Math.random() * 0.8 + 0.3, w: Math.random() * 6.28, o: Math.random() * 0.5 + 0.4 })); };
    const tick = () => { if (!run) return; ctx.clearRect(0, 0, W, H);
      for (const f of flakes) { f.y += f.s; f.w += 0.01; f.x += Math.sin(f.w) * 0.4; if (f.y > H) { f.y = -5; f.x = Math.random() * W; }
        ctx.globalAlpha = f.o; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.29); ctx.fill(); }
      raf = requestAnimationFrame(tick); };
    size(); addEventListener("resize", size);
    new IntersectionObserver(([e]) => { run = e.isIntersecting; cancelAnimationFrame(raf); if (run) tick(); }).observe(cv);
  }
})();
