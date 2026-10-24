# Amtrak direct route explorer

Standalone static Astro/MapLibre app at `/amtrak-direct-route-explorer/`, with an article at `/maps/amtrak-direct-route-explorer/`. The existing Rail vs. Air app is unchanged.

- `app.js`: single-color map, automatic endpoint/results controls, always-visible station circles, name-only hover labels and train-only results.
- `model.js`: directional same-trip timetable queries, deduplicated track network and lightweight route highlighting. No schematic geometry worker or alternate display mode.
- `popup-placement.js`: adjacent name-label placement with simple edge containment.
- `styles.css`: compact controls, clear disclosure chevrons, station circles and small removal buttons.
- `data/`: compact routes, stations, active-trip timetable and provenance. No flight, airport, full-track or timetable-shape downloads.
- Rebuild with `python3 scripts/build-amtrak-explorer.py --gtfs /path/to/amtrak.zip`. The committed route/station snapshot is the input; no other app is needed.

Station circles are always visible on the route lines. Tapping an unselected eligible circle fills the next vacant endpoint, Start then End. Selected circles are filled and have persistent small minus controls that remove their exact endpoint. Hover shows the station name only. No station visibility toggle or plus action remains. Direct train paths are highlighted after selection; unreachable circles stay visible but muted, and cannot be added to the active journey. Both endpoints highlight the intervening route segments on actual direct trains. All journey times are in the left panel.

Circle hit targets remain larger than the visible symbols (18 px mouse radius, 22 px coarse pointer radius). Nearby targets resolve to the nearest station. Legacy station visibility parameters are ignored and removed from canonical shared URLs. Valid input updates results automatically; partial edits clear stale pairs without overwriting typed text.

Validation: `node scripts/test-amtrak-explorer.mjs`, `node scripts/test-amtrak-display.mjs`, `node scripts/test-amtrak-auto-results.mjs`, `node scripts/test-amtrak-popup-placement.mjs`, `python3 scripts/test_amtrak_builder.py`, and `npm run build`.
