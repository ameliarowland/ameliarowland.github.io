---
title: "When the train can compete with the plane"
description: "An interactive look at direct Amtrak journeys, nonstop flights, and the three hours a flight can hide."
date: 2026-10-11
image: /maps/rail-vs-air.svg
embedUrl: https://ameliarowland.github.io/rail-vs-air/
externalUrl: https://ameliarowland.github.io/rail-vs-air/
tallEmbed: true
mobileTallEmbed: true
tools: [MapLibre GL JS, GeoJSON, Python, JavaScript]
tags: [rail, transportation, travel-time, web-gis]
---

## A short flight is only part of the trip

A one-hour flight sounds faster than a three-hour train ride. But that comparison starts when the airplane leaves the gate and ends when it arrives. It leaves out the time spent arriving early, getting through the airport, and leaving after landing.

This map asks a specific question: **where can a direct Amtrak journey compete with a nonstop flight when we add three hours to the flight?** The allowance is a scenario assumption: two hours before departure and one hour after arrival. It is not a measurement of every airport experience.

The default setting includes trains that take no more than one hour longer than that adjusted flight time, including trains that are faster. Move the slider to zero to see only trains that are as fast as, or faster than, the adjusted flight. Search a station, select a service, and open a journey to inspect its evidence.

## What the data show

The October 11, 2026 build matches **4,107 directed service-and-station comparisons**. At the default one-hour tolerance, **1,453 qualify, across 33 train services**. These counts include both travel directions and multiple services between the same stations. They are not counts of distinct city pairs, bookable departures, or entire routes.

Here are five examples in one direction. Rail is the fastest eligible direct train in the timetable week. Air is the lowest median scheduled duration among the candidate airport pairs, plus three hours.

| Train journey | Service | Rail | Nonstop flight | Flight + 3 hours | Airport pair |
| --- | --- | --- | --- | --- | --- |
| New York Penn → Boston South | Acela | 3h 55m | 1h 24m | 4h 24m | EWR → BOS |
| New York Penn → Washington Union | Acela | 2h 59m | 1h 23m | 4h 23m | HPN → DCA |
| Chicago Union → Milwaukee | Hiawatha Service | 1h 39m | 0h 50m | 3h 50m | MDW → MKE |
| Los Angeles Union → San Diego | Pacific Surfliner | 2h 54m | 1h 00m | 4h 00m | LAX → SAN |
| Seattle → Portland | Amtrak Cascades | 3h 25m | 1h 05m | 4h 05m | SEA → PDX |

The airport choice matters. For example, HPN is Westchester County Airport, about 42.7 km in a straight line from New York Penn Station. Its inclusion follows the explicit 50 km rule; it does not mean that getting there is quick or that it is the airport a traveler would choose. Open each comparison to see both airport distances and the number of flights contributing to its median.

These are **snapshot comparisons, not a trip planner**. The trains and flights come from different periods. A July flight record is not evidence that the same flight operates on the date of an October train.

## Building the comparison

### Train times

