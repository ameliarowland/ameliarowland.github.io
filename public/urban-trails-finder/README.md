# Urban Trails Development Plan

A GitHub Pages-friendly urban trail planning workspace that replaces the original fixed route catalog.

## What it includes

- Search for any city with [OpenStreetMap Nominatim](https://nominatim.org/)
- Generate 1–10 route alternatives, with 10 selected by default
- Set a customizable minimum and maximum distance; routes are distributed across that range
- Reject generated or edited routes when measured shared geometry exceeds 10%
- Global starting view with a kilometers/miles distance selector
- Map-centered walking-loop generation with Valhalla pedestrian routing over OpenStreetMap
- Editable Leaflet geometry using Leaflet-Geoman
- Draggable vertices, right-click vertex removal, midpoint handles, and snapping to the generated route
- A **Snap to streets** action that re-routes the edited control shape through Valhalla
- Device-local saved trails with rename, show/hide, and remove controls
- Individual and combined spatial exports as GeoJSON, GPX, or KML
- Labeled community map exports as interactive HTML, linked PDF, or PNG image
- Article-embed and full-screen layouts

## How to run

Run the Astro site and open `/urban-trails-finder/`. The app uses CDN-hosted Leaflet, remote basemap tiles, the public Valhalla demo server, and user-initiated [Nominatim](https://nominatim.org/) city searches, so it needs an internet connection.

## Service and data notes

[Nominatim](https://nominatim.org/) requests occur only after the user submits the city-search form, are cached on the device, and must remain within the [public usage policy](https://operations.osmfoundation.org/policies/nominatim/). Valhalla and public tile services may be unavailable or rate-limited; the interface reports those failures without inventing a route. Generated routes are not field-verified and are not intended for turn-by-turn navigation or accessibility guidance.
