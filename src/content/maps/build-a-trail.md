---
title: "Build a Trail"
description: "Generate, reshape, save, and export your own urban walking trails."
date: 2026-09-01
image: /maps/build-a-trail.svg
embedUrl: https://ameliarowland.github.io/build-a-trail/?embed=article
externalUrl: https://ameliarowland.github.io/build-a-trail/
tallEmbed: true
tools: [Leaflet, Leaflet-Geoman, Valhalla, OpenStreetMap, GeoJSON, JavaScript]
tags: [urbanism, walkability, web-gis, routing]
---

Build a Trail turns route generation into a hands-on map workshop. Search for a city anywhere in the world, choose kilometers or miles, pan to the part of town you want to explore, and ask the app to create a candidate walking loop. The route is generated with the [Valhalla routing engine](https://valhalla.github.io/valhalla/) over [OpenStreetMap](https://www.openstreetmap.org/) data, with OpenStreetMap's public pedestrian router as an availability fallback, and drawn with [Leaflet](https://leafletjs.com/).

## Shape Your Route

[Leaflet-Geoman](https://geoman.io/docs/leaflet/) makes each candidate route editable while leaving new routes locked by default. Turn editing on to drag a vertex or select it for removal. With snapping enabled, the released point and its two adjacent line sections are automatically refitted to walkable streets; removing a point similarly reroutes the gap between its neighbors. **Snap to streets** remains available for refitting the full route. Once a trail feels right, name it and keep it in the trail list. Each kept trail can be renamed, hidden, shown, or removed while you continue building more.

## Take It With You

Created trails stay on the current device using browser storage and can be exported individually or together as [GeoJSON](https://www.rfc-editor.org/info/rfc7946/), [GPX](https://www.topografix.com/gpx.asp), or [KML](https://www.ogc.org/standard/kml/). Exported geometry reflects the user's edits rather than a pre-generated trail catalog.

## Data and Use

City searches are sent only when the search form is submitted and follow the public [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/). Generated routes are derived from documented routing services, but they are not field-verified and should not be treated as turn-by-turn navigation or accessibility guidance. The implementation is available in the [portfolio source repository](https://github.com/ameliarowland/ameliarowland.github.io).
