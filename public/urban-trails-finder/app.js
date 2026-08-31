const state = {
  activeTrailId: TRAILS[0].id,
  trailLayers: new Map(),
  markerLayers: [],
  filteredTrails: []
};

const TRAIL_COLOR = "#e25f3d";
const DEFAULT_CITY = "Seattle, WA";
const ROUTE_NUMBER_MIN_ZOOM = 10;
const isArticleEmbed = new URLSearchParams(window.location.search).get("embed") === "article";
document.body.classList.toggle("article-embed", isArticleEmbed);

const map = L.map("map", {
  zoomControl: false,
  scrollWheelZoom: true
}).setView([39.6, -96.5], 4);

L.control.zoom({ position: "bottomright" }).addTo(map);

const esriAttribution = "Tiles &copy; Esri, HERE, Garmin, FAO, NOAA, USGS, EPA, NPS";
const basemaps = {
  "Esri Topographic": L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19,
    attribution: esriAttribution
  }),
  "Esri Light Gray": L.layerGroup([
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 16,
      attribution: "Tiles &copy; Esri"
    }),
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 16,
      attribution: "Tiles &copy; Esri"
    })
  ]),
  "Satellite": L.layerGroup([
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: "Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community"
    }),
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: "Labels &copy; Esri"
    })
  ]),
  "OpenStreetMap": L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  })
};

let activeBasemap = basemaps["Esri Topographic"];
activeBasemap.addTo(map);

const routeGroup = L.featureGroup().addTo(map);
const markerGroup = L.featureGroup().addTo(map);

const elements = {
  cityFilter: document.getElementById("cityFilter"),
  trailCount: document.getElementById("trailCount"),
  cityCount: document.getElementById("cityCount"),
  selectedCity: document.getElementById("selectedCity"),
  selectedName: document.getElementById("selectedName"),
  selectedDistance: document.getElementById("selectedDistance"),
  downloadGpx: document.getElementById("downloadGpx"),
  downloadKml: document.getElementById("downloadKml"),
  downloadGeoJson: document.getElementById("downloadGeoJson"),
  downloadAllGpx: document.getElementById("downloadAllGpx"),
  downloadAllKml: document.getElementById("downloadAllKml"),
  downloadAllGeoJson: document.getElementById("downloadAllGeoJson"),
  trailList: document.getElementById("trailList"),
  sidebar: document.querySelector(".sidebar"),
  closeSidebarButton: document.getElementById("closeSidebarButton"),
  openSidebarButton: document.getElementById("openSidebarButton"),
  basemapButtons: document.querySelectorAll(".basemap-button")
};

