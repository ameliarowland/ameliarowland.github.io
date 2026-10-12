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

Airports are candidates within 50 km straight-line distance of each station, not a manually verified metropolitan airport assignment. All positive `CRSElapsedTime` records contribute, including later cancellations/diversions. Rail trips must run within the declared GTFS week and allow pickup/drop-off. All rail services in the retained feed are eligible, including MARC and Shore Line East. Their additional comparison endpoints use actual GTFS stop coordinates. Bus services, non-U.S. stations, connecting trains, and connecting flights are excluded. Do not interpret unmatched pairs as slower trains.

The initial sources are train feed 20261011 (service October 12–18, 2026) and BTS July 2026 (631,970 valid scheduled durations). `manifest.json` records coverage and checksums. `gtfs-evidence.json` retains the original selected-trip stop times, trips, agency time zones, calendars, stops, route records, and feed metadata. `comparisons.json` retains trip IDs, service dates, selected airports, sample sizes, and medians. This evidence audits the selected train times; reproducing the fastest-trip search and flight aggregation requires the original raw downloads.

The NTAD station filter is exactly `StnType = 'TRAIN' AND StaType <> 'Curbside Bus Stop only (no shelter)'`. The route alias NAME is the field `name`. Case-insensitive name joins and the source spelling `Lincol Service Missouri River Runner` are handled explicitly. Other mismatches are not invented. Map network membership comes from NTAD; thick comparison geometry comes from GTFS.

Shared NTAD edges are keyed by rounded coordinates before simplification. Junction continuations prioritize shared service membership and then the straightest angle, so a through-service bundle keeps its direction when a station spur branches off. Lane spacing is centered on only the services present on each track section; no space is reserved for distant services. Shared centerlines are simplified once for all services; routes are emitted as continuous paths where lane membership is unchanged.

Shared-track topology is prepared with Shapely 2.1.2 / GEOS, noding source intersections at a 1e-7 degree precision grid and matching source service membership within 2e-6 degrees. The original centerline vertices are retained without simplification. The app constructs projected-pixel offsets with the Leaflet.PolylineOffset engine. Adjacent same-service sections are assembled into continuous paths before offsetting, with short smoothed lane transitions; genuine source gaps remain. Every junction and every original source section is retained; no source-section suppression or tail trimming is applied. Branch nodes pair through continuations by shared bundle size and direction, without imposing contradictory constraints on every arm. Qualifying strokes are clipped from the final displayed network, so they cannot introduce an independently offset line. Full station spacing, opaque colors, and the zoom-dependent bundle-width cap are retained. These operations affect display geometry only, not travel times.

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

