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

Tap the small circles along the route lines: the first station becomes Start, and the second becomes End. Selected circles fill in and show a small **−** beside them to remove that endpoint. Hovering shows only the station name. You can also enter or swap endpoints in the left panel, where direct train times and source evidence appear automatically.

Station circles are always visible. Selecting an endpoint highlights routes reachable on one train; stations outside the direct network stay visible but become muted and cannot be added to that journey. With both endpoints chosen, the highlighted paths show matching direct trains and their intervening stops. Remove an endpoint to explore alternatives. The former station visibility setting is ignored and removed from shared URLs. Small circles retain larger invisible selection areas; overlapping targets resolve to the nearest station.

## Timetable and coverage

Times come from the retained [Amtrak GTFS timetable](https://content.amtrak.com/content/gtfs/GTFS.zip), feed `20261011`, for **October 12–18, 2026**. These are scheduled elapsed times from origin departure to destination arrival, including intermediate stops. The timetable snapshot is not a live departure board or a booking service.

Each connection must occur on a single active GTFS trip, in the correct direction, with boarding allowed at the origin and alighting allowed at the destination. Different trips sharing a service name never create an inferred direct connection. Service calendars and calendar exceptions are applied. GTFS times use the agency time zone and may exceed 24:00 for overnight trips. The left panel retains the source trip, train number, and service dates for inspection.

The explorer includes the Amtrak train services present in this feed; commuter-agency and bus services are excluded. Some inventory routes and stations have no trip in this particular timetable week. Their mapped presence does not imply that a scheduled direct train is available, and travel times are never inferred from route distance. Frequency, delays, fares, transfers, and station access time are outside this explorer.

## Map sources

The schematic derives from the [BTS / NTAD Amtrak routes](https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Amtrak_Routes/FeatureServer/0) and [train station inventory](https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Amtrak_Stations/FeatureServer/0). Straight segments show service relationships, not precise track alignment. Shared track is drawn once; hovering or selecting a service highlights its route. Light and Dark buttons switch between [OpenFreeMap](https://openfreemap.org/) Positron and Fiord basemaps, using OpenStreetMap data.

This is a separate rail-only app derived from the Rail vs. Air explorer. Its [source and data](https://github.com/ameliarowland/ameliarowland.github.io/tree/main/public/amtrak-direct-route-explorer) contain no flight comparison dependency. A compact trip-based timetable supports all direct rail searches independently of the older comparison dataset.