function init() {
  hydrateFilters();
  bindEvents();
  applyFilters();
  setInitialMapExtent();

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function hydrateFilters() {
  const cities = [...new Set(TRAILS.map((trail) => `${trail.city}, ${trail.state}`))].sort();
  cities.forEach((city) => {
    const option = document.createElement("option");
    option.value = city;
    option.textContent = city;
    elements.cityFilter.appendChild(option);
  });
  elements.cityFilter.value = DEFAULT_CITY;
}

function bindEvents() {
  if (isArticleEmbed) {
    elements.closeSidebarButton.addEventListener("click", () => setSidebarOpen(false));
    elements.openSidebarButton.addEventListener("click", () => setSidebarOpen(true));
  }

  elements.basemapButtons.forEach((button) => {
    button.addEventListener("click", () => setBasemap(button.dataset.basemap));
  });

  elements.cityFilter.addEventListener("change", () => {
    applyFilters();
    goToSelectedCity();
  });
  elements.downloadGpx.addEventListener("click", () => {
    const trail = getActiveTrail();
    if (trail) downloadGpx([trail], `${trail.id}.gpx`);
  });
  elements.downloadKml.addEventListener("click", () => {
    const trail = getActiveTrail();
    if (trail) downloadKml([trail], `${trail.id}.kml`);
  });
  elements.downloadGeoJson.addEventListener("click", () => {
    const trail = getActiveTrail();
    if (trail) downloadGeoJson([trail], `${trail.id}.geojson`);
  });
  elements.downloadAllGpx.addEventListener("click", () => {
    downloadGpx(state.filteredTrails, "urban-trails-visible.gpx");
  });
  elements.downloadAllKml.addEventListener("click", () => {
    downloadKml(state.filteredTrails, "urban-trails-visible.kml");
  });
  elements.downloadAllGeoJson.addEventListener("click", () => {
    downloadGeoJson(state.filteredTrails, "urban-trails-visible.geojson");
  });
  window.addEventListener("resize", () => map.invalidateSize());
  map.on("zoomend", updateRouteNumberVisibility);
}

function setBasemap(name) {
  const nextBasemap = basemaps[name];
  if (!nextBasemap || nextBasemap === activeBasemap) return;

  map.removeLayer(activeBasemap);
  activeBasemap = nextBasemap;
  activeBasemap.addTo(map);
  elements.basemapButtons.forEach((button) => {
    const isActive = button.dataset.basemap === name;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function setSidebarOpen(isOpen) {
  elements.sidebar.classList.toggle("is-closed", !isOpen);
  elements.openSidebarButton.classList.toggle("is-visible", !isOpen);
  elements.openSidebarButton.setAttribute("aria-expanded", String(isOpen));
}

function setInitialMapExtent() {
  window.requestAnimationFrame(() => {
    map.invalidateSize();
    if (isArticleEmbed) {
      fitFilteredTrails();
      return;
    }

    const activeLayer = state.activeTrailId ? state.trailLayers.get(state.activeTrailId) : null;
    if (activeLayer) {
      map.fitBounds(activeLayer.getBounds(), { ...mapFitOptions(42), maxZoom: 13 });
    }
  });
}

function applyFilters() {
  const city = elements.cityFilter.value;
  state.filteredTrails = TRAILS.filter((trail) => (
    city === "all" || `${trail.city}, ${trail.state}` === city
  ));

  if (!state.filteredTrails.some((trail) => trail.id === state.activeTrailId)) {
    state.activeTrailId = state.filteredTrails[0]?.id ?? null;
  }

  renderMap();
  renderList();
  renderSummary();

  if (state.activeTrailId) {
    selectTrail(state.activeTrailId, { fit: false });
  } else {
    renderEmptySelection();
  }
}

function renderMap() {
  routeGroup.clearLayers();
  markerGroup.clearLayers();
  state.trailLayers.clear();
  state.markerLayers = [];

  state.filteredTrails.forEach((trail) => {
    const hitLayer = L.polyline(trail.coords, {
      color: "#000",
      weight: 18,
      opacity: 0,
      interactive: true,
      className: "route-hit-area",
      lineJoin: "round"
    });
    const layer = L.polyline(trail.coords, {
      color: TRAIL_COLOR,
      weight: trail.id === state.activeTrailId ? 7 : 5,
      opacity: trail.id === state.activeTrailId ? 0.98 : 0.72,
      lineJoin: "round"
    });

    layer.on("click", () => selectTrail(trail.id, { fit: false }));
    layer.addTo(routeGroup);
    state.trailLayers.set(trail.id, layer);
    hitLayer.on("click", () => selectTrail(trail.id, { fit: false }));
    hitLayer.addTo(routeGroup);
    hitLayer.bringToFront();
  });

  renderTrailMarkers(state.filteredTrails);
  updateRouteNumberVisibility();
}

function renderTrailMarkers(trails) {
  markerGroup.clearLayers();
  state.markerLayers = [];

  trails.forEach((trail) => {
    addTrailNumberMarker(trail);
  });
}

function addTrailNumberMarker(trail) {
  const start = trail.coords[0];
  const number = trailNumber(trail);
  const activeClass = trail.id === state.activeTrailId ? " active" : "";
  const marker = L.marker(start, {
    icon: L.divIcon({
      className: "",
      html: `<span class="trail-number-marker${activeClass}">${number}</span>`,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    }),
    title: `Start/end: ${trail.name}`
  });

  marker.on("click", () => selectTrail(trail.id, { fit: false }));
  marker.addTo(markerGroup);
  state.markerLayers.push(marker);
}

function trailNumber(trail) {
  const match = trail.name.match(/Wanderway\s+(\d+)/);
  if (match) return match[1];

  const cityTrails = TRAILS.filter((item) => item.city === trail.city && item.state === trail.state);
  const index = cityTrails.findIndex((item) => item.id === trail.id);
  return String(index + 1);
}

function renderList() {
  elements.trailList.innerHTML = "";

  if (!state.filteredTrails.length) {
    const empty = document.createElement("p");
    empty.className = "selected-copy";
    empty.textContent = "No routes match the current filters.";
    elements.trailList.appendChild(empty);
    return;
  }

  state.filteredTrails.forEach((trail) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `trail-card${trail.id === state.activeTrailId ? " active" : ""}`;
    button.style.borderLeftColor = TRAIL_COLOR;
    button.addEventListener("click", () => selectTrail(trail.id, { fit: true }));

    button.innerHTML = `
      <div class="card-top">
        <h3>${trail.name}</h3>
      </div>
      <div class="card-meta">
        <span>${trail.city}, ${trail.state}</span>
        <span>${formatDistance(routeDistanceMiles(trail))}</span>
      </div>
    `;

    elements.trailList.appendChild(button);
  });
}

function renderSummary() {
  const trails = state.filteredTrails;
  const cities = new Set(trails.map((trail) => `${trail.city}, ${trail.state}`));

  elements.trailCount.textContent = trails.length;
  elements.cityCount.textContent = cities.size;
}

function selectTrail(trailId, options = { fit: false }) {
  const trail = TRAILS.find((item) => item.id === trailId);
  if (!trail) return;

  state.activeTrailId = trailId;

  state.trailLayers.forEach((layer, id) => {
    layer.setStyle({
      weight: id === trailId ? 7 : 5,
      opacity: id === trailId ? 0.98 : 0.58
    });
    if (id === trailId) layer.bringToFront();
  });

  renderTrailMarkers(state.filteredTrails);
  renderSelection(trail);
  renderList();

  if (options.fit) {
    const layer = state.trailLayers.get(trailId);
    if (layer) map.fitBounds(layer.getBounds(), { ...mapFitOptions(42), maxZoom: 13 });
  }
}

function renderSelection(trail) {
  elements.selectedCity.textContent = `${trail.city}, ${trail.state}`;
  elements.selectedName.textContent = trail.name;
  elements.selectedDistance.textContent = formatDistance(routeDistanceMiles(trail));
  elements.downloadGpx.disabled = false;
  elements.downloadKml.disabled = false;
  elements.downloadGeoJson.disabled = false;
}

function renderEmptySelection() {
  elements.selectedCity.textContent = "No route selected";
  elements.selectedName.textContent = "Route details";
  elements.selectedDistance.textContent = "--";
  markerGroup.clearLayers();
  elements.downloadGpx.disabled = true;
  elements.downloadKml.disabled = true;
  elements.downloadGeoJson.disabled = true;
}

function fitFilteredTrails() {
  if (routeGroup.getLayers().length) {
    map.fitBounds(routeGroup.getBounds(), mapFitOptions(28));
  }
}

function goToSelectedCity() {
  const selectedCity = elements.cityFilter.value;
  if (selectedCity === "all") {
    fitFilteredTrails();
    return;
  }

  const cityTrails = TRAILS.filter((trail) => `${trail.city}, ${trail.state}` === selectedCity);
  const bounds = boundsForTrails(cityTrails);
  if (bounds?.isValid()) {
    map.fitBounds(bounds, { ...mapFitOptions(44), maxZoom: 12 });
  }
}

function updateRouteNumberVisibility() {
  const shouldShow = map.getZoom() >= ROUTE_NUMBER_MIN_ZOOM;
  if (shouldShow && !map.hasLayer(markerGroup)) {
    markerGroup.addTo(map);
  } else if (!shouldShow && map.hasLayer(markerGroup)) {
    map.removeLayer(markerGroup);
  }
}

function mapFitOptions(padding) {
  if (!isArticleEmbed) return { padding: [padding, padding] };

  const mapWidth = map.getSize().x;
  const panelPadding = mapWidth >= 641 && mapWidth <= 800
    ? 312
    : Math.min(370, Math.max(padding, Math.round(mapWidth * 0.52)));
  return {
    paddingTopLeft: [panelPadding, padding],
    paddingBottomRight: [padding, padding]
  };
}

function boundsForTrails(trails) {
  const bounds = L.latLngBounds([]);
  trails.forEach((trail) => {
    trail.coords.forEach((coord) => bounds.extend(coord));
  });
  return bounds;
}

function getActiveTrail() {
  return TRAILS.find((trail) => trail.id === state.activeTrailId);
}

function routeDistanceMiles(trail) {
  let meters = 0;
  for (let index = 1; index < trail.coords.length; index += 1) {
    meters += haversineMeters(trail.coords[index - 1], trail.coords[index]);
  }
  return meters / 1609.344;
}

function haversineMeters(start, end) {
  const radius = 6371000;
  const lat1 = toRadians(start[0]);
  const lat2 = toRadians(end[0]);
  const deltaLat = toRadians(end[0] - start[0]);
  const deltaLon = toRadians(end[1] - start[1]);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value) {
  return value * Math.PI / 180;
}

function formatDistance(distance) {
  return `${distance.toFixed(1)} mi`;
}

function downloadGeoJson(trails, filename) {
  const featureCollection = {
    type: "FeatureCollection",
    features: trails.map((trail) => ({
      type: "Feature",
      properties: {
        id: trail.id,
        name: trail.name,
        city: trail.city,
        state: trail.state,
        distance_miles: Number(routeDistanceMiles(trail).toFixed(2)),
        geometry_source: trail.geometrySource
      },
      geometry: {
        type: "LineString",
        coordinates: trail.coords.map(([lat, lng]) => [lng, lat])
      }
    }))
  };

  downloadText(JSON.stringify(featureCollection, null, 2), filename, "application/geo+json");
}

function downloadGpx(trails, filename) {
  const tracks = trails.map((trail) => {
    const points = trail.coords
      .map(([lat, lng]) => `      <trkpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}"></trkpt>`)
      .join("\n");

    return `  <trk>
    <name>${escapeXml(trail.name)}</name>
    <desc>${escapeXml(routeExportDescription(trail))}</desc>
    <trkseg>
${points}
    </trkseg>
  </trk>`;
  }).join("\n");

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Urban Trails Finder" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
${tracks}
</gpx>
`;

  downloadText(gpx, filename, "application/gpx+xml");
}

function downloadKml(trails, filename) {
  const placemarks = trails.map((trail) => {
    const coordinates = trail.coords
      .map(([lat, lng]) => `${lng.toFixed(6)},${lat.toFixed(6)},0`)
      .join(" ");

    return `    <Placemark>
      <name>${escapeXml(trail.name)}</name>
      <description>${escapeXml(routeExportDescription(trail))}</description>
      <styleUrl>#urban-trail-line</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>${coordinates}</coordinates>
      </LineString>
    </Placemark>`;
  }).join("\n");

  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(filename.replace(".kml", ""))}</name>
    <Style id="urban-trail-line">
      <LineStyle>
        <color>ff597c0c</color>
        <width>5</width>
      </LineStyle>
    </Style>
${placemarks}
  </Document>
</kml>
`;

  downloadText(kml, filename, "application/vnd.google-earth.kml+xml");
}

function routeExportDescription(trail) {
  return `${trail.city}, ${trail.state} | ${formatDistance(routeDistanceMiles(trail))} | ${trail.geometrySource}`;
}

function downloadText(content, filename, mimeType) {
  const blob = new Blob([content], {
    type: mimeType
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

init();