MapLibre GL JS 5.6.0 loads from unpkg; the basemap uses standard OpenStreetMap raster tiles (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`) without an API key, account, or token. The OSM tiles are darkened in MapLibre using raster paint settings; no additional tile provider or API is needed. Stations use hollow route-colored stop circles, and route colors are brightened for contrast. Browser caching and visible attribution follow the [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/). The source-data results and CSV can still work if the map library or basemap is unavailable. Attribution appears on the map. The data are not live booking information and do not include ground access, early station arrival, frequency, fares, or delay risk.

Overlapping routes use separate parallel lanes, including at stations. With no route selected, route-colored circles identify scheduled stops. Selecting a route shows circles only at its scheduled stops, using all active trips in the retained GTFS week. Passing trains do not get a dot. Every scheduled stop for the selected route remains visible at every zoom; no markers are culled or clustered.

Silver Star and Floridian retain separate source names and geometries but share the Floridian color and a single offset slot on overlapping track. All 49 NTAD names, including Capitol Limited, remain in the data. The combined legend entry reads “Floridian / Silver Star”; this is a symbology grouping, not an additional scheduled service or an alteration of timetable evidence. [Amtrak documents the service combination](https://www.amtrak.com/routes/silver-service-palmetto-train.html).

Routes separate more at regional zooms from 7 onward, with wider spacing as you zoom closer. Clicks query a 9-pixel area around the pointer; crowded hits open explicit route choices. The selected route has a thin white outline and a visible name label. The map starts with no selection, including when URL comparison filters are restored. Clicking anywhere outside explicit route/journey selection controls clears the selection without changing comparison filters; the clearing click does not immediately reselect a nearby line. Build-time and zoom-dependent geometry simplification are disabled; MapLibre GeoJSON tolerance is zero. Station projections are inserted into source edges and retained as anchors; all routes sharing an edge use those same anchors and simplification vertices. Station dots are attached to the final rendered route lines.

**Required behavior: never omit a selected route’s scheduled stops at any zoom.** Checks compare each selected service’s complete stop set at zooms 3, 7.9, 13 and 16, including Lancaster and Aberdeen. Station anchors are retained through simplification and rendered exactly on associated lines. Stations without a matching source track remain at their real coordinates rather than being hidden.

Stop-circle centers use `#3d3f42`, sampled from the supplied state-background reference, at both overview and detailed zooms. Their outlines match the route color.

Parallel-route colors are assigned using shared-track conflicts and perceptual color distance rather than sequential hues. Silver Star and Floridian retain their intentional combined color. All original source sections are retained; destructive suppression and tail trimming are disabled. Original source snapshots and timetable evidence remain intact.

Lane ordering is controlled by `DISPLAY_ROUTE_PRIORITY` in the data builder and recorded as `routeLanePriority` in the manifest. Pennsylvanian has first priority, followed by Keystone Service on the west/north side of shared corridors. Remaining services retain alphabetical order, and shared direction frames preserve the lane order through bends.

Every topological junction is a protected vertex during data-build simplification. The source/display connected-component audit verifies all 49 routes. Timetable stop membership is independent of this display geometry.

Source gaps are checked across all routes. Verified connectors follow track already in the NTAD layer and must be corroborated by the same service’s official GTFS shape within 100 m. `source-gap-repairs.json` records the coordinates, length and evidence for each connector. One candidate without usable GTFS evidence is left unchanged. This does not add scheduled stops or change journey times.

Through-corridor direction constraints are resolved before branch constraints. Centered single-route sections do not carry a lane frame into other bundles. Geographic priority is then applied to the local shared lane order, avoiding a whole-corridor reversal at Philadelphia 30th Street.

Additional documented source display repairs: Palmetto near Philadelphia 30th Street and Vermonter near New Haven follow existing shared source track between exact section endpoints. The Northeast Regional New Haven branch connectors are protected from cleanup. Original Keystone geometry, including its spur and west-approach endpoint, is retained. Timetable membership and retained original sources remain unchanged.

Pennsylvanian’s scheduled Philadelphia stop is represented by extending its display onto the existing shared NEC station approach. Its original NTAD junction connection is retained. Both Pennsylvanian and Keystone station-circle positions are checked against their rendered lines at country and close zoom levels.

Pennsylvanian and Keystone station branches end at the Philadelphia station projection. Into New York, the five Hudson/Manhattan services (Adirondack, Empire Service, Ethan Allen Express, Lake Shore Limited, Maple Leaf) retain outer lane priority above Pennsylvanian between stations.

The app uses the actual [Leaflet.PolylineOffset engine](https://github.com/bbecquet/Leaflet.PolylineOffset), vendored unmodified with its MIT license. A small worker-safe shim supplies the engine’s bind/prototype hooks; MapLibre continues to draw the resulting screen-offset geometry and provides the basemap, controls and hit testing. Native circular joins handle ordinary bends. The adapter handles changing service bundles, numerical near-collinear anchors, station retention and same-route junction connections. Custom centerline smoothing, loop rewriting and terminal-fan reshaping have been removed.

`optimizeLaneOrder` builds shared-edge membership and branch-side preferences, then uses improving adjacent swaps to reduce a weighted crossing objective. It preserves the requested Pennsylvanian/Keystone and southern service priorities. This is a heuristic, not a proof of a globally optimal network drawing. Source geometry and timetable evidence remain unchanged. Checks cover every retained service/stop pair and every existing same-route rendered junction at zooms 3, 4, 7.9, 10, 13 and 16. Display repairs do not fabricate source connections or timetable service. Some crossings can remain at actual junctions or because priority constraints conflict.

Base route strokes are 2.4 pixels in overviews and 3.2 pixels at closer zoom, with wider selected/qualifying strokes. A Web Worker prepares the geometry and computes layouts after movement. It caches the two most recent view layouts and the qualifying-coverage index. Stale queued requests coalesce; the UI rejects stale results. Offscreen segments are omitted from the drawing payload with a margin, while every source vertex inside the view and every scheduled station marker is retained. Zoom animations scale lines and stations together.

`DISPLAY_ROUTE_SOUTHERN` groups Northeast Regional, Vermonter, and Acela in that order on the southern/outside slots between stations. Acela is outermost. Auto Train is excluded from the displayed network, comparisons, legend and stop symbols; original source snapshots retain it.

A fresh source audit identified the former simplification bug: through-corridor junction vertices could be omitted even though a branch ended there. The builder now protects every junction. Without extra display repairs, the shared-track build has exactly the same connected-component counts as the original for all 49 routes. Subsequent documented additions introduce no new disconnected components. Texas Eagle’s 233 m gap near Godfrey/Alton now follows existing source track, corroborated within 0.4 m by its GTFS shape. Pennsylvanian has one original and one displayed connected component. Older endpoint-proximity reports describe the former processed geometry and should not be treated as proof of gaps in the original source.

All retained commuter trips are eligible for analysis. `commuter-journeys.json` retains the 262 direct pairs and their fastest scheduled train evidence. MARC and Shore Line East have no matched nonstop flight comparisons under the current flight-data and airport rules; no flight duration is fabricated. `comparison-stations.json` supplements the NTAD comparison endpoints with actual GTFS commuter stop coordinates.

Current checks: `node scripts/test-rail-air.mjs` (all comparison/commuter timings), `node scripts/test-active-layout.mjs` (seven regions at four zooms, every station marker and rendered junction), `node scripts/test-layout-worker.mjs` (actual worker initialization and request coalescing), and `python scripts/test-route-connectivity.py --source /path/to/original/routes.geojson` (all source-route components). `node scripts/benchmark-layout.mjs` measures layout and cache timings with the default qualifying journeys. These are programmatic checks; browser visual verification remains separate.


## Current station schematic experiment

The active app loads `station-schematic.geojson`, generated by `node scripts/build-station-schematic.mjs` from the retained full-resolution route and station sources. It connects station nodes with straight segments, retains pass-through stations without stop circles, and follows branch connectivity without drawing non-station junction vertices. Missing scheduled-stop projections are inserted as mandatory station nodes. All 909 displayed scheduled station/service markers remain on their associated route lines at every zoom. Source snapshots and timetable values remain intact.

`schematic.js` constructs consistent station positions for each route and connects them directly, without circular offset joins or intermediate curves. The route graph also supports schematic journey and qualifying-coverage highlights. The active map does not fetch `routes.geojson` or `shapes.json` during startup. Previous geographic renderer details above describe the retained alternative, not the active schematic.

Validate the experiment with `node scripts/test-station-schematic.mjs` and `node scripts/test-layout-worker.mjs`.

The revised station graph passes through both Newark Penn (NWK) and Newark Airport (EWR) for all shared-corridor services. Only Keystone and Northeast Regional receive airport stop circles. All drawn endpoints must be inventory station codes. Station rows share a fixed diagonal screen direction; tests check that no pair of routes sharing a station segment crosses at zooms 4, 7.9, 12 and 16. Popups prefer the source `Name` field, falling back to `StationName` when `Name` is blank.

Schematic connectivity links derived from retained GTFS stop sequences carry `connectionEvidence` metadata. The inventory-only Illinois Zephyr terminal link is identified as a source-inventory schematic link; neither type modifies physical route snapshots, stopping membership or timetable times.

Overview styling uses thinner route strokes and smaller stop circles than close views. Hover chooses the closest actual route stroke within nine screen pixels, widens that service, and displays a non-interactive colored name bubble beside the cursor. Leaving the map, panning or clicking clears the hover. `scripts/test-route-hover.mjs` exercises nearest-stroke picking.

Schematic gap connectors join existing component station sequences rather than jumping between timetable stop endpoints and bypassing intermediate stations. Near-equivalent physical bypasses are removed from the schematic when another path through stations is within 20% of their source-track length. Silver Meteor follows DIL–FAY–SSM–WLN–RMT with no triangle or dangling spurs. Physical source snapshots and timetable evidence remain unchanged.

Chicago Union Station uses the requested west-to-east service order, from Borealis through Pere Marquette. Floridian / Silver Star share their existing lane. Pairwise order is carried along shared station segments until the services separate, so the Chicago adjustment does not introduce twists between stations or replace ordering on distant corridors.

The complete Chicago station order is explicitly retained through the first two station steps on every departing branch, including Hammond-Whiting and the New Buffalo / South Bend split. Only services present at each station receive a slot there.

On the shared North Carolina corridor, Crescent, Carolinian and Piedmont run north to south in that order. Floridian / Silver Star sits below Piedmont at Raleigh and Cary. These relative orders propagate through shared station segments until the services separate.

The build records `sourceStationPasses` from all original-track station projections, including stations without scheduled stops. Rendering tests require every displayed service's source pass-through station to remain a line vertex at all tested zooms. Stop-circle membership remains a separate timetable property. Contracted junctions can create artificial branch triangles; unused cycle links are removed only when retained timetable sequences establish the other connections, preserving every station and connected component. At Richmond, Staples Mill remains on the western through corridor; Main Street is the Newport News branch, and the artificial Main Street–Petersburg link is removed.

All stations allow modest stop-circle overlap: local lane spacing is capped at 88% of a circle's outer diameter. Every route marker remains present, retains its order and stays connected to its line.

Hammond–Whiting uses the requested north-to-south sequence: Pere Marquette, Blue Water, Wolverine, Lake Shore Limited, Capitol Limited, Floridian / Silver Star. Diagonal station rows now point northeast; scalar ordering compensates to preserve existing north-to-south preferences elsewhere and Chicago's west-to-east order.
