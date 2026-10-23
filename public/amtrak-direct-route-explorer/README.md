# Amtrak direct route explorer

Standalone static Astro/MapLibre app at `/amtrak-direct-route-explorer/`, with an article at `/maps/amtrak-direct-route-explorer/`. The existing Rail vs. Air app is unchanged.

- `app.js`: single-color map, automatic endpoint/results controls, station popups and train-only results.
- `model.js`: directional same-trip timetable queries, deduplicated track network and lightweight route highlighting. No schematic geometry worker or alternate display mode.
- `popup-placement.js`: nearby side placement, route/control avoidance and mobile containment.
- `styles.css`: compact controls, clear disclosure chevrons and station cards.
- `data/`: compact routes, stations, active-trip timetable and provenance. No flight, airport, full-track or timetable-shape downloads.
- Rebuild with `python3 scripts/build-amtrak-explorer.py --gtfs /path/to/amtrak.zip`. The committed route/station snapshot is the input; no other app is needed.

Station badges default off. Hovering or selecting a route reveals its stops, independently of the all-stations toggle. Choosing an endpoint enables directly reachable stations; choosing both restricts markers and hit targets to stops between them on actual direct trains. Valid input updates results automatically; partial edits clear stale pairs without overwriting typed text. Popups preview the fastest direct time before choosing the second station.

Visible station badges are smaller than their invisible selection targets (18 px radius for a mouse, 22 px for a coarse pointer). Nearby overlaps resolve to the closest station. Hover and selected endpoint badges remain slightly larger than other visible markers.

Validation: `node scripts/test-amtrak-explorer.mjs`, `node scripts/test-amtrak-display.mjs`, `node scripts/test-amtrak-auto-results.mjs`, `node scripts/test-amtrak-popup-placement.mjs`, `python3 scripts/test_amtrak_builder.py`, and `npm run build`.
