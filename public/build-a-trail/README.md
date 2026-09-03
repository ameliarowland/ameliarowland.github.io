# Build a Trail

A separate, GitHub Pages-friendly web GIS app inspired by Urban Trails Finder. Urban Trails Finder remains unchanged; this app reuses its visual language and export patterns while replacing the pre-generated trail catalog with a user-driven trail workshop.

## What it includes

- User-submitted city search with OpenStreetMap Nominatim
- Global starting view with a kilometers/miles distance selector
- Map-centered walking-loop generation with Valhalla pedestrian routing over OpenStreetMap
- Editable Leaflet geometry using Leaflet-Geoman
- Draggable vertices, right-click vertex removal, midpoint handles, and snapping to the generated route
- A **Snap to streets** action that re-routes the edited control shape through Valhalla
- Device-local saved trails with rename, show/hide, and remove controls
- Individual and combined exports as GeoJSON, GPX, or KML
- Article-embed and full-screen layouts

## How to run

Run the Astro site and open `/build-a-trail/`. The app uses CDN-hosted Leaflet, Leaflet-Geoman, remote basemap tiles, the public Valhalla demo server, and user-initiated Nominatim city searches, so it needs an internet connection.

## Service and data notes

Nominatim requests occur only after the user submits the city-search form, are cached on the device, and must remain within the [public usage policy](https://operations.osmfoundation.org/policies/nominatim/). Valhalla and public tile services may be unavailable or rate-limited; the interface reports those failures without inventing a route. Generated routes are not field-verified and are not intended for turn-by-turn navigation or accessibility guidance.
