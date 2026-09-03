---
title: "Build a Trail"
description: "Generate, revise, save, and export your own urban walking trails."
date: 2026-09-01
image: /maps/build-a-trail.png
embedUrl: https://ameliarowland.github.io/build-a-trail/?embed=article
externalUrl: https://ameliarowland.github.io/build-a-trail/
tallEmbed: true
tools: [Leaflet, Valhalla, OpenStreetMap, GeoJSON, JavaScript]
tags: [urbanism, walkability, web-gis, routing]
---

Build a Trail turns route generation into a hands-on map workshop. Search for a city from the suggestion list or pan and zoom directly to the area you want to explore. Choose kilometers or miles, select a preset or enter a custom distance, and ask the app to build a walking loop around the center of the map. The app tries the [Valhalla routing engine](https://valhalla.github.io/valhalla/) first and uses OpenStreetMap's public pedestrian router as an availability fallback, with progress messages showing which service is being tried. The default basemap is [OpenStreetMap](https://www.openstreetmap.org/), with topographic, light-gray, and satellite-with-roads alternatives.

## Edit the Trail

New routes are locked by default. Turn editing on to reveal a small set of round anchor points rather than every bend in the routed line. An anchor can be dragged, selected for removal with a minus button, or added from the map controls. With snapping enabled, changed sections are rerouted along the walkable network. With snapping off, a moved or added anchor may leave the mapped network while the rest of the routed line stays in place. Undo and redo are available beside the editing controls and on the map, and segment-distance labels can be switched on while revising the trail. The current total length stays visible on the map as the route changes.

## Save, Continue, and Export

Name the result and choose **Save Trail** to add it to the trail list, then pan elsewhere and build another. Saved routes use different colors so they remain distinguishable on the map. Each one can be renamed, shown or hidden, removed, reopened with **Edit trail**, and updated with **Save edits**. Routes stay on the current device using browser storage and can be exported individually—or together when visible—as [GeoJSON](https://www.rfc-editor.org/info/rfc7946/), [GPX](https://www.topografix.com/gpx.asp), or [KML](https://www.ogc.org/standard/kml/).

## Data and Use

City lookups are sent only when a search is submitted or a suggestion is selected, are cached on the device, and follow the public [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/). Generated routes are derived from mapped routing data, but they are not field-verified and should not be treated as turn-by-turn navigation or accessibility guidance. The implementation is available in the [portfolio source repository](https://github.com/ameliarowland/ameliarowland.github.io).
