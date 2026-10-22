# Amtrak direct route explorer

Standalone static Astro/MapLibre app at `/amtrak-direct-route-explorer/`, with an article at `/maps/amtrak-direct-route-explorer/`. The existing Rail vs. Air app is unchanged.

- `app.js`: map, endpoint controls, station popups and train-only results.
- `model.js`: same-trip, directional timetable queries and station placement.
- `schematic.js`, `parallel-corridors.js`, `layout-worker.js`: retained rail geometry engine, run without station enclosures; no airport or comparison code.
- `styles.css`: app-specific appearance and two route display buttons.
- `data/`: compact routes, stations, active-trip timetable and provenance manifest. No flight, airport, full track, or timetable-shape downloads.
- `scripts/build-amtrak-explorer.py`: rebuild with `python3 scripts/build-amtrak-explorer.py --gtfs /path/to/amtrak.zip`, using the committed rail schematic/inventory as input. No other app is needed. Active calendars, exceptions, pickup/drop-off restrictions, and GTFS overnight times are preserved. Commuter agencies and bus trips are excluded.

Selecting one endpoint shows only direct origins/destinations from actual trips. Selecting both shows intermediate stations on trips serving the selected pair. Results retain the fastest actual trip per service and its evidence. Trip durations do not depend on any air comparison. Missing scheduled service is explicitly unavailable.

Validation: `node scripts/test-amtrak-explorer.mjs`, `python3 scripts/test_amtrak_builder.py`, and `npm run build`.
