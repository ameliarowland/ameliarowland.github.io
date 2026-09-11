---
title: "Slingshot Radical Contact Map"
description: "An interactive, clustered web map of active radical bookstores, infoshops, co-ops, social centers, and movement spaces worldwide."
date: 2026-08-29
image: /maps/slingshot.png
embedUrl: https://ameliarowland.github.io/slingshot-radical-contact-map/
externalUrl: https://ameliarowland.github.io/slingshot-radical-contact-map/
tallEmbed: true
tools: [Leaflet, OpenStreetMap, HOT, Web scraping, Geocoding]
tags: [web-gis, mutual-aid, radical-geography, open-data]
---

## tl;dr (too long; didn’t read)

In short, the Slingshot Radical Contact Map turns scraped data from [Slingshot Collective’s public radical contact directory](https://slingshotcollective.org/radical-contact-list/) into a spatially explorable resource. Clustered points on the map make a large international directory easy to spatially explore (i.e. clicking clusters zooms you into that area), while search and regional filters facilitate word-based navigation. In this interactive tool, you will find independent bookstores, infoshops, co-ops, and autonomous social centers around the world.

## Data Structure

Initially, I scraped the Slingshot data because I wanted to create an alternative method for exploring and consuming the information. Currently, the data is hosted on their website in a nested link structure, starting at Country/Continent level (e.g. USA), then sub-groups (e.g. Virginia), and finally the contacts are listed. Contact location information is a plain text address. In regions with many contacts, like Virginia, it can be difficult to understand spatial relationships when the address city names are unfamiliar.

## Picking a Basemap

Designing the interactive map was simple, but I needed to choose a basemap. I asked myself a few questions and came up with the following:

What am I seeking to accomplish by putting this information in a spatial format?

- *Refamiliarize myself with web scraping*
- *Avoid having to paste every address into Google Maps to understand where contacts are within a larger region (e.g. Virginia has one long list)*

What additional spatial information would be useful to other readers?

- *The map is not meant to be a tool giving directions, but it should communicate the spatial relationships between contacts and general location in the world*

How can I be respectful of the organization’s values?

- *Slingshot is a radical newspaper which seeks to explore alternative ways of thinking. This prompted an interesting thought process for me, as I tried to imagine basemaps from an alternative perspective.&#xA0;*

Ultimately, I selected the basemap developed by the **H**umanitarian **O**pen Street Map **T**eam (HOT), which is used by organizations to plan and respond to disasters. The organization uses open mapping tools, transparent data workflows, and is supported by a global network of volunteers (source: [https://www.hotosm.org/en/tools-resources/open-mapping-solutions/](https://www.hotosm.org/en/tools-resources/open-mapping-solutions/)). The basemap shows a thorough picture of human geography (pedestrian paths, shared transit routes/stops, roads/highways, drinkable water locations, medical facilities, shops and more) and physical geography (green space, blue space). While this is not necessarily the perfect solution, it seemed suitable for now.

## Open, community-oriented tech stack

- [Leaflet](https://leafletjs.com/) and Leaflet.markercluster for the map and aggregation
- [OpenStreetMap](https://www.openstreetmap.org/) data
- [Humanitarian OpenStreetMap Team](https://www.hotosm.org/) map tiles
- [Nominatim](https://nominatim.org/) for geocoding, with a local cache and a one-request-per-second limit

## Data Scraping and Cleaning

A Python scraper crawled the directory’s nested country/region pages and extracted names and plain-text addresses. Records were parsed, cleaned, deduplicated, and reviewed country by country; inactive/defunct spaces were removed. Reliable addresses were then geocoded using Nominatim, while uncertain locations were excluded rather than mapped inaccurately. the final dataset contains 956 locations with source links.

## Mapping Approach

The interface uses [Leaflet](https://leafletjs.com/) with the [Leaflet.markercluster plugin](https://github.com/Leaflet/Leaflet.markercluster) for marker clustering and progressive zoom. [OpenStreetMap](https://www.openstreetmap.org/) and [Humanitarian OpenStreetMap Team](https://www.hotosm.org/) data provide an open data, community-oriented basemap. Each contact location on the map has a link back to its source on the Slingshot website, or link to a current website when available.

## Lessons Learned

While the OSM HOT basemap has map labels in the local language and alphabet, the search feature does not support other languages and alphabets to find locations (i.e. cities or radical contacts). This would be a useful update for future development efforts.
