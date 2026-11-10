# Pelham Border Riders — New Website

A fast, mobile-first static site. No Wix and no monthly fees. Hosting is free on Netlify, Cloudflare Pages or GitHub Pages.

## Files
| File | What it is |
|---|---|
| `index.html` | Home page: status, conditions, the club, GPS app, join, events, photos, parking, shop, sponsors, officers |
| `map.html` | Full-screen trail map: live GPS, nearest trail, speed, trail search, parking pins, satellite view |
| `assets/site-config.js` | **The only file officers need to edit.** Status, events, officers, parking, photos, shop, sponsors |
| `assets/style.css`, `assets/main.js` | Design and behavior |
| `data/trails.geojson` | Trail lines (shared with the Border Riders GPS app) |
| `site.webmanifest`, `assets/icon.svg` | Lets riders add the trail map to their phone's home screen |
| `404.html` | "Off the trail" page for bad links |

## Updating trail status (30 seconds)
Open `assets/site-config.js` and change `overall: "closed"` to `"open"` or `"limited"`. Update `note` and `updated`, and set each area's `status`. Then re-upload.

Monthly meetings (3rd Wednesday) show up on the calendar automatically, each with an "Add to calendar" button. Add one-off events, such as trail work days, to `events`.

## GPS app integration
- `map.html` already works as a GPS trail map in any phone browser. It reads the same `data/trails.geojson` the GPS app produces.
- The app lives in the `ride/` folder and `gpsApp.ready` is `true`, so the "GPS App" section shows **Launch the GPS app**. To update the app, replace the contents of `ride/` with the new build (and bump `VERSION` in `ride/sw.js` so phones pick it up).
- To refresh the trails, copy the app's latest trail GeoJSON over `data/trails.geojson`.
- The club's printed map (2022) crosses out some trails. The website map draws those as grey dashes. The app currently flags only the short red segments, not the two northern areas, so the two maps differ there until the app is updated.

## Where it is hosted
The site and the GPS app (in `ride/`) are published free with GitHub Pages from this repository:

**https://johnfudala-a11y.github.io/pelham-border-riders/**

Any change pushed to the `main` branch is live about a minute later.

## Going live on the club's domain
1. In this repository: Settings, Pages, Custom domain. Enter `www.borderridersofpelham.com` and save.
2. Where the domain is registered (currently managed through Wix), point `www` at `johnfudala-a11y.github.io` with a CNAME record. GitHub's Pages help lists the records for the bare domain.
3. Tick "Enforce HTTPS" once GitHub finishes the certificate.
4. In `index.html`, change the two `og:` addresses near the top to the club's domain so text-message previews show the right link.

Do this only after the shop question below is settled.

## Before cancelling Wix
The photos, logo and printable map PDFs are now saved inside this site (`assets/photos/`, `assets/shop/`, `assets/maps/`), so they no longer depend on Wix.

Only the **shop** still lives on Wix. Move it to Square, Shopify Starter or similar, then update `shopUrl` and the `shop` list in `site-config.js`. Until then, keep the Wix plan or the shop links will break.

## What was checked, and what the club should still confirm
- **Meeting place:** American Legion Post 100 is at **32 Windham Rd** (town assessor, IRS filing and OpenStreetMap agree; the club's old footer and a flyer say 8).
- **Goat Pit parking:** the sand pit at the end of Tina Ave (15 Tina Ave), from the club's own parking map. The map pin is approximate.
- **Costa parking:** the town lot at the end of Frontier Dr, off Dutton Rd. The map pin is approximate.
- **Membership price:** not published anywhere public. The state portal shows it only after sign-in. Put it in `membership.price` and the site will show it.
- **Still to confirm:** officer phone numbers (Dave Curto's has a Florida area code), whether the Cutler-Spalding lot is still open to sleds (two lots on the west side are crossed out on the 2022 map), and which northern trails are open.
