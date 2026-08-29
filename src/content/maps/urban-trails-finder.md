---
title: "Urban Trails Finder"
description: "A Stadtwanderweg-inspired interactive map prototype for curated walking loops in US cities."
date: 2026-07-10
image: /maps/urban-trails-finder.svg
externalUrl: https://ameliarowland.github.io/urban-trails-finder/
tools: [Leaflet, OpenStreetMap, GeoJSON, JavaScript]
tags: [urbanism, walkability, web-gis, sustainability]
---

Urban Trails Finder explores how US cities could present longer recreational walking loops in the spirit of Vienna's Stadtwanderwege. The prototype includes four city-wander paths for each included city, combining parks, waterfronts, transit access, quieter streets, cultural stops, and memorable urban terrain.

The prototype includes city browsing, scorecards, OSM-routed starter geometries, city zoom controls, basemap switching, and GeoJSON export. It is meant as a portfolio-ready first version: polished enough to demonstrate the product idea, but transparent about where a production workflow would go deeper.

## GIS Method

The current routes are generated from route control points using Valhalla pedestrian routing over OpenStreetMap. The exported GeoJSON keeps both the routed vertex geometry and metadata about the geometry source. A fuller version would add municipal sidewalk inventories, then score each segment using tree canopy, slope, public stairways, traffic stress, crossings, transit stops, park access, waterfront proximity, and public amenities.

## Why It Matters

Urban trails can make everyday walking feel civic, scenic, and legible. The GIS challenge is not only finding the shortest path, but identifying routes that feel safe, useful, memorable, and worth sharing.
