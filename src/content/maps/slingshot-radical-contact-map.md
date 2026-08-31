---
title: "Slingshot Radical Contact Map"
description: "An interactive, clustered web map of active radical bookstores, infoshops, co-ops, social centers, and movement spaces worldwide."
date: 2026-08-29
image: /maps/slingshot.png
embedUrl: https://ameliarowland.github.io/slingshot-radical-contact-map/
externalUrl: https://ameliarowland.github.io/slingshot-radical-contact-map/
tallEmbed: true
tools: [Leaflet, OpenStreetMap, HOT, JavaScript]
tags: [web-gis, mutual-aid, radical-geography, open-data]
---

The Slingshot Radical Contact Map turns the [Slingshot Collective's public radical contact directory](https://slingshotcollective.org/radical-contact-list/) into a browsable geographic resource. Clustered points make a large international directory legible at a glance, while search and regional filters help people find nearby independent bookstores, infoshops, co-ops, autonomous social centers, and movement spaces.

## Data and Verification

Directory records were reviewed country by country, cleaned, and geocoded against current public evidence. Defunct spaces are excluded. Where an active project no longer publishes a reliable physical address, it is withheld from the point map rather than placed at a misleading city or country centroid.

## Mapping Approach

The interface uses [Leaflet](https://leafletjs.com/) with the [Leaflet.markercluster plugin](https://github.com/Leaflet/Leaflet.markercluster) for marker clustering and progressive zoom. [OpenStreetMap](https://www.openstreetmap.org/) and [Humanitarian OpenStreetMap Team](https://www.hotosm.org/) data provide an open, community-oriented geographic foundation. The source directory remains credited to [Slingshot Collective](https://slingshotcollective.org/), and each mapped record retains a link back to its source or current website when available.

## Lessons Learned

While the OSM HOT basemap has map labels in a local language, the search feature does not support other languages or alphabets to find locations (e.g. cities, radical contacts). This would be a useful update for future development efforts.
