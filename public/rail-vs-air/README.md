# Rail vs. Air

An Astro/GitHub Pages project with a static MapLibre app and a Markdown article. No API keys or server backend. The app fetches committed snapshots; it does not query live schedules.

## Edit through GitHub

- Article: `src/content/maps/rail-vs-air.md`
- App markup: `src/pages/rail-vs-air/index.astro`
- App interactions: `public/rail-vs-air/app.js`
- Comparison/offset functions: `public/rail-vs-air/model.js`
- Appearance: `public/rail-vs-air/styles.css`
- Data/provenance: `public/rail-vs-air/data/`
- Thumbnail: `public/maps/rail-vs-air.svg` (a schematic illustration, not a geographic map)

After merging into `main`, the existing GitHub Pages workflow builds and deploys the article at `/maps/rail-vs-air/` and app at `/rail-vs-air/`. The article appears automatically in Maps and data stories. No deployment configuration is changed.

## Method and coverage

Default: fastest direct scheduled rail duration <= lowest median scheduled nonstop flight duration + 180 minutes + 60 minute tolerance. The airport overhead is fixed at the requested three hours. The tolerance slider ranges from 0 to 120 minutes. Search also matches station codes and airport codes; URL query parameters retain filters. CSV exports contain the currently filtered records and their source evidence.

Airports are candidates within 50 km straight-line distance of each station, not a manually verified metropolitan airport assignment. All positive `CRSElapsedTime` records contribute, including later cancellations/diversions. Rail trips must run within the declared GTFS week and allow pickup/drop-off. Generic Commuter Rail services, bus services, non-U.S. stations, connecting trains, and connecting flights are excluded. Do not interpret unmatched pairs as slower trains.

The initial sources are train feed 20261011 (service October 12–18, 2026) and BTS July 2026 (631,970 valid scheduled durations). `manifest.json` records coverage and checksums. `gtfs-evidence.json` retains the original selected-trip stop times, trips, agency time zones, calendars, stops, route records, and feed metadata. `comparisons.json` retains trip IDs, service dates, selected airports, sample sizes, and medians. This evidence audits the selected train times; reproducing the fastest-trip search and flight aggregation requires the original raw downloads.

The NTAD station filter is exactly `StnType = 'TRAIN' AND StaType <> 'Curbside Bus Stop only (no shelter)'`. The route alias NAME is the field `name`. Case-insensitive name joins and the source spelling `Lincol Service Missouri River Runner` are handled explicitly. Other mismatches are not invented. Map network membership comes from NTAD; thick comparison geometry comes from GTFS.

Shared NTAD edges are keyed by rounded coordinates before simplification. Junction continuations prioritize shared service membership and then the straightest angle, so a through-service bundle keeps its direction when a station spur branches off. Lane spacing is centered on only the services present on each track section; no space is reserved for distant services. Shared centerlines are simplified once for all services; routes are emitted as continuous paths where lane membership is unchanged.

Shared-track topology is prepared with Shapely 2.1.2 / GEOS, noding source intersections at a 1e-7 degree precision grid and matching source service membership within 2e-6 degrees. The common centerline is simplified once before assigning lanes. The app constructs projected-pixel offsets using tangents averaged over a bundle-sized window. Adjacent same-service sections are assembled into continuous paths before offsetting, with short smoothed lane transitions; genuine source gaps remain. Shorter same-service sections wholly inside a longer section’s 75 m corridor are suppressed for display, eliminating duplicate offset strokes such as those near Newark. Distinct branches outside that corridor are retained; the original snapshot and timetable evidence are unchanged. Branch nodes pair through continuations by shared bundle size and direction, without imposing contradictory constraints on every arm. Qualifying strokes are clipped from the final displayed network, so they cannot introduce an independently offset line. Full station spacing, opaque colors, and the zoom-dependent bundle-width cap are retained. These operations affect display geometry only, not travel times.

