# Amtrak direct route explorer

Standalone static Astro/MapLibre app at `/amtrak-direct-route-explorer/`, with an article at `/maps/amtrak-direct-route-explorer/`. The existing Rail vs. Air app is unchanged.

- `app.js`: map, endpoint controls, station popups and train-only results.
- `model.js`: same-trip, directional timetable queries and station placement.
- `schematic.js`, `parallel-corridors.js`, `layout-worker.js`: retained rail geometry engine, with the existing hub rectangle layout; no airport or comparison code.
- `styles.css`: app-specific appearance and two route display buttons.
- `data/`: compact routes, stations, active-trip timetable and provenance manifest. No flight, airport, full track, or timetable-shape downloads.
- `scripts/build-amtrak-explorer.py`: rebuild with `python3 scripts/build-amtrak-explorer.py --gtfs /path/to/amtrak.zip`, using the committed rail schematic/inventory as input. No other app is needed. Active calendars, exceptions, pickup/drop-off restrictions, and GTFS overnight times are preserved. Commuter agencies and bus trips are excluded.

Selecting one endpoint shows only direct origins/destinations from actual trips. Selecting both shows intermediate stations on trips serving the selected pair. Results retain the fastest actual trip per service and its evidence. Trip durations do not depend on any air comparison. Missing scheduled service is explicitly unavailable.

Validation: `node scripts/test-amtrak-explorer.mjs`, `node scripts/test-amtrak-display.mjs`, `node scripts/test-amtrak-auto-results.mjs`, `node scripts/test-amtrak-popup-placement.mjs`, `python3 scripts/test_amtrak_builder.py`, and `npm run build`.

Multi-color retains the Chicago, New Orleans, New York, Los Angeles, Washington and Springfield rectangles, including colored through-connections on route focus. Ordinary station bars are not rendered. Single-color has no enclosures. The Stations button independently controls train badges and hit targets; rectangle outlines remain part of the multi-color route drawing.

Station badges default off. Hovering or selecting a route reveals that route’s stops, independently of the all-stations switch. Choosing an endpoint enables the station layer and filters it to direct origins/destinations. The URL preserves an explicitly enabled all-stations layer with `stations=on`.

Endpoint suggestions update results automatically as valid stations are entered or selected. No submit/search button is needed. Partial input clears stale endpoint results without overwriting the text being typed. Station popups use measured side placement with route/control avoidance, a smaller 230 px card, and a sliding pointer.