The rail source is [Amtrak’s public GTFS timetable archive](https://content.amtrak.com/content/gtfs/GTFS.zip), feed version `20261011`. Its declared week is **October 12–18, 2026**. The analysis uses rail services with `route_type = 2`, includes the feed’s commuter services (MARC and Shore Line East), and checks each trip’s service calendar within that week.

MARC and Shore Line East contribute **262 direct commuter station pairs**. Their fastest scheduled train times and source trip identifiers are available in the [commuter journey data](/rail-vs-air/data/commuter-journeys.json). None currently match a nonstop flight pair in the retained flight data under the 50 km airport rule. Their absence from the matched comparison results reflects missing flight matches, rather than a commuter-service exclusion. This feed does not cover every U.S. commuter agency.

For every eligible pair of stops on a direct train, elapsed time is the destination arrival minus the origin departure. Pickup and drop-off restrictions are checked. Times follow the [GTFS schedule time conventions](https://gtfs.org/documentation/schedule/reference/#stop_timestxt): the agency time zone governs stop times, and overnight times can exceed 24:00. Subtracting local station clock times across time zones would give incorrect results.

The analysis retains the fastest eligible direct trip for each service, origin station, and destination station. Its trip ID, train number, departure and arrival values, and operating dates remain in the downloadable evidence. No train speed is inferred from the mapped distance.

### Flight times

The flight source is [BTS Reporting Carrier On-Time Performance](https://www.transtats.bts.gov/DL_SelectFields.aspx?QO_fu146_anzr=b0-gvzr&gnoyr_VQ=FGJ), using the [July 2026 monthly archive](https://www.transtats.bts.gov/PREZIP/On_Time_Reporting_Carrier_On_Time_Performance_1987_present_2026_7.zip). This build uses **631,970 records with positive scheduled elapsed times**.

`CRSElapsedTime` provides scheduled gate-to-gate duration in minutes. The analysis takes its median for each directed airport pair. Because the question concerns scheduled time, flights that were later canceled or diverted still contribute when their scheduled duration is present. The result does not describe reliability. BTS’s [reporting directive](https://www.bts.gov/explore-topics-and-geography/modes/aviation/number-40-technical-directive-reporting-time) defines the reporting framework; this table is not a census of every airline or every possible itinerary.

Airport coordinates come from the [OurAirports open dataset](https://ourairports.com/data/). Candidate U.S. airports must appear in the flight data and lie within **50 km straight-line distance** of the respective station. Among airport pairs with a recorded nonstop flight, the analysis chooses the lowest median duration. Airport selection is automatic and disclosed, rather than an undocumented city-name match.

### The rule

```text
adjusted air time = median scheduled nonstop flight time + 180 minutes
qualifying journey = fastest direct train time ≤ adjusted air time + tolerance
```

The default tolerance is 60 minutes; the app allows 0–120 minutes. The three-hour airport allowance stays fixed.

## Drawing the network without hiding shared routes

The base network uses the requested [NTAD Amtrak Routes layer](https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Amtrak_Routes/FeatureServer/0). Colors follow `name`, whose published alias is `NAME`, with contrasting colors prioritized for services sharing track. The build contains 49 spatial route records. Silver Star and Floridian share one color and offset lane where they overlap, while both source names and geometries are retained. Amtrak [documents their service combination](https://www.amtrak.com/routes/silver-service-palmetto-train.html). This geographic inventory and the timetable are separate products, so their service names and coverage can differ. The documented join fixes the NTAD spelling “Lincol Service Missouri River Runner” and ignores case; it does not silently substitute another route for an unmatched service.

The [NTAD station layer](https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Amtrak_Stations/FeatureServer/0) is filtered with:

```sql
StnType = 'TRAIN'
AND StaType <> 'Curbside Bus Stop only (no shelter)'
```

That returns **560 station records**. The analysis uses NTAD stations with U.S. state or District of Columbia codes, supplemented by actual GTFS commuter stop coordinates for MARC and Shore Line East. The complete filtered station inventory is retained in the downloadable data; map circles indicate scheduled service.

Station symbols use actual GTFS stops during the retained timetable week. A hollow circle with a route-colored ring marks a scheduled stop; passing routes retain plain, continuous lines without a marker. Each stopping route has its own circle at every zoom; station markers are never thinned or aggregated. Where a route geometry cannot be associated, the actual station coordinate is retained rather than hiding the stop. Selecting a route highlights its stopping stations. Lancaster, Pennsylvania (LNC) is served by both Keystone Service and Pennsylvanian on every day of this timetable week.

The current map is a station schematic: straight segments connect stations along each route, including stations passed without a scheduled stop. Only scheduled stops receive circles. Every station associated with the original physical route is retained as a line vertex, including pass-through stations. Stations on another branch are not inserted into a bypassing route. Station adjacency follows the underlying branch connectivity; intermediate non-station junctions do not appear as drawing vertices. These segments show service relationships, not the precise physical alignment of the tracks. Journey times still come from the retained GTFS timetable; drawing straight segments does not change the time comparison.

The full-resolution NTAD and GTFS source snapshots remain available. Source gaps were checked across the full network; verified connectors follow existing NTAD track corroborated by the same service’s official GTFS shape. The [repair evidence](/rail-vs-air/data/source-gap-repairs.json) records those checks.

The compact schematic runs in a Web Worker and retains every scheduled station marker at every zoom. Its initial geometry payload is approximately 314 KB, and the map no longer downloads the full route or timetable-shape geometry to initialize. Shared routes use perpendicular screen-space offsets from each straight station-to-station segment. Their interstation strokes remain parallel with a constant gap at each zoom. Offset lines meet at their intersection where the same bundle continues; branch stations use short joins to the common station row. Station circles remain attached to these paths. Source points outside the track tolerance are inserted for the entire shared corridor, including pass-through services. Where source components end before a terminal, retained GTFS stop sequences establish schematic connections; inventory-only historical services retain explicitly marked schematic station links.

Some timetable trips lack usable clipped source shapes. They remain available in the results and CSV. Schematic highlighting uses the connected station graph where a complete route path is available; it is explicitly schematic rather than a replacement source shape.

## Read the gaps as gaps

The analysis checks 22,429 direct rail service/station/direction pairs; only 4,107 have a matched flight comparison under the airport rule. The rest are unclassified. Missing flights, airports outside the radius, unsupported airlines, or mismatched geography can all prevent a comparison. A thin route line or a missing result does not prove that the train is slower.

Neither mode includes travel between a home and its station or airport. Rail does not include an early-arrival allowance. Fares, transfers, frequency, delays, cancellations, baggage rules, and the usefulness of a particular departure time are outside this model. Comparing the fastest scheduled train with a median scheduled flight is deliberately a “could rail compete?” screen, not a typical door-to-door travel-time estimate.

Before booking, check both operators’ schedules and add access time for the actual endpoints of your trip.

## Edit and audit the project

The [GitHub source directory](https://github.com/ameliarowland/ameliarowland.github.io/tree/main/public/rail-vs-air) contains the app, map layers, comparison data, timetable evidence, and a manifest with source URLs and SHA-256 checksums. The article is Markdown in `src/content/maps/rail-vs-air.md`, and the [Python build script](https://github.com/ameliarowland/ameliarowland.github.io/blob/main/scripts/build-rail-air.py) documents the transformation.

The committed data are snapshots. Reloading the page does not silently replace them with a new schedule. Refreshing requires downloading the source files, rebuilding the comparisons, checking the output, and updating the article’s dates and findings together. Amtrak’s live archive changes over time, so reproducing the original build from raw inputs requires retaining that original archive.
