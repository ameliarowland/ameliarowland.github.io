# Urban Trails Finder

A GitHub Pages-friendly web GIS prototype for Stadtwanderweg-inspired walking loops in US cities.

## What it includes

- Interactive Leaflet map with four city-wander paths per included city
- Filters by city and minimum route score
- City Go button that pans to the selected city
- Route scoring for greenery, water access, transit, calm streets, and culture
- Download selected or filtered routes as GeoJSON
- Copy route coordinates in WGS84 latitude/longitude format

## How to run

Run the Astro site and open `/urban-trails-finder/`. The app uses CDN-hosted Leaflet and remote basemap tiles, so it needs an internet connection for the map library and basemaps.

## Portfolio framing

This prototype stores broad control points and generated pedestrian-routed geometries from Valhalla over OpenStreetMap. A production GIS workflow could add municipal sidewalk inventories and field-verified path quality, then add:

- sidewalk and crossing quality
- slope and stair segments
- tree canopy or heat exposure
- traffic stress and speed limits
- transit stop accessibility
- park, waterfront, viewpoint, and public restroom proximity
- route export as GeoJSON, GPX, and static PDF maps

## Data note

The included routes are concept city-wander paths for demonstration, not turn-by-turn navigation products.