Qualifying coverage is transferred from GTFS journey sections to the same named NTAD route within a 750 m display tolerance, sampled along the NTAD path at intervals of at most 500 m. The thick strokes then reuse the base network's centerline and lane exactly, avoiding a second independently digitized path. This is an approximate display join, not a change to travel times, trip evidence, or qualification. The selected journey detail still shows its original GTFS path. Genuine rail junctions and differently digitized tracks can still diverge. Unusable journey shapes remain disclosed rather than replaced with invented straight rail lines.

## Refresh

Python 3 and the pinned Shapely dependency are required. Keep downloads outside the Git checkout because they are large and the live Amtrak feed changes. Do not overwrite an old raw snapshot if exact reproduction is needed.

```sh
python3 -m pip install -r scripts/rail-air-requirements.txt
python3 scripts/download-rail-air.py --output-dir /path/to/new-snapshot --flight-period 2026-07
python3 scripts/build-rail-air.py --input-dir /path/to/new-snapshot --flight-period 2026-07 --as-of 2026-10-11
python3 scripts/test-rail-topology.py
node scripts/test-rail-air.mjs
npm ci
npm run build
```

Choose the actual available flight month and retrieval date. Update article findings, examples, dates, and limitations along with the data. The Python build writes all generated data including timetable evidence. Inspect the airport assignments; a 50 km radius can include airports that travelers would not choose. Changing the radius requires rebuilding, not just editing the manifest.

## Verification

The initial Astro production build passed. The Node audit checks every committed rail duration against retained stop-time evidence, service date bounds, airport distances, station filters, shape ranges, classification boundaries, reversed-direction lane behavior, bends, and alignment between base and highlight lanes. Raw BTS medians are independently checked before the initial PR. Browser preview access was declined in the development session, so interactive rendering and mobile layout have not been browser-verified.

MapLibre GL JS 5.6.0 loads from unpkg; the basemap uses standard OpenStreetMap raster tiles (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`) without an API key, account, or token. The OSM tiles are darkened in MapLibre using raster paint settings; no additional tile provider or API is needed. Stations use hollow route-colored stop circles and thin no-stop ticks, and route colors are brightened for contrast. Browser caching and visible attribution follow the [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/). The source-data results and CSV can still work if the map library or basemap is unavailable. Attribution appears on the map. The data are not live booking information and do not include ground access, early station arrival, frequency, fares, or delay risk.

Station symbols follow the reference’s two categories. Every stopping route gets its own hollow circle with a route-colored ring and grey center. A known timetable route crossing a station without a stop gets a short perpendicular grey tick in a small dark break across its line. Unmatched legacy source routes are not classified as operating passing trains. There is no partial-service category. The visible map key and Legend panel explain both symbols. Classification uses all active train trips during the retained timetable week; popup text identifies the route and whether it stops. Terminal branches retain their own stopping circles.

Silver Star and Floridian retain separate source names and geometries but share the Floridian color and a single offset slot on overlapping track. All 49 NTAD names, including Capitol Limited, remain in the data. The combined legend entry reads “Floridian / Silver Star”; this is a symbology grouping, not an additional scheduled service or an alteration of timetable evidence. [Amtrak documents the service combination](https://www.amtrak.com/routes/silver-service-palmetto-train.html).

Routes separate more at zooms above 12. Clicks query a 9-pixel area around the pointer; crowded hits open explicit route choices. The selected route has a thin white outline and a visible name label. The map starts with no selection, including when URL comparison filters are restored. Clicking anywhere outside explicit route/journey selection controls clears the selection without changing comparison filters; the clearing click does not immediately reselect a nearby line. Overview display simplification permits 3 pixels at country-level zooms and fades to zero at zoom 13. Station projections are inserted into source edges and retained as anchors; all routes sharing an edge use those same anchors and simplification vertices. Stop circles and no-stop ticks are placed directly on their displayed route lanes.

Below zoom 7, stations use one small route-colored overview circle on an actual stopping lane. Markers stay 8–9 pixels apart on screen, with multi-service stations prioritized, to keep dense areas legible. No-stop ticks and per-route colored stop circles appear at zoom 7 and above. The complete station data and timetable memberships are retained; the legend explains the overview.

Stop-circle centers use `#3d3f42`, sampled from the supplied state-background reference, at both overview and detailed zooms. Their outlines match the route color.
