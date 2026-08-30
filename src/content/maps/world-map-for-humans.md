---
title: "World Map for Humans"
description: "An exploratory interactive map that gives geographic context through coastlines, water, urban areas, and satellite imagery—without political boundaries."
date: 2026-08-29
image: /maps/world_map_for_humans.png
embedUrl: https://ameliarowland.github.io/world-map-for-humans/
externalUrl: https://ameliarowland.github.io/world-map-for-humans/
tallEmbed: true
tools: [MapLibre GL JS, OpenStreetMap, Natural Earth, ESA WorldCover]
tags: [web-gis, experimental-cartography, open-data, remote-sensing]
---

Putting the Slingshot Radical Contact List into an interactive map got me thinking about basemaps: how could a map give location data enough geographic context to feel grounded without quietly centering countries and political borders?

This map is an exploratory answer. It reduces the world to a small vocabulary of coast, water, settlement, and satellite observation. Each layer can be switched on or off, making it possible to notice how much of our mental map depends on boundaries and labels—and what other patterns appear when they are absent.

> Can you navigate in the map to your hometown? Does it feel different?

## The Layers

- **Coastlines.** The downloadable reference is the [OSMData coastline dataset](https://osmdata.openstreetmap.de/data/coastlines.html), derived from OpenStreetMap ways tagged `natural=coastline` and licensed under the ODbL.
- **Water polygons.** Oceans and seas are referenced from [OSMData's water polygons](https://osmdata.openstreetmap.de/data/water-polygons.html). For responsive web display, the live map renders OSM-derived water geometry through OpenMapTiles-compatible tiles served by OpenFreeMap.
- **Urban areas.** Built-up areas come from [Natural Earth's 1:10 million urban areas dataset](https://naciscdn.org/naturalearth/10m/cultural/ne_10m_urban_areas.zip), simplified for browser performance. Natural Earth data is in the public domain.
- **WorldCover.** The optional V2 2021 land-cover classification and false-colour infrared composite are ESA WorldCover layers served through the public [Terrascope WMTS/WMS service](https://wmts.terrascope.be/?service=WMTS&request=GetCapabilities). [ESA's data-access page](https://esa-worldcover.org/en/data-access) documents the products and access options.

## Mapping Approach

There is no conventional basemap underneath these layers. Land begins as a quiet paper-like field; water defines its edge, urban areas register human concentration, and WorldCover can replace abstraction with either classified land cover or false-colour Earth observation. The result is deliberately informative but incomplete.

The live attribution in the lower-right corner lists the map's providers and data sources. Source links are also kept next to every layer control so the data remains inspectable even while the map stays visually minimal.

## What I Am Testing

Political boundaries are often treated as neutral background information, yet they strongly shape how we read a place. Removing them does not create a neutral map—it simply changes the questions the map asks. Here, coastlines, settlement patterns, water, and land cover become the cues for orientation.

The layer defaults are intentionally provisional. The next design decision is which combination offers enough context on first load without resolving the experiment too quickly.
