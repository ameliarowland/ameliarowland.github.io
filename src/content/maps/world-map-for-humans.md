---
title: "World Map for Humans"
description: "An exploratory interactive map that gives geographic context through coastlines, water, population, and satellite imagery—without political boundaries."
date: 2026-08-29
image: /maps/world_map_for_humans.png
embedUrl: https://ameliarowland.github.io/world-map-for-humans/
externalUrl: https://ameliarowland.github.io/world-map-for-humans/
tools: [MapLibre GL JS, OpenStreetMap, Copernicus GHSL, ESA WorldCover]
tags: [web-gis, experimental-cartography, open-data, remote-sensing]
---

Putting the Slingshot Radical Contact List into an interactive map got me thinking about basemaps: how could a map give location data enough geographic context to feel grounded without quietly centering countries and political borders?

Built with [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/), this map is an exploratory answer. It reduces the world to a small vocabulary of coast, water, population, settlement, and satellite observation. Each layer can be switched on or off, making it possible to notice how much of our mental map depends on boundaries and labels—and what other patterns appear when they are absent.

> Can you navigate in the map to your hometown? Does it feel different?

## The Layers

- **Coastlines.** The downloadable reference is the [OSMData coastline dataset](https://osmdata.openstreetmap.de/data/coastlines.html), derived from OpenStreetMap ways tagged `natural=coastline` and licensed under the ODbL.
- **Water polygons.** Oceans and seas are referenced from [OSMData's water polygons](https://osmdata.openstreetmap.de/data/water-polygons.html). For responsive web display, the live map renders OSM-derived water geometry through OpenMapTiles-compatible tiles served by [OpenFreeMap](https://openfreemap.org/).
- **Population.** Estimated resident population comes from the European Commission Joint Research Centre's [GHS-WUP-POP R2025A](https://human-settlement.emergency.copernicus.eu/ghs_wup_pop_r2025a.php), shown for 2020 as classified counts per roughly 1 km² grid cell. The source is Schiavina, M., Freire, S., Carioli, A., et al. (2025), [doi:10.2905/adba95af-db56-4569-acd3-9513201eba30](https://doi.org/10.2905/adba95af-db56-4569-acd3-9513201eba30), licensed CC BY 4.0.
- **WorldCover.** The optional V2 2021 land-cover classification and false-colour infrared composite are ESA WorldCover layers served through the public [Terrascope WMTS/WMS service](https://wmts.terrascope.be/?service=WMTS&request=GetCapabilities). [ESA's data-access page](https://esa-worldcover.org/en/data-access) documents the products and access options.

## Mapping Approach

There is no conventional basemap underneath these layers. Land begins as a quiet paper-like field; water defines its edge, population registers human concentration, and WorldCover can replace abstraction with either classified land cover or false-colour Earth observation. The result is deliberately informative but incomplete.

The population layer uses the official cloud-optimized GeoTIFF through Terrascope's tiled raster service. It is created only when selected, so the browser requests small, cached tiles for the visible area and zoom instead of downloading the global source raster or slowing the initial map view.

The live attribution in the lower-right corner lists the map's providers and data sources. Source links are also kept next to every layer control so the data remains inspectable even while the map stays visually minimal.

## What I Am Testing

Political boundaries are often treated as neutral background information, yet they strongly shape how we read a place. Removing them does not create a neutral map—it simply changes the questions the map asks. Here, coastlines, settlement patterns, water, and land cover become the cues for orientation.

The layer defaults are intentionally provisional. The next design decision is which combination offers enough context on first load without resolving the experiment too quickly.
