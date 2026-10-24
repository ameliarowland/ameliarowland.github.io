---
title: "Amtrak direct route explorer"
description: "Pick a station, explore direct destinations, and see scheduled train travel times without transfers."
date: 2026-10-21
image: /maps/amtrak-direct-route-explorer.svg
embedUrl: https://ameliarowland.github.io/amtrak-direct-route-explorer/
externalUrl: https://ameliarowland.github.io/amtrak-direct-route-explorer/
tallEmbed: true
mobileTallEmbed: true
tools: [MapLibre GL JS, GeoJSON, Python, JavaScript]
tags: [rail, transportation, travel-time, web-gis]
---

Enter or choose stations in the left panel to update results automatically, or use the **+** beside a station: the first adds Start and the second adds End. A selected station shows **−** to remove it. You can also enter End first in the left panel to explore direct origins. Once both endpoints are selected, the map shows the intervening stops on trains that serve that pair. The left panel lists the fastest scheduled time for each direct service; hovering another station previews its direct connections. A small label shows the station name and code; journey times appear in the left panel.

The map draws the rail network in a single color. Station badges default off and appear when a route is hovered or selected; hovering one of those stations previews every station and route reachable without changing trains. The matching Stations button in the right-side control stack shows all stations. Small markers have a larger invisible selection area, and nearby overlaps resolve to the closest station. Choosing an endpoint reveals its direct stations without changing the all-stations toggle. Clearing an endpoint restores the broader set of direct destinations or origins. The URL retains endpoints, route, and station visibility. Its former display-mode parameter is ignored.

## Timetable and coverage

Times come from the retained [Amtrak GTFS timetable](https://content.amtrak.com/content/gtfs/GTFS.zip), feed `20261011`, for **October 12–18, 2026**. These are scheduled elapsed times from origin departure to destination arrival, including intermediate stops. The timetable snapshot is not a live departure board or a booking service.

Each connection must occur on a single active GTFS trip, in the correct direction, with boarding allowed at the origin and alighting allowed at the destination. Different trips sharing a service name never create an inferred direct connection. Service calendars and calendar exceptions are applied. GTFS times use the agency time zone and may exceed 24:00 for overnight trips. The left panel retains the source trip, train number, and service dates for inspection.

The explorer includes the Amtrak train services present in this feed; commuter-agency and bus services are excluded. Some inventory routes and stations have no trip in this particular timetable week. Their mapped presence does not imply that a scheduled direct train is available, and travel times are never inferred from route distance. Frequency, delays, fares, transfers, and station access time are outside this explorer.

## Map sources

The schematic derives from the [BTS / NTAD Amtrak routes](https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Amtrak_Routes/FeatureServer/0) and [train station inventory](https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Amtrak_Stations/FeatureServer/0). Straight segments show service relationships, not precise track alignment. Shared track is drawn once; hovering or selecting a service highlights its route. Light and Dark buttons switch between [OpenFreeMap](https://openfreemap.org/) Positron and Fiord basemaps, using OpenStreetMap data.

This is a separate rail-only app derived from the Rail vs. Air explorer. Its [source and data](https://github.com/ameliarowland/ameliarowland.github.io/tree/main/public/amtrak-direct-route-explorer) contain no flight comparison dependency. A compact trip-based timetable supports all direct rail searches independently of the older comparison dataset.
