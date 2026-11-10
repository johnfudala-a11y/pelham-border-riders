/* =====================================================================
   PELHAM BORDER RIDERS — SITE SETTINGS
   ---------------------------------------------------------------------
   This is the ONLY file a club officer needs to edit during the season.
   Change the text between the quotes, save, re-upload. That's it.
   ===================================================================== */
window.PBR = {

  /* ---------- TRAIL STATUS ------------------------------------------
     overall: "open" | "limited" | "closed"
     note:    one short line shown in the big status banner
     updated: date you last changed this (YYYY-MM-DD)                 */
  status: {
    overall: "closed",
    note: "Trails are closed and gates are closed. The season opens once the ground is frozen and there is enough snow cover.",
    updated: "2026-11-10"
  },

  /* ---------- TRAIL AREAS -------------------------------------------
     status per area: "open" | "limited" | "closed"
     map:   printable trail map (optional)
     kiosk: the Town of Pelham's kiosk map for the area (optional)     */
  areas: [
    { zone: "town", name: "Town Trails, Ponds, Pipeline & Powerlines", size: "60+ miles", status: "closed", note: "The main town-wide network", map: "map.html", mapLabel: "Open live map" },
    { zone: "peabody", name: "Peabody Town Forest", size: "100+ acres", status: "closed",
      map: "assets/maps/peabody-town-forest.pdf",
      kiosk: "https://www.pelhamweb.com/sites/g/files/vyhlif4856/f/uploads/kioskpeabody_003.pdf" },
    { zone: "kirby", name: "Kirby Ivers Town Forest", size: "86 acres", status: "closed",
      map: "assets/maps/kirby-ivers-town-forest.pdf" },
    { zone: "gumpas", name: "Gumpas Pond Conservation Area", size: "150 acres", status: "closed",
      map: "assets/maps/gumpas-pond-conservation-area.pdf" },
    { zone: "cutter", name: "Merriam / Cutter Conservation Area", size: "147 acres", status: "closed",
      map: "assets/maps/merriam-cutter-conservation-area.pdf",
      kiosk: "https://www.pelhamweb.com/sites/g/files/vyhlif4856/f/uploads/kioskcuttermerriam.pdf" },
    { zone: "muldoon", name: "Muldoon Park", size: "58 acres", status: "closed",
      map: "assets/maps/muldoon-park.pdf" },
    { zone: "littleisland", name: "Little Island Pond Conservation Area", size: "21.5 acres", status: "closed",
      map: "assets/maps/little-island-pond-conservation-area.pdf" }
  ],

  /* ---------- PARKING / TRAILHEADS ----------------------------------
     directions: what Google Maps should search for
     lat/lng:    where the pin sits on the trail map (approx: true = estimated) */
  parking: [
    { name: "Veterans Memorial Park", tag: "Trailer drop", address: "11 Mammoth Rd, Pelham NH 03076",
      directions: "11 Mammoth Rd, Pelham, NH 03076", lat: 42.7004708, lng: -71.3531548,
      note: "The best spot for trucks and trailers." },
    { name: "Goat Pit", tag: "Sand pit lot", address: "End of Tina Ave (15 Tina Ave), Pelham NH",
      directions: "15 Tina Ave, Pelham, NH 03076", lat: 42.7392, lng: -71.3143, approx: true,
      note: "Park in the sand pit at the end of Tina Ave, off Bridge St (Rt 38)." },
    { name: "Costa Conservation Area", tag: "Trailhead lot", address: "End of Frontier Dr, off Dutton Rd, Pelham NH",
      directions: "Frontier Dr, Pelham, NH 03076", lat: 42.7108, lng: -71.2869, approx: true,
      note: "Town lot for the Costa Forest trails.",
      kiosk: "https://www.pelhamweb.com/sites/g/files/vyhlif4856/f/uploads/kioskcosta_0.pdf" },
    { name: "Cutler-Spalding Conservation Area", tag: "Small lot", address: "Pelham NH",
      directions: "42.715528,-71.370722", lat: 42.715528, lng: -71.370722,
      note: "Small lot. Please park considerately.",
      kiosk: "https://www.pelhamweb.com/sites/g/files/vyhlif4856/f/uploads/kioskcutlerspalding.pdf" }
  ],

  /* ---------- EVENTS ------------------------------------------------
     Club meetings (3rd Wednesday) are added automatically.
     Add one-off events here. date = "YYYY-MM-DD"                       */
  events: [
    // Example (remove the two slashes at the start to use it):
    // { date: "2026-11-21", time: "9:00 AM", title: "Trail Work Party", where: "Veterans Memorial Park", note: "Bring gloves and a saw." },
  ],

  /* ---------- MEETINGS ---------------------------------------------- */
  meeting: {
    rule: "Every 3rd Wednesday of the month",
    time: "7:00 PM",
    place: "Pelham American Legion, Post 100",
    address: "32 Windham Rd, Pelham NH 03076",
    lat: 42.7361107, lng: -71.3228541,
    skipMonths: []                              // e.g. [7,8] to skip July & August
  },

  /* ---------- MEMBERSHIP -------------------------------------------- */
  membership: {
    season: "2027",
    joinUrl: "https://www.tinyurl.com/BorderRiders",
    voucher: "$30 off NH state registration for every sled you register with your club voucher.",
    price: ""      // e.g. "$35 per household". Leave "" and the site says the price is shown at checkout.
  },

  /* ---------- GPS APP ----------------------------------------------
     Where the Border Riders GPS trail app lives once it's deployed.
     Leave as "ride/" if you upload the app into a folder named "ride"
     next to this website.                                              */
  gpsApp: {
    url: "ride/",
    ready: true      // false shows "Coming soon" instead of the launch button
  },

  /* ---------- CONTACTS ---------------------------------------------- */
  officers: [
    { role: "President", name: "Robert Lamoureux", phone: "603-635-3763" },
    { role: "Vice President", name: "Fred Rourke", phone: "603-401-0425", email: "derf3123@gmail.com" },
    { role: "Treasurer", name: "Nick Spanos", phone: "978-804-2697" },
    { role: "Trail Master", name: "Mike Andre", phone: "603-234-4066" },
    { role: "Community Relations", name: "Dave Curto", phone: "772-370-2985", email: "pelhamborderriders@gmail.com" },
    { role: "Secretary", name: "Position open", open: true }
  ],
  email: "pelhamborderriders@gmail.com",
  mail: "PO Box 644, Pelham NH 03076",
  facebook: "https://www.facebook.com/Pelham.Border.Riders",
  shopUrl: "https://www.borderridersofpelham.com/shop",

  /* ---------- PHOTOS -------------------------------------------------
     img: a file in assets/photos/ (e.g. "assets/photos/bridge.jpg") or a web address.
     To add a photo: drop the file in assets/photos/ and add a line below.   */
  logo: "assets/photos/club-logo.jpg",
  crewPhoto: "assets/photos/bridge-crew.jpg",
  photos: [
    { img: "assets/photos/fresh-grooming-through-the-pines.jpg", cap: "Fresh grooming through the pines", tall: true },
    { img: "assets/photos/sleds-on-a-club-built-bridge.jpg", cap: "Sleds on a club-built bridge" },
    { img: "assets/photos/share-the-trail-with-the-groomer.jpg", cap: "Share the trail with the groomer" },
    { img: "assets/photos/volunteers-clearing-the-trail.jpg", cap: "Volunteers clearing the trail" },
    { img: "assets/photos/a-finished-bridge-ready-for-winter.jpg", cap: "A finished bridge, ready for winter", tall: true },
    { img: "assets/photos/cutting-deadfall-after-a-storm.jpg", cap: "Cutting deadfall after a storm" },
    { img: "assets/photos/loaded-up-for-a-trail-work-day.jpg", cap: "Loaded up for a trail work day" },
    { img: "assets/photos/testing-a-new-crossing.jpg", cap: "Testing a new crossing" },
    { img: "assets/photos/rerouting-a-trail-the-right-way.jpg", cap: "Rerouting a trail the right way", tall: true },
    { img: "assets/photos/first-snow-last-minute-trail-work.jpg", cap: "First snow, last-minute trail work" },
    { img: "assets/photos/the-club-banner-flying-at-the-legion.jpg", cap: "The club banner flying at the Legion" },
    { img: "assets/photos/the-fall-meet-greet-kick-off-party.jpg", cap: "The fall Meet & Greet kick-off party" }
  ],

  /* ---------- TRAIL PROJECTS (shown in "What we do") ---------------- */
  projects: [
    "Bob's Bridges: double rebuild",
    "Zig Zag Hill reroute",
    "Stonepost Crossing & Poplar Hill reroute",
    "Spring St. crossing reroute",
    "Garland Woods & Shepard Fields reroute"
  ],

  /* ---------- SHOP (featured items; all link to the club shop) ------ */
  shop: [
    { name: "2027 NHSA Super Raffle ticket", price: "$20", img: "assets/shop/2027-nhsa-super-raffle-ticket.jpg", url: "https://www.borderridersofpelham.com/product-page/2027-nhsa-super-raffle-20" },
    { name: "Black hooded sweatshirt", price: "From $50", img: "assets/shop/black-hooded-sweatshirt.jpg", url: "https://www.borderridersofpelham.com/product-page/black-hooded-sweatshirt" },
    { name: "Orange long sleeve tee", price: "From $25", img: "assets/shop/orange-long-sleeve-tee.jpg", url: "https://www.borderridersofpelham.com/product-page/orange-long-sleeve-t-shirt" },
    { name: "Hot pink cuffed beanie", price: "$20", img: "assets/shop/hot-pink-cuffed-beanie.jpg", url: "https://www.borderridersofpelham.com/product-page/hot-pink-folded-cuff-beenie-hat" }
  ],

  /* ---------- SPONSORS ---------------------------------------------- */
  sponsors: [
    ["Enterprise Bank", "https://www.enterprisebanking.com/"],
    ["Plaistow Powersports", "http://www.plaistowpowersports.com/"],
    ["Nault's Windham", "http://www.naultswindham.com/"],
    ["Spanos Electric", "http://spanoselectricgc.com/"],
    ["Pelham House of Pizza", "http://pelhamhouseofpizza.com/"],
    ["Brando's Pizza", "http://www.brandospelham.com"],
    ["Xpress Pizza of Pelham", ""],
    ["Russell Hilbert Auto Body", ""],
    ["Neal's Collision Center", ""],
    ["Jeff Potvin Plumbing & Heating", ""],
    ["Burgess Plumbing", "http://burgessplumbingma.com/"],
    ["Joyful Hair Designs", ""],
    ["Grand Rental", "http://www.grandrentalnh.com/"],
    ["Wharf Industries", "http://www.wharfindustries.com/"],
    ["B&H Oil", "http://www.bandhoil.com/"],
    ["RGA Tire", "http://www.rgatire.com/"],
    ["Mack Stud", "http://www.mackstud.com/"],
    ["M&G Accounting", "http://www.mandgaccounting.com/"],
    ["Discount Madness", "http://www.discountmadness.net/"],
    ["World Famous State Line Market", ""],
    ["Lowell Amusement", ""],
    ["Gage Store", ""],
    ["M&D", ""]
  ],

  /* ---------- TRAIL MAP SETTINGS -------------------------------------
     The club's printed town map (2022) crosses out some trails. They are
     drawn as grey dashes, from two sources:
       1. segments marked  note: "closed2022"  in the trail file itself
       2. the two northern areas boxed below, each [west, south, east, north]
     When the club confirms what is open, remove boxes (or use  []  for none). */
  unconfirmedZones: [
    [-71.380, 42.7480, -71.336, 42.775],
    [-71.336, 42.7405, -71.300, 42.775]
  ]
};

