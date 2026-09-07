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

## Background story

In 2023 I moved to Vienna, Austria to begin my masters studies. I knew of Vienna’s public transit network, but I did not know its extent. To briefly summarize, the city has a vast underground metro network, as well as trams, trains, and buses. If you prefer to travel with the breeze on your face, pedestrian walkways/sidewalks line most of the city, and bicycling paths appear alongside popular commuter routes. Of course there is still room for improvement, and we can always do more work to deprioritize cars, but the point is that it became clear to me that this city supported many alternative modes of transit. Fast forward a couple months, and I discovered Vienna’s [Stadtwanderwege](https://www.wien.gv.at/en/leisure/hiking-paths) (City-Wander-Way) network. There are 11 routes (see map below), and all are accessible by public transit.

![Map of Vienna's Stadtwanderwege network](/maps/stadtwanderweg_wien2.png)

Created using:

- Path: [Stadtwanderwege](https://www.data.gv.at/datasets/36886c25-6961-4055-96b2-b3e8b138e588?locale=de)
- Basemap: [Vienna Mehrzweckkarte WMTS](https://maps.wien.gv.at/wmts/fmzk/pastell/google3857/{z}/{y}/{x}.jpeg), accessed using [NextGIS QMS](https://qms.nextgis.com/geoservices/741) in QGIS via the QuickMapServices plugin (search NextGIS QMS, map titled “Vienna: Mehrzweckkarte (general purpose)”)

Wanderers can pick up a booklet from the city with information about each hike, and collect a stamp for each wander-way that they complete. When you’ve completed them all, you get a pin from the city to commemorate your adventuring.

With a city transit pass, these paths became a common weekly excursion for my friend group. We celebrated birthdays, wandered forests, gazed at the city over vineyards, and whether it rained or snowed or the sun shone bright, we met up and explored. Of course some of these places could have been discovered without the city map, but the city network provided both a challenge (complete them all to earn a pin) and guidance through the vast woods around Vienna. Additionally, most routes pass by a restaurant, in many cases a Viennese Hütte. Often a weekend wander became a culinary exploration of homemade Viennese pies, soups, traditional dishes, and rural hospitality. See [reel by @bibi_doon doing Stadwanderweg Route 1](https://www.instagram.com/reel/Da2bX-moFCo/?utm_source=ig_web_copy_link&stkn=NTc4MTIwNjQ2YQ==) to get a glimpse into the full experience.

This experience inspired me to create a demo tool and starting point for other cities to develop their own city-wander-network. Therefore, I present to you the “Urban Trails Development Plan” as an urban walking route planning workspace.

## How the app works

### General

To use the app, first search for a city, set a minimum and maximum route distance, and generate between one and ten routes—ten by default—distributed across that range. Generated loops are spread across the city, or around the current map area after the map is moved elsewhere. This means that you can create one route at a time if you prefer to do so. Route generation checks against previously generated routes so shared geometry does not exceed 10%.

### Editing

Each new route can be renamed, hidden, recolored, and edited by moving, adding, or removing route anchors. With snapping off, moving one anchor preserves the other anchors and changes only the attached lines.

### Export

Route data shown in the map extent can be exported as versioned [GeoJSON](https://www.rfc-editor.org/info/rfc7946/), GPX, or KML files for GIS and navigation use. Sequential version numbers appear in both filenames and file metadata so revisions are easy to distinguish. Labeled community maps can be downloaded as interactive HTML, PDF, or image format for workshops and review. Map exports include visible routes shown in the current map window, the current basemap, and basemap/data attribution.

## GIS Method

Route concepts are generated from map-centered control points using the [Valhalla open-source routing engine](https://github.com/valhalla/valhalla) over [OpenStreetMap](https://www.openstreetmap.org/) data, with the [OpenStreetMap pedestrian router](https://routing.openstreetmap.de/) as a fallback. City search uses [Nominatim](https://nominatim.org/) after a user submits a query. Saved plan routes stay on the current device.

## In short: why do urban trails matter?

Urban and peri-urban trails can create a sense of place, offer inspiration for movement in urban spaces, and give a sense of direction (pun intended) for visitors. In many cases, they provide opportunities to engage with local culture, whether that be cuisine, agriculture, or ecology.

## Fun fact

The city of Vienna also created one large hiking path to connect all wander paths, for the truly adventurous ([Rundumadum-Wanderweg](https://www.wien.gv.at/freizeit/wanderweg-rund-um-wien)). It is 120 kilometers (75 miles).
