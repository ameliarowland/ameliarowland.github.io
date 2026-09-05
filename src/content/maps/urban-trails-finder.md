---
title: "Urban Trails Development Plan"
description: "Search any city, develop 1–10 editable walking routes, and export spatial data or a community-ready map."
date: 2026-07-10
image: /maps/city_wander_paths.png
embedUrl: https://ameliarowland.github.io/urban-trails-finder/?embed=article
externalUrl: https://ameliarowland.github.io/urban-trails-finder/
tallEmbed: true
tools: [Leaflet, OpenStreetMap, GeoJSON, Valhalla, Product Development, Auto-Generated Routes]
tags: [urbanism, walkability, web-gis, sustainability]
---

Urban Trails Development Plan is an urban walking route planning workspace inspired by Vienna's [Stadtwanderweg](https://www.wien.gv.at/en/leisure/hiking-paths) network. Search for any city, set a minimum and maximum distance, and generate between one and ten routes—ten by default—distributed across that range. Candidate loops are spread across the searched city, or around the current map area after the map is moved elsewhere. The selected distance values act as a true acceptance range, while adaptive scaling accounts for the way local street networks lengthen geometric loops. Route generation checks every candidate against existing routes and routes accepted during the current run so shared geometry does not exceed 10%. Routes begin unselected and can be selected directly on the map, while clicking empty map space clears the selection.

Each new route can be renamed, hidden, reopened, recolored, and edited by moving, adding, or removing route anchors. With snapping off, moving one anchor preserves the other anchors and changes only the nearby freeform line. Turning snapping back on leaves that geometry untouched while applying street-following behavior to subsequent edits. Deep teal is the default route color, with additional monocolor, multicolor, bright, and highlighter options.

Route data currently shown in the map extent can be exported as versioned [GeoJSON](https://www.rfc-editor.org/info/rfc7946/), GPX, or KML files for GIS and navigation workflows. Sequential version numbers appear in both filenames and file metadata so revisions are easy to distinguish. Labeled community maps can be downloaded as interactive HTML, linked PDF, or PNG image for workshops and review; these presentation formats do not contain reusable route data. Map exports include only visible routes intersecting the current map window, preserve the selected basemap and view, include map and routing attribution, place labels close to their routes, and simplify the legend automatically when every route uses the same color.

## GIS Method

Route concepts are generated from map-centered control points using the [Valhalla open-source routing engine](https://github.com/valhalla/valhalla) over [OpenStreetMap](https://www.openstreetmap.org/) data, with the [OpenStreetMap pedestrian router](https://routing.openstreetmap.de/) as a fallback. City search uses [Nominatim](https://nominatim.org/) after a user submits a query. Saved plan routes stay on the current device.

## Why It Matters

Urban trails can create a sense of place, offer inspiration for movement in urban spaces, and give a sense of direction (pun intended) for visitors.
