---
title: "Urban Trails Finder"
description: "A Stadtwanderweg-inspired interactive map prototype for curated walking loops in US cities."
date: 2026-07-10
image: /maps/city_wander_paths.png
embedUrl: https://ameliarowland.github.io/urban-trails-finder/?embed=article
externalUrl: https://ameliarowland.github.io/urban-trails-finder/
tallEmbed: true
tools: [Leaflet, OpenStreetMap, GeoJSON, JavaScript]
tags: [urbanism, walkability, web-gis, sustainability]
---

Urban Trails Finder explores how US cities could present longer recreational walking loops in the spirit of Vienna's [Stadtwanderweg](https://www.wien.gv.at/en/leisure/hiking-paths) network. Built with [Leaflet](https://leafletjs.com/) and [OpenStreetMap](https://www.openstreetmap.org/), the prototype includes four city-wander paths for each included city, combining parks, waterfronts, transit access, quieter streets, cultural stops, and memorable urban terrain. It includes city browsing, scorecards, OSM-routed starter geometries, city zoom controls, basemap switching, and route export to [GeoJSON](https://www.rfc-editor.org/info/rfc7946/), GPX, and KML.

## GIS Method

The current routes are generated from route control points using the [Valhalla open-source routing engine](https://github.com/valhalla/valhalla) over [OpenStreetMap](https://www.openstreetmap.org/) data. A fuller version could add municipal sidewalk inventories and allow for route editing and development in the app.

## Why It Matters

Urban trails can create a sense of place, offer inspiration for movement in urban spaces, and give a sense of direction (pun intended) for visitors. The GIS challenge is not only finding a feasible path, but identifying routes that feel safe, memorable, and worth repeating.
