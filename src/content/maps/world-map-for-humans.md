---
title: "World Map for Humans"
description: 'An exploratory interactive map that gives geographic context through water lines/polygons, human population density, land cover, and false color infrared imagery—without "political" boundaries.'
date: 2026-08-29
image: /maps/world_map_for_humans.png
embedUrl: https://ameliarowland.github.io/world-map-for-humans/
externalUrl: https://ameliarowland.github.io/world-map-for-humans/
mobileTallEmbed: true
tools: [MapLibre GL JS, OpenStreetMap, Copernicus GHSL, ESA WorldCover]
tags: [web-gis, experimental-cartography, open-data, remote-sensing]
---

## The Why

When I created the [interactive map for the Slingshot Radical Contact List](https://ameliarowland.github.io/maps/slingshot-radical-contact-map/), I found it difficult to choose a basemap. With every map we create, we have the power to shape the perception of the reader. Showing a contested border with dashed lines marks a moment in history. Moving that border marks another. Conveying cities primarily using road networks, rather than bike paths, public transit, and pedestrian infrastructure says something else - this is how you navigate.

Initially, I scraped the Slingshot data because I wanted to create an alternative method for exploring and consuming the information. Currently, the data is hosted on their website in a nested link structure, starting at Country/Continent level (e.g. USA), then sub-groups (e.g. Virginia), and finally the contacts are listed. Contact location information is a plain text address. In regions with many contacts, like Virginia, it can be difficult to understand spatial relationships when the address city names are unfamiliar.

## The How

So I was faced with some interesting questions: what am I seeking to accomplish by putting this information in a spatial format, what additional spatial information would be useful to other readers, how can I be respectful of the organization’s values? Ultimately, I decided to use the basemap developed by the **H**umanitarian **O**pen Street Map **T**eam (HOT), which is used by organizations to plan and respond to disasters. The organization uses open mapping tools, transparent data workflows, and is supported by a global network of volunteers ([source](https://www.hotosm.org/en/tools-resources/open-mapping-solutions/)). The basemap shows a thorough picture of human geography (pedestrian paths, shared transit routes/stops, roads/highways, drinkable water locations, medical facilities, shops and more) and physical geography (green space, blue space).

The HOT map is impressive, but I began to wonder how I would design a map that provides geographic context without being too suggestive about how we should relate to the world.

Built with [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/), the World Map for Humans is an exploratory answer. By default, it conveys only water boundaries. You can also view human population density, land cover categories (e.g. tree cover, cropland, snow/ice, built-up), or false color infrared imagery that shows vegetation in red. Each layer can be switched on or off, making it possible to notice how much of our mental map relies on boundaries and labels—and allows us to notice what other patterns guide us when they are absent.

I suggest this challenge for you:

*Can you navigate in the map to your hometown? Does it feel different?*

## The Layers

- **Water.** The map draws the `water` and `waterway` layers from OpenMapTiles-formatted vector tiles hosted by [OpenFreeMap](https://openfreemap.org/). These layers represent oceans, lakes and other water bodies as polygons, and rivers, canals, streams and smaller waterways as lines. At lower zoom levels, the data comes from [Natural Earth](https://www.naturalearthdata.com/); at higher zoom levels, it comes primarily from OpenStreetMap and [OSMData water polygons](https://osmdata.openstreetmap.de/data/water-polygons.html).
- **Population.** Estimated resident population comes from the European Commission Joint Research Centre’s [GHS-WUP-POP R2025A](https://human-settlement.emergency.copernicus.eu/ghs_wup_pop_r2025a.php). The map shows classified 2020 population counts for grid cells of approximately 1 km². Source: Schiavina, M., Freire, S., Carioli, A., et al. (2025), [doi:10.2905/adba95af-db56-4569-acd3-9513201eba30](https://doi.org/10.2905/adba95af-db56-4569-acd3-9513201eba30), licensed under CC BY 4.0.
- **WorldCover.** The 2021 land-cover classification and false-colour infrared composite are ESA WorldCover layers delivered through the public [Terrascope WMTS/WMS service](https://wmts.terrascope.be/?service=WMTS&request=GetCapabilities). [ESA’s data-access page](https://esa-worldcover.org/en/data-access) documents the products and available access options.

## Looking forward

Recently, the [UN General Assembly voted to “correct the map”](https://www.eeas.europa.eu/delegations/un-new-york/eu-explanation-vote-un-general-assembly-resolution-correct-map-rebalancing-global-cartographic_en) in order to more equitably represent the true size of land masses currently distorted by the commonly used Web Mercator. This is a well known issue for GIS folks, but below I have included a gif I created using [truesizeof.com](http://truesizeof.com) to show the size distortion present in common maps (i.e. no, Greenland is not that large). Currently my interactive maps are built with MapLibre, which uses Web Mercator. As Equal Area more fairly conveys the size of regions despite latitude, and because I understand the power that maps hold, I will soon be switching my approach for future articles.

![Animation demonstrating Web Mercator size distortion](/maps/true_size_of.gif)
