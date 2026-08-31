# Urban Trails Finder

A GitHub Pages-friendly web GIS prototype for Stadtwanderweg-inspired walking loops in US cities.

## What it includes

- Interactive Leaflet map with four city-wander paths per included city
- Filters by city
- Automatic city zoom when the selected city changes
- Download selected or filtered routes as GeoJSON, GPX, or KML

## How to run

Run the Astro site and open `/urban-trails-finder/`. The app uses CDN-hosted Leaflet and remote basemap tiles, so it needs an internet connection for the map library and basemaps.

## Portfolio framing

This prototype stores broad control points and generated pedestrian-routed geometries from Valhalla over OpenStreetMap. It intentionally excludes unverified descriptive attributes. A production GIS workflow could add sourced municipal inventories and field-verified path quality, including:

- sidewalk and crossing quality
- slope and stair segments
- tree canopy or heat exposure
- traffic stress and speed limits
- transit stop accessibility
- park, waterfront, viewpoint, and public restroom proximity
- route export as GeoJSON, GPX, and static PDF maps

## Data note

The included geometries are generated city-wander paths for demonstration, not field-verified or turn-by-turn navigation products. Distances are calculated from the displayed geometry. Do not add scores, classifications, accessibility claims, environmental attributes, amenities, or qualitative descriptions without a cited authoritative source or a documented reproducible derivation.
