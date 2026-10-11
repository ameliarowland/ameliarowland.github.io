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

Shared NTAD edges are keyed by rounded coordinates before simplification. The straightest continuations at junctions form corridors whose drawing direction is fixed across bends and changes in route membership. Routes keep a consistent order within the centered lanes. Pixel offsets increase with zoom. GTFS highlights inherit the nearby NTAD lane for the same named route using a spatial segment lookup (within about 1.7 km), adjusted for travel direction. Highlights without a matching reference use continuous shared-corridor lanes. This controls display offsets only, without changing travel times or replacing GTFS geometry; nearby but differently sampled/digitized lines may not share an edge. Simplified geometry and lane changes can produce small junction gaps. Unusable journey shapes are not replaced with straight lines. The results disclose missing geometry.

## Refresh

Python 3 standard library is sufficient. Keep downloads outside the Git checkout because they are large and the live Amtrak feed changes. Do not overwrite an old raw snapshot if exact reproduction is needed.

```sh
python3 scripts/download-rail-air.py --output-dir /path/to/new-snapshot --flight-period 2026-07
python3 scripts/build-rail-air.py --input-dir /path/to/new-snapshot --flight-period 2026-07 --as-of 2026-10-11
node scripts/test-rail-air.mjs
npm ci
npm run build
```

Choose the actual available flight month and retrieval date. Update article findings, examples, dates, and limitations along with the data. The Python build writes all generated data including timetable evidence. Inspect the airport assignments; a 50 km radius can include airports that travelers would not choose. Changing the radius requires rebuilding, not just editing the manifest.

## Verification

The initial Astro production build passed. The Node audit checks every committed rail duration against retained stop-time evidence, service date bounds, airport distances, station filters, shape ranges, classification boundaries, reversed-direction lane behavior, bends, and alignment between base and highlight lanes. Raw BTS medians are independently checked before the initial PR. Browser preview access was declined in the development session, so interactive rendering and mobile layout have not been browser-verified.

MapLibre GL JS 5.6.0 loads from unpkg; the basemap uses standard OpenStreetMap raster tiles (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`) without an API key, account, or token. The OSM tiles are darkened in MapLibre using raster paint settings; no additional tile provider or API is needed. Stations use crisp white centers and two blurred halo layers, and route colors are brightened for contrast. Browser caching and visible attribution follow the [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/). The source-data results and CSV can still work if the map library or basemap is unavailable. Attribution appears on the map. The data are not live booking information and do not include ground access, early station arrival, frequency, fares, or delay risk.