/* ---- helpers shared by the home page and the trail map (no need to edit) ---- */
window.PBR_TRAIL_KIND = function (f) {
  var p = f.properties || {}, g = f.geometry;
  var line = g.type === "LineString" ? g.coordinates : g.coordinates[0];
  var mid = line[Math.floor(line.length / 2)];
  if (p.note === "closed2022") return "unconfirmed";
  var zones = window.PBR.unconfirmedZones || [];
  for (var i = 0; i < zones.length; i++) {
    var z = zones[i];
    if (mid[0] >= z[0] && mid[0] <= z[2] && mid[1] >= z[1] && mid[1] <= z[3]) return "unconfirmed";
  }
  if (p.kind === "powerline") return "powerline";
  if (p.kind === "pipeline") return "pipeline";
  if (p.note === "pond" || p.mapColor === "yellow") return "crossing";
  if (p.mapColor === "red") return "caution";
  if (p.mapColor === "green") return "connector";
  return "trail";
};
window.PBR_KINDS = {
  trail:       { label: "Club trail",            color: "#ff6a13" },
  connector:   { label: "Connector",             color: "#16a34a" },
  crossing:    { label: "Pond or wet crossing",  color: "#eab308" },
  caution:     { label: "Marked red on club map", color: "#ef4444" },
  powerline:   { label: "Powerline",             color: "#7c3aed" },
  pipeline:    { label: "Pipeline",              color: "#0891b2" },
  unconfirmed: { label: "Crossed out on 2022 club map",         color: "#64748b", dash: "6 7" }
};
window.PBR_TRAIL_STYLE = function (f, weight) {
  var k = window.PBR_KINDS[window.PBR_TRAIL_KIND(f)];
  return { color: k.color, weight: weight || 4, opacity: k.dash ? 0.8 : 0.95, dashArray: k.dash || null, lineCap: "round", lineJoin: "round" };
};
/* Wix can resize its own images; other images are used as they are. */
window.PBR_IMG = function (url, w, h) {
  return /static\.wixstatic\.com\/media\//.test(url) ? url + "/v1/fill/w_" + w + ",h_" + h + ",al_c,q_82/p.jpg" : url;
};
