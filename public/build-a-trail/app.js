const STORAGE_KEY = "build-a-trail.trails.v1";
const GEOCODE_CACHE_KEY = "build-a-trail.city-cache.v2";
const VALHALLA_URL = "https://valhalla1.openstreetmap.de/route";
const OSM_FOOT_URL = "https://routing.openstreetmap.de/routed-foot/route/v1/driving";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const VALHALLA_RETRY_DELAY_MS = 5 * 60 * 1000;
const MIN_CUSTOM_DISTANCE = 0.5;
const MIN_GENERATED_ROUTE_KM = 0.5;
const MIN_GENERATED_ROUTE_MILES = MIN_GENERATED_ROUTE_KM / 1.609344;
const TRAIL_COLORS = ["#2d7277", "#7b4f91", "#b34f2c", "#3f6f3a", "#3566a8", "#a53f57", "#8a6a20", "#52606d"];
const ACTIVE_COLOR = "#e25f3d";
const DEFAULT_VIEW = { lat: 20, lon: 0, zoom: 2 };
const pageParams = new URLSearchParams(window.location.search);
const QA_ROUTE_MODE = ["127.0.0.1", "localhost"].includes(window.location.hostname) && pageParams.get("qaRoute") === "1";
const CITY_SUGGESTIONS = [
  "Amsterdam, Netherlands",
  "Atlanta, Georgia",
  "Austin, Texas",
  "Baltimore, Maryland",
  "Barcelona, Spain",
  "Berlin, Germany",
  "Boston, Massachusetts",
  "Chicago, Illinois",
  "Copenhagen, Denmark",
  "Denver, Colorado",
  "Detroit, Michigan",
  "Dublin, Ireland",
  "Edinburgh, Scotland",
  "Honolulu, Hawaii",
  "Lisbon, Portugal",
  "London, England",
  "Los Angeles, California",
  "Madrid, Spain",
  "Melbourne, Australia",
  "Mexico City, Mexico",
  "Miami, Florida",
  "Minneapolis, Minnesota",
  "Montreal, Quebec",
  "New Orleans, Louisiana",
  "New York, New York",
  "Paris, France",
  "Philadelphia, Pennsylvania",
  "Portland, Oregon",
  "Prague, Czechia",
  "Rome, Italy",
  "San Diego, California",
  "San Francisco, California",
  "Seattle, Washington",
  "Sydney, Australia",
  "Tbilisi, Georgia",
  "Tokyo, Japan",
  "Toronto, Ontario",
  "Vancouver, British Columbia",
  "Vienna, Austria",
  "Washington, District of Columbia"
];

const state = {
  trails: loadTrails(),
  activeTrailId: null,
  currentCity: null,
  trailLayers: new Map(),
  draft: null,
  draftLayer: null,
  snapGuideLayer: null,
  anchorMarkers: [],
  generationCount: 0,
  routingSource: "Valhalla",
  editingTrailId: null,
  editingEnabled: false,
  addAnchorMode: false,
  snappingEnabled: true,
  showSegmentDistances: false,
  segmentDistanceLayers: [],
  selectedVertexIndex: null,
  editHistory: [],
  editHistoryIndex: -1,
  valhallaUnavailableUntil: 0,
  busy: false
};

const isArticleEmbed = pageParams.get("embed") === "article";
document.body.classList.toggle("article-embed", isArticleEmbed);

const map = L.map("map", {
  zoomControl: false,
  scrollWheelZoom: true
}).setView([DEFAULT_VIEW.lat, DEFAULT_VIEW.lon], DEFAULT_VIEW.zoom);

L.control.zoom({ position: "bottomright" }).addTo(map);

const esriAttribution = "Tiles &copy; Esri, HERE, Garmin, FAO, NOAA, USGS, EPA, NPS";
const basemaps = {
  "Esri Topographic": L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19,
    attribution: esriAttribution,
    pmIgnore: true
  }),
  "Esri Light Gray": L.layerGroup([
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 16,
      attribution: "Tiles &copy; Esri",
      pmIgnore: true
    }),
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 16,
      attribution: "Labels &copy; Esri",
      pmIgnore: true
    })
  ]),
  Satellite: L.layerGroup([
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: "Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      pmIgnore: true
    }),
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: "Labels &copy; Esri",
      pmIgnore: true
    })
  ]),
  OpenStreetMap: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    pmIgnore: true
  })
};

let activeBasemap = basemaps["Esri Topographic"];
activeBasemap.addTo(map);

const savedRouteGroup = L.featureGroup().addTo(map);
const savedMarkerGroup = L.featureGroup().addTo(map);
const draftGroup = L.featureGroup().addTo(map);

const elements = {
  citySearchForm: document.getElementById("citySearchForm"),
  citySearch: document.getElementById("citySearch"),
  cityResults: document.getElementById("cityResults"),
  cityStatus: document.getElementById("cityStatus"),
  routeStatus: document.getElementById("routeStatus"),
  routeServiceLog: document.getElementById("routeServiceLog"),
  customTrailLength: document.getElementById("customTrailLength"),
  buildTrailButton: document.getElementById("buildTrailButton"),
  editPanel: document.getElementById("editPanel"),
  editStatus: document.getElementById("editStatus"),
  editModeStatus: document.getElementById("editModeStatus"),
  editingToggleButton: document.getElementById("editingToggleButton"),
  snappingToggleButton: document.getElementById("snappingToggleButton"),
  segmentDistancesButton: document.getElementById("segmentDistancesButton"),
  undoEditButton: document.getElementById("undoEditButton"),
  redoEditButton: document.getElementById("redoEditButton"),
  mapEditControls: document.getElementById("mapEditControls"),
  mapSnappingToggleButton: document.getElementById("mapSnappingToggleButton"),
  mapAddAnchorButton: document.getElementById("mapAddAnchorButton"),
  vertexRemovePopup: document.getElementById("vertexRemovePopup"),
  mapUndoEditButton: document.getElementById("mapUndoEditButton"),
  mapRedoEditButton: document.getElementById("mapRedoEditButton"),
  vertexCount: document.getElementById("vertexCount"),
  discardDraftButton: document.getElementById("discardDraftButton"),
  trailName: document.getElementById("trailName"),
  keepTrailButton: document.getElementById("keepTrailButton"),
  trailCount: document.getElementById("trailCount"),
  trailList: document.getElementById("trailList"),
  downloadAllGpx: document.getElementById("downloadAllGpx"),
  downloadAllKml: document.getElementById("downloadAllKml"),
  downloadAllGeoJson: document.getElementById("downloadAllGeoJson"),
  sidebar: document.getElementById("trailSidebar"),
  closeSidebarButton: document.getElementById("closeSidebarButton"),
  openSidebarButton: document.getElementById("openSidebarButton"),
  basemapButtons: document.querySelectorAll(".basemap-button"),
  mapTip: document.getElementById("mapTip")
};

function init() {
  state.activeTrailId = state.trails[0]?.id ?? null;
  bindEvents();
  setBusy(false);
  renderSavedTrails();

  if (window.lucide) window.lucide.createIcons();

  window.requestAnimationFrame(() => {
    map.invalidateSize();
    if (state.trails.length) fitTrails(state.trails);
  });
}

function bindEvents() {
  elements.citySearchForm.addEventListener("submit", handleCitySearch);
  elements.citySearch.addEventListener("input", showCitySuggestions);
  elements.buildTrailButton.addEventListener("click", generateTrail);
  elements.customTrailLength.addEventListener("focus", selectCustomLength);
  elements.customTrailLength.addEventListener("input", selectCustomLength);
  elements.customTrailLength.addEventListener("keydown", restrictCustomLengthKeys);
  document.querySelectorAll('input[name="distanceUnit"]').forEach((input) => {
    input.addEventListener("change", handleDistanceUnitChange);
  });
  elements.editingToggleButton.addEventListener("click", toggleEditing);
  elements.snappingToggleButton.addEventListener("click", toggleSnapping);
  elements.segmentDistancesButton.addEventListener("click", toggleSegmentDistances);
  elements.undoEditButton.addEventListener("click", undoEdit);
  elements.redoEditButton.addEventListener("click", redoEdit);
  elements.mapUndoEditButton.addEventListener("click", undoEdit);
  elements.mapRedoEditButton.addEventListener("click", redoEdit);
  elements.mapSnappingToggleButton.addEventListener("click", toggleSnapping);
  elements.mapAddAnchorButton.addEventListener("click", toggleAddAnchorMode);
  elements.vertexRemovePopup.addEventListener("click", removeSelectedVertex);
  elements.discardDraftButton.addEventListener("click", discardDraft);
  elements.keepTrailButton.addEventListener("click", keepDraft);
  elements.trailName.addEventListener("keydown", (event) => {
    if (event.key === "Enter") keepDraft();
  });

  elements.downloadAllGpx.addEventListener("click", () => downloadGpx(visibleTrails(), "build-a-trail-visible.gpx"));
  elements.downloadAllKml.addEventListener("click", () => downloadKml(visibleTrails(), "build-a-trail-visible.kml"));
  elements.downloadAllGeoJson.addEventListener("click", () => downloadGeoJson(visibleTrails(), "build-a-trail-visible.geojson"));

  elements.basemapButtons.forEach((button) => {
    button.addEventListener("click", () => setBasemap(button.dataset.basemap));
  });
  if (isArticleEmbed) {
    elements.closeSidebarButton.addEventListener("click", () => setSidebarOpen(false));
    elements.openSidebarButton.addEventListener("click", () => setSidebarOpen(true));
  }

  map.on("movestart", () => {
    hideVertexRemovalPopup();
    if (state.draft) updateMapEditTip();
    else {
      elements.mapTip.innerHTML = '<i data-lucide="crosshair"></i> Trail will start near the map center';
      if (window.lucide) window.lucide.createIcons();
    }
  });
  map.on("click", handleMapAddAnchor);
  window.addEventListener("resize", () => map.invalidateSize());
}

async function handleCitySearch(event) {
  event.preventDefault();
  const query = elements.citySearch.value.trim();
  if (!query || state.busy) return;

  setBusy(true);
  setStatus(elements.cityStatus, `Finding ${query}…`, "working");

  try {
    const places = await searchCities(query);
    if (!places.length) throw new Error("No city matched that search. Try including a state or country.");
    renderCityResults(places);
    setStatus(elements.cityStatus, `Choose one of ${places.length} matching ${places.length === 1 ? "place" : "places"}.`);
  } catch (error) {
    hideCityResults();
    setStatus(elements.cityStatus, error.message || "City search is unavailable right now.", "error");
  } finally {
    setBusy(false);
  }
}

function showCitySuggestions() {
  const query = elements.citySearch.value.trim().toLocaleLowerCase();
  if (!query) {
    hideCityResults();
    return;
  }

  const startsWith = CITY_SUGGESTIONS.filter((city) => city.toLocaleLowerCase().startsWith(query));
  const contains = CITY_SUGGESTIONS.filter((city) => !city.toLocaleLowerCase().startsWith(query) && city.toLocaleLowerCase().includes(query));
  const matches = [...startsWith, ...contains].slice(0, 6);
  if (!matches.length) {
    hideCityResults();
    setStatus(elements.cityStatus, "Press Enter or the search button to look up this city.");
    return;
  }

  elements.cityResults.innerHTML = "";
  matches.forEach((city) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "city-result";
    button.setAttribute("role", "option");
    button.innerHTML = `<strong>${escapeHtml(city)}</strong><small>Search this city</small>`;
    button.addEventListener("click", () => {
      elements.citySearch.value = city;
      elements.citySearchForm.requestSubmit();
    });
    elements.cityResults.appendChild(button);
  });
  elements.cityResults.hidden = false;
  setStatus(elements.cityStatus, "Choose a suggestion, or keep typing and submit any city.");
}

async function searchCities(query) {
  const cache = loadJson(GEOCODE_CACHE_KEY, {});
  const key = query.toLocaleLowerCase();
  if (cache[key]) return cache[key];

  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    featuretype: "settlement",
    limit: "5",
    dedupe: "1"
  });
  const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error(`City search returned ${response.status}. Please try again shortly.`);

  const results = await response.json();
  const places = results.map((result) => {
    const fallbackBounds = L.latLng(Number(result.lat), Number(result.lon)).toBounds(12000);
    const bounds = result.boundingbox?.length === 4
      ? [[Number(result.boundingbox[0]), Number(result.boundingbox[2])], [Number(result.boundingbox[1]), Number(result.boundingbox[3])]]
      : [[fallbackBounds.getSouth(), fallbackBounds.getWest()], [fallbackBounds.getNorth(), fallbackBounds.getEast()]];
    return {
      name: concisePlaceName(result),
      detail: result.display_name,
      lat: Number(result.lat),
      lon: Number(result.lon),
      bounds
    };
  });

  cache[key] = places;
  localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
  return places;
}

function renderCityResults(places) {
  elements.cityResults.innerHTML = "";
  places.forEach((place) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "city-result";
    button.setAttribute("role", "option");
    button.innerHTML = `<strong>${escapeHtml(place.name)}</strong><small>${escapeHtml(place.detail)}</small>`;
    button.addEventListener("click", () => selectCity(place));
    elements.cityResults.appendChild(button);
  });
  elements.cityResults.hidden = false;
  elements.cityResults.querySelector("button")?.focus();
}

function selectCity(place) {
  state.currentCity = place;
  map.fitBounds(place.bounds, { padding: [28, 28], maxZoom: 13 });
  elements.citySearch.value = place.name;
  hideCityResults();
  setStatus(elements.cityStatus, `Map centered on ${place.name}.`);
  setBusy(false);
  elements.mapTip.innerHTML = '<i data-lucide="move"></i> Pan the map to choose a starting area';
  if (window.lucide) window.lucide.createIcons();
}

function hideCityResults() {
  elements.cityResults.hidden = true;
  elements.cityResults.innerHTML = "";
}

function concisePlaceName(result) {
  const address = result.address || {};
  const locality = address.city || address.town || address.village || address.municipality || result.name;
  const region = address.state || address.region || address.country;
  return [locality, region].filter(Boolean).join(", ") || result.display_name;
}

async function generateTrail() {
  if (state.busy) return;
  if (state.draft) {
    setStatus(elements.routeStatus, "Keep or discard the current trail before building another.", "error");
    return;
  }
  const selectedLength = document.querySelector('input[name="trailLength"]:checked')?.value || "2";
  const targetDistance = selectedLength === "custom" ? Number(elements.customTrailLength.value) : Number(selectedLength);
  const unit = getDistanceUnit();
  if (!Number.isFinite(targetDistance) || targetDistance < MIN_CUSTOM_DISTANCE || targetDistance > 25) {
    selectCustomLength();
    elements.customTrailLength.focus();
    setStatus(elements.routeStatus, `Enter a custom trail length from 0.5 to 25 ${unit}.`, "error");
    return;
  }
  const targetMiles = unit === "kilometers" ? targetDistance / 1.609344 : targetDistance;
  const center = map.getCenter();
  const generationIndex = state.generationCount;

  state.generationCount += 1;
  setBusy(true);
  setStatus(elements.routeStatus, QA_ROUTE_MODE ? "Creating a local regression route…" : "Finding a walkable loop…", "working");

  try {
    state.editingTrailId = null;
    resetRouteServiceLog();
    if (QA_ROUTE_MODE) addRouteServiceMessage("Using the local regression route fixture.", "success");
    const generated = await generateDistanceMatchedLoop(center, targetMiles, generationIndex);
    const { coords, controls, attempts } = generated;
    if (QA_ROUTE_MODE) state.routingSource = "Local regression fixture";
    const simplified = simplifyRoute(coords, 10);
    showDraft(simplified, targetMiles, { resetHistory: true, anchorPoints: uniqueLoopCoords(controls) });
    const editPrompt = state.editingEnabled ? "Drag anchor points or select one to remove it." : "Turn editing on to revise it.";
    if (attempts > 1) addRouteServiceMessage(`Adjusted the loop toward ${formatDistance(targetMiles)}.`, "success");
    setStatus(elements.routeStatus, `${formatDistance(routeDistanceMiles({ coords: simplified }))} candidate ready via ${state.routingSource}. ${editPrompt}`);
  } catch (error) {
    setStatus(elements.routeStatus, friendlyRoutingError(error), "error");
  } finally {
    setBusy(false);
  }
}

async function generateDistanceMatchedLoop(center, targetMiles, generationIndex) {
  const maxAttempts = QA_ROUTE_MODE ? 1 : 4;
  let controlMiles = targetMiles;
  let best = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controls = createLoopControlPoints(center, controlMiles, generationIndex);
    const routedCoords = QA_ROUTE_MODE ? createQaEditSegment(controls) : await requestPedestrianRoute(controls);
    const coords = cleanRoutedGeometry(routedCoords);
    const actualMiles = routeDistanceMiles({ coords: simplifyRoute(coords, 10) });
    const relativeError = Math.abs(actualMiles - targetMiles) / targetMiles;
    const meetsMinimum = actualMiles >= MIN_GENERATED_ROUTE_MILES;
    if (meetsMinimum && (!best || relativeError < best.relativeError)) {
      best = { coords, controls, actualMiles, relativeError, attempts: attempt };
    }
    if (meetsMinimum && (relativeError <= 0.08 || attempt === maxAttempts)) break;

    if (!meetsMinimum) {
      if (attempt < maxAttempts) {
        controlMiles *= 1.6;
        addRouteServiceMessage(`Route was under ${MIN_GENERATED_ROUTE_KM.toFixed(1)} km. Retrying with a wider loop…`, "working");
        setStatus(elements.routeStatus, `The route was too short. Trying a wider walkable loop…`, "working");
      }
      continue;
    }

    const scale = Math.max(0.35, Math.min(1.8, targetMiles / actualMiles));
    controlMiles *= scale;
    setStatus(
      elements.routeStatus,
      `${formatDistance(actualMiles)} found. Adjusting the loop toward ${formatDistance(targetMiles)}…`,
      "working"
    );
  }

  if (!best) {
    throw new Error(`the pedestrian router could not create a route of at least ${MIN_GENERATED_ROUTE_KM.toFixed(1)} km`);
  }
  return best;
}

function createQaRoute(center, targetMiles) {
  const radiusMiles = targetMiles / 6.2;
  const latMilesPerDegree = 69;
  const lonMilesPerDegree = Math.max(20, 69 * Math.cos(toRadians(center.lat)));
  const points = Array.from({ length: 12 }, (_, index) => {
    const angle = (Math.PI * 2 * index / 12) + Math.PI / 12;
    const wobble = index % 2 ? 0.92 : 1.06;
    return [
      Number((center.lat + (Math.sin(angle) * radiusMiles * wobble / latMilesPerDegree)).toFixed(6)),
      Number((center.lng + (Math.cos(angle) * radiusMiles * wobble / lonMilesPerDegree)).toFixed(6))
    ];
  });
  points.push([...points[0]]);
  return points;
}

function selectCustomLength() {
  document.querySelector('input[name="trailLength"][value="custom"]').checked = true;
}

function restrictCustomLengthKeys(event) {
  if (["e", "E", "+", "-"].includes(event.key)) event.preventDefault();
}

function getDistanceUnit() {
  return document.querySelector('input[name="distanceUnit"]:checked')?.value || "kilometers";
}

function handleDistanceUnitChange() {
  renderSavedTrails();
  if (state.draft) syncDraftCoords();
}

function createLoopControlPoints(center, targetMiles, generationIndex) {
  const pointCount = 6;
  const radiusMiles = targetMiles / 6.2;
  const rotation = (generationIndex * 0.73) + Math.PI / 8;
  const latMilesPerDegree = 69;
  const lonMilesPerDegree = Math.max(20, 69 * Math.cos(toRadians(center.lat)));
  const points = [];

  for (let index = 0; index < pointCount; index += 1) {
    const angle = rotation + (Math.PI * 2 * index / pointCount);
    const wobble = 0.88 + (((index + generationIndex) % 3) * 0.08);
    points.push([
      Number((center.lat + (Math.sin(angle) * radiusMiles * wobble / latMilesPerDegree)).toFixed(6)),
      Number((center.lng + (Math.cos(angle) * radiusMiles * wobble / lonMilesPerDegree)).toFixed(6))
    ]);
  }

  points.push([...points[0]]);
  return points;
}

async function requestPedestrianRoute(controlPoints) {
  const request = {
    locations: controlPoints.map(([lat, lon]) => ({ lat, lon, type: "break" })),
    costing: "pedestrian",
    units: "kilometers",
    directions_options: { units: "kilometers" }
  };
  resetRouteServiceLog();

  if (Date.now() < state.valhallaUnavailableUntil) {
    addRouteServiceMessage("Valhalla is unavailable from an earlier attempt.", "error");
    addRouteServiceMessage("Trying OpenStreetMap's pedestrian router…", "working");
    setStatus(elements.routeStatus, "Using OpenStreetMap's pedestrian router while Valhalla is unavailable…", "working");
    return requestOsmPedestrianRoute(controlPoints);
  }

  addRouteServiceMessage("Trying Valhalla pedestrian routing…", "working");
  try {
    const response = await fetchWithTimeout(VALHALLA_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Client-Id": "ameliarowland.github.io-build-a-trail"
      },
      body: JSON.stringify(request)
    });
    if (!response.ok) throw new Error(`Valhalla returned ${response.status}`);

    const json = await response.json();
    if (!json.trip?.legs?.length) throw new Error("Valhalla did not return a route");
    const coords = json.trip.legs.flatMap((leg, index) => {
      const decoded = decodePolyline(leg.shape);
      return index === 0 ? decoded : decoded.slice(1);
    });
    if (coords.length < 3) throw new Error("Valhalla returned too little geometry");
    state.valhallaUnavailableUntil = 0;
    state.routingSource = "Valhalla";
    addRouteServiceMessage("Valhalla route received.", "success");
    return coords;
  } catch (valhallaError) {
    state.valhallaUnavailableUntil = Date.now() + VALHALLA_RETRY_DELAY_MS;
    addRouteServiceMessage("Unable to access Valhalla.", "error");
    addRouteServiceMessage("Trying OpenStreetMap's pedestrian router…", "working");
    setStatus(elements.routeStatus, "Valhalla is unavailable. Trying OpenStreetMap's pedestrian router…", "working");
    try {
      return await requestOsmPedestrianRoute(controlPoints);
    } catch (fallbackError) {
      addRouteServiceMessage("Unable to access OpenStreetMap pedestrian routing.", "error");
      throw new Error(`both pedestrian routers were unavailable: ${fallbackError.message || valhallaError.message}`);
    }
  }
}

async function requestOsmPedestrianRoute(controlPoints) {
  const points = controlPoints.map(([lat, lon]) => `${lon},${lat}`).join(";");
  const url = `${OSM_FOOT_URL}/${points}?overview=full&geometries=geojson&steps=false`;
  const response = await fetchWithTimeout(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`OSM pedestrian router returned ${response.status}`);
  const json = await response.json();
  const geometry = json.routes?.[0]?.geometry?.coordinates;
  if (!geometry?.length) throw new Error("OSM pedestrian router did not return a route");
  state.routingSource = "OSM pedestrian routing";
  addRouteServiceMessage("OpenStreetMap pedestrian route received.", "success");
  return geometry.map(([lon, lat]) => [lat, lon]);
}

function resetRouteServiceLog() {
  elements.routeServiceLog.replaceChildren();
  elements.routeServiceLog.hidden = false;
}

function addRouteServiceMessage(message, kind = "") {
  const item = document.createElement("p");
  item.className = `route-service-message${kind ? ` is-${kind}` : ""}`;
  item.textContent = message;
  elements.routeServiceLog.append(item);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

function showDraft(coords, targetMiles, options = {}) {
  const existingName = elements.trailName.value;
  const previousDraft = state.draft;
  const resetHistory = options.resetHistory ?? !previousDraft;
  if (resetHistory) state.editingEnabled = false;
  clearDraftLayers();
  const requestedAnchorPoints = options.anchorPoints || previousDraft?.anchorPoints || deriveAnchorPoints(coords);
  state.draft = {
    coords: cloneCoords(coords),
    originalCoords: cloneCoords(previousDraft?.originalCoords || coords),
    anchorPoints: snapAnchorPointsToRoute(requestedAnchorPoints, coords),
    targetMiles,
    city: options.city || previousDraft?.city || state.currentCity?.name || "Map location",
    routingSource: state.routingSource
  };

  state.snapGuideLayer = L.polyline(coords, {
    opacity: 0,
    weight: 18,
    interactive: false,
    pmIgnore: true,
    snapIgnore: true
  }).addTo(draftGroup);

  state.draftLayer = L.polyline(coords, {
    color: ACTIVE_COLOR,
    weight: 6,
    opacity: 0.96,
    lineJoin: "round",
    pmIgnore: true,
    snapIgnore: true
  }).addTo(draftGroup);
  renderAnchorMarkers();

  elements.editPanel.hidden = false;
  elements.trailName.value = existingName || (state.draft.city === "Map location" ? "My trail" : `My ${shortCityName(state.draft.city)} trail`);
  updateVertexCount();
  renderSegmentDistances();
  updateEditingControls();
  if (resetHistory) resetEditHistory(coords, state.draft.anchorPoints);
  else if (options.recordHistory) recordEditHistory(options.historyLabel || "Edited route");
  else updateHistoryControls();
  if (options.fit !== false) focusDraftRoute();
  updateMapEditTip();
  if (window.lucide) window.lucide.createIcons();
}

function syncDraftCoords(options = {}) {
  if (!state.draftLayer || !state.draft) return;
  state.draft.coords = latLngsToCoords(state.draftLayer.getLatLngs());
  updateVertexCount();
  renderSegmentDistances();
  updateMapEditTip();
  if (options.announce !== false) {
    setStatus(elements.routeStatus, `${formatDistance(routeDistanceMiles(state.draft))} edited trail. Undo is available.`);
  }
}

function renderAnchorMarkers() {
  state.anchorMarkers.forEach((marker) => draftGroup.removeLayer(marker));
  state.anchorMarkers = [];
  if (!state.draft || !state.editingEnabled) return;
  state.draft.anchorPoints.forEach((point, index) => {
    const marker = L.marker(point, {
      draggable: true,
      keyboard: true,
      bubblingMouseEvents: false,
      title: `Anchor point ${index + 1}`,
      alt: `Anchor point ${index + 1}`,
      pmIgnore: true,
      icon: L.divIcon({
        className: "trail-anchor-marker",
        html: '<span aria-hidden="true"></span>',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      })
    }).addTo(draftGroup);
    const markerElement = marker.getElement();
    markerElement?.setAttribute("aria-label", `Anchor point ${index + 1}`);
    marker.on("click", () => openVertexRemovalPopup(marker.getLatLng(), index));
    marker.on("dragstart", hideVertexRemovalPopup);
    marker.on("dragend", () => handleAnchorDragEnd(index, marker.getLatLng()));
    state.anchorMarkers.push(marker);
  });
}

function deriveAnchorPoints(coords, count = 6) {
  const uniqueCoords = uniqueLoopCoords(coords);
  if (uniqueCoords.length <= count) return uniqueCoords;
  return Array.from({ length: count }, (_, index) => (
    [...uniqueCoords[Math.round(index * uniqueCoords.length / count) % uniqueCoords.length]]
  ));
}

function snapAnchorPointsToRoute(anchorPoints, routeCoords) {
  if (routeCoords.length < 2) return cloneCoords(anchorPoints);
  return anchorPoints.map((point) => nearestPointOnRoute(point, routeCoords).point);
}

function nearestPointOnRoute(point, routeCoords) {
  const projectionZoom = 18;
  const routePoints = routeCoords.map(([lat, lon]) => map.project(L.latLng(lat, lon), projectionZoom));
  const anchor = map.project(L.latLng(point[0], point[1]), projectionZoom);
  let nearest = routePoints[0];
  let nearestDistance = Infinity;
  let segmentIndex = 0;
  let segmentAmount = 0;
  for (let index = 0; index < routePoints.length - 1; index += 1) {
    const start = routePoints[index];
    const end = routePoints[index + 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = (dx * dx) + (dy * dy);
    const amount = lengthSquared
      ? Math.max(0, Math.min(1, (((anchor.x - start.x) * dx) + ((anchor.y - start.y) * dy)) / lengthSquared))
      : 0;
    const candidate = L.point(start.x + (dx * amount), start.y + (dy * amount));
    const distance = anchor.distanceTo(candidate);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = candidate;
      segmentIndex = index;
      segmentAmount = amount;
    }
  }
  const snapped = map.unproject(nearest, projectionZoom);
  return {
    point: [snapped.lat, snapped.lng],
    segmentIndex,
    segmentAmount,
    distanceMeters: map.distance(L.latLng(point[0], point[1]), snapped)
  };
}

function toggleSegmentDistances() {
  if (!state.draft || state.busy) return;
  state.showSegmentDistances = !state.showSegmentDistances;
  renderSegmentDistances();
  updateEditingControls();
  setStatus(elements.routeStatus, state.showSegmentDistances ? "Segment distances are shown on the map." : "Segment distances are hidden.");
}

function renderSegmentDistances() {
  state.segmentDistanceLayers.forEach((layer) => draftGroup.removeLayer(layer));
  state.segmentDistanceLayers = [];
  if (!state.showSegmentDistances || !state.draft || state.draft.coords.length < 2) return;

  const route = state.draft.coords;
  const cumulative = [0];
  for (let index = 1; index < route.length; index += 1) {
    cumulative.push(cumulative[index - 1] + haversineMeters(route[index - 1], route[index]));
  }
  const totalMeters = cumulative[cumulative.length - 1];
  if (!totalMeters) return;

  const anchors = state.draft.anchorPoints.map((point) => {
    const projection = nearestPointOnRoute(point, route);
    const edgeMeters = haversineMeters(route[projection.segmentIndex], route[projection.segmentIndex + 1]);
    return { ...projection, offsetMeters: cumulative[projection.segmentIndex] + (edgeMeters * projection.segmentAmount) };
  });

  anchors.forEach((start, index) => {
    const end = anchors[(index + 1) % anchors.length];
    let segmentMeters = end.offsetMeters - start.offsetMeters;
    if (segmentMeters < 0) segmentMeters += totalMeters;
    if (segmentMeters < 1) return;
    const midpoint = pointAtRouteOffset(route, cumulative, (start.offsetMeters + (segmentMeters / 2)) % totalMeters);
    const label = L.marker(midpoint, {
      interactive: false,
      keyboard: false,
      pmIgnore: true,
      icon: L.divIcon({
        className: "segment-distance-marker",
        html: `<span>${escapeHtml(formatDistance(segmentMeters / 1609.344))}</span>`,
        iconSize: [72, 24],
        iconAnchor: [36, 12]
      })
    }).addTo(draftGroup);
    state.segmentDistanceLayers.push(label);
  });
}

function pointAtRouteOffset(route, cumulative, offsetMeters) {
  let index = cumulative.findIndex((distance) => distance >= offsetMeters);
  if (index <= 0) return [...route[0]];
  const startDistance = cumulative[index - 1];
  const edgeDistance = cumulative[index] - startDistance;
  const amount = edgeDistance ? (offsetMeters - startDistance) / edgeDistance : 0;
  return [
    route[index - 1][0] + ((route[index][0] - route[index - 1][0]) * amount),
    route[index - 1][1] + ((route[index][1] - route[index - 1][1]) * amount)
  ];
}

function insertPointInRoute(routeCoords, segmentIndex, point) {
  const coords = cloneCoords(routeCoords);
  coords.splice(Math.min(segmentIndex + 1, coords.length - 1), 0, [...point]);
  return coords;
}

function movePointNearAnchor(routeCoords, anchorPoint, movedPoint) {
  const coords = cloneCoords(routeCoords);
  const wasClosed = coordsEqual(coords[0], coords[coords.length - 1]);
  const uniqueLength = uniqueLoopCoords(coords).length;
  let nearestIndex = 0;
  let nearestDistance = Infinity;
  for (let index = 0; index < uniqueLength; index += 1) {
    const distance = map.distance(L.latLng(coords[index][0], coords[index][1]), L.latLng(anchorPoint[0], anchorPoint[1]));
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  }
  if (nearestDistance <= 6) {
    coords[nearestIndex] = [...movedPoint];
    if (nearestIndex === 0 && wasClosed) coords[coords.length - 1] = [...movedPoint];
    return closeLoop(uniqueLoopCoords(coords));
  }
  const projection = nearestPointOnRoute(anchorPoint, coords);
  return insertPointInRoute(coords, projection.segmentIndex, movedPoint);
}

function removePointNearAnchor(routeCoords, anchorPoint) {
  const uniqueCoords = uniqueLoopCoords(routeCoords);
  let nearestIndex = -1;
  let nearestDistance = Infinity;
  uniqueCoords.forEach((point, index) => {
    const distance = map.distance(L.latLng(point[0], point[1]), L.latLng(anchorPoint[0], anchorPoint[1]));
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });
  if (nearestIndex < 0 || nearestDistance > 6 || uniqueCoords.length <= 3) return cloneCoords(routeCoords);
  uniqueCoords.splice(nearestIndex, 1);
  return closeLoop(uniqueCoords);
}

function toggleEditing() {
  if (!state.draftLayer || state.busy) return;
  state.editingEnabled = !state.editingEnabled;
  if (!state.editingEnabled) setAddAnchorMode(false);
  map.closePopup();
  renderAnchorMarkers();
  updateEditingControls();
  updateHistoryControls();
  updateMapEditTip();
  setStatus(elements.routeStatus, state.editingEnabled
    ? "Editing is on. Drag an anchor point or select it to remove it."
    : "Editing is off. The route is locked against anchor changes.");
}

function toggleAddAnchorMode() {
  if (!state.draft || !state.editingEnabled || state.busy) return;
  setAddAnchorMode(!state.addAnchorMode);
  setStatus(elements.routeStatus, state.addAnchorMode
    ? "Click on or near the route to add an anchor point."
    : "Anchor-point placement cancelled.");
}

function setAddAnchorMode(active) {
  state.addAnchorMode = Boolean(active && state.draft && state.editingEnabled && !state.busy);
  elements.mapAddAnchorButton.setAttribute("aria-pressed", String(state.addAnchorMode));
  map.getContainer().classList.toggle("is-adding-anchor", state.addAnchorMode);
  updateMapEditTip();
}

async function handleMapAddAnchor(event) {
  if (!state.addAnchorMode || !state.draft || state.busy) return;
  const clickedPoint = [event.latlng.lat, event.latlng.lng];
  const projection = nearestPointOnRoute(clickedPoint, state.draft.coords);
  const anchorLocations = state.draft.anchorPoints.map((point) => nearestPointOnRoute(point, state.draft.coords));
  let insertIndex = anchorLocations.findIndex((anchor, index) => index > 0 && anchor.segmentIndex > projection.segmentIndex);
  if (insertIndex < 0) insertIndex = state.draft.anchorPoints.length;
  const anchorPoint = projection.distanceMeters <= 20 ? projection.point : clickedPoint;
  const anchors = cloneCoords(state.draft.anchorPoints);
  anchors.splice(insertIndex, 0, anchorPoint);
  const freeformCoords = insertPointInRoute(state.draft.coords, projection.segmentIndex, anchorPoint);
  setAddAnchorMode(false);
  await applyAnchorEdit(anchors, {
    historyLabel: `Added anchor point ${insertIndex + 1}`,
    workingMessage: "Adding an anchor point and connecting it to the walkable route…",
    successMessage: "Anchor point added",
    freeformCoords
  });
}

function toggleSnapping() {
  if (!state.draftLayer || state.busy) return;
  state.snappingEnabled = !state.snappingEnabled;
  updateEditingControls();
  setStatus(elements.routeStatus, state.snappingEnabled
    ? "Snapping is on. Anchor changes will reroute the line along walkable streets."
    : "Snapping is off. Moved or added anchors may leave the mapped network; the rest of the routed line stays fixed.");
}

function updateEditingControls() {
  const editingLabel = state.editingEnabled ? "Editing on" : "Editing off";
  const snappingLabel = state.snappingEnabled ? "Snapping on" : "Snapping off";
  const distanceLabel = state.showSegmentDistances ? "Hide segment distances" : "Show segment distances";
  elements.editModeStatus.textContent = editingLabel;
  elements.editStatus.classList.toggle("is-active", state.editingEnabled);
  setToggleButton(elements.editingToggleButton, state.editingEnabled, editingLabel);
  setToggleButton(elements.snappingToggleButton, state.snappingEnabled, snappingLabel);
  setToggleButton(elements.segmentDistancesButton, state.showSegmentDistances, distanceLabel);
  elements.mapSnappingToggleButton.classList.toggle("is-active", state.snappingEnabled);
  elements.mapSnappingToggleButton.setAttribute("aria-pressed", String(state.snappingEnabled));
  elements.mapSnappingToggleButton.setAttribute("aria-label", snappingLabel);
  elements.mapSnappingToggleButton.title = snappingLabel;
}

function setToggleButton(button, active, label) {
  button.classList.toggle("is-active", active);
  button.setAttribute("aria-pressed", String(active));
  button.querySelector("span").textContent = label;
}

function updateMapEditTip() {
  const distance = state.draft ? formatDistance(routeDistanceMiles(state.draft)) : "";
  elements.mapTip.innerHTML = state.addAnchorMode
    ? `<i data-lucide="plus"></i> ${distance} · Click on or near the route`
    : state.editingEnabled
    ? `<i data-lucide="mouse-pointer-2"></i> ${distance} · Drag an anchor · select for minus removal`
    : `<i data-lucide="lock"></i> Editing is off${distance ? ` · ${distance}` : ""}`;
  if (window.lucide) window.lucide.createIcons();
}

function openVertexRemovalPopup(point, index) {
  if (!state.editingEnabled || state.busy) return;
  const latLng = point.getLatLng?.() || point;
  const mapPoint = map.latLngToContainerPoint(latLng);
  state.selectedVertexIndex = index;
  elements.vertexRemovePopup.style.left = `${mapPoint.x}px`;
  elements.vertexRemovePopup.style.top = `${mapPoint.y}px`;
  elements.vertexRemovePopup.setAttribute("aria-label", `Remove anchor point ${index + 1}`);
  elements.vertexRemovePopup.title = `Remove anchor point ${index + 1}`;
  elements.vertexRemovePopup.hidden = false;
  elements.vertexRemovePopup.focus();
}

function removeSelectedVertex() {
  if (state.selectedVertexIndex === null) return;
  removeDraftVertex(state.selectedVertexIndex);
}

function hideVertexRemovalPopup() {
  state.selectedVertexIndex = null;
  elements.vertexRemovePopup.hidden = true;
}

async function removeDraftVertex(index) {
  if (!state.draftLayer || !state.draft || state.busy) return;
  if (state.draft.anchorPoints.length <= 3) {
    hideVertexRemovalPopup();
    setStatus(elements.routeStatus, "A loop needs at least three anchor points.", "error");
    return;
  }
  hideVertexRemovalPopup();
  const anchors = cloneCoords(state.draft.anchorPoints);
  const anchorNumber = index + 1;
  const freeformCoords = removePointNearAnchor(state.draft.coords, anchors[index]);
  anchors.splice(index, 1);
  await applyAnchorEdit(anchors, {
    historyLabel: `Removed anchor point ${anchorNumber}`,
    workingMessage: `Removing anchor point ${anchorNumber} and rerouting between the remaining anchors…`,
    successMessage: `Anchor point ${anchorNumber} removed`,
    freeformCoords
  });
}

async function handleAnchorDragEnd(index, latLng) {
  if (!state.draft || state.busy) return;
  const anchors = cloneCoords(state.draft.anchorPoints);
  const freeformCoords = movePointNearAnchor(state.draft.coords, anchors[index], [latLng.lat, latLng.lng]);
  anchors[index] = [latLng.lat, latLng.lng];
  await applyAnchorEdit(anchors, {
    historyLabel: `Moved anchor point ${index + 1}`,
    workingMessage: `Moving anchor point ${index + 1} and rerouting the adjacent walkable line…`,
    successMessage: `Anchor point ${index + 1} moved`,
    freeformCoords
  });
}

async function applyAnchorEdit(anchorPoints, messages) {
  const targetMiles = state.draft.targetMiles;
  const freeformCoords = messages.freeformCoords || cloneCoords(state.draft.coords);

  if (!state.snappingEnabled) {
    showDraft(freeformCoords, targetMiles, { fit: false, anchorPoints, recordHistory: true, historyLabel: messages.historyLabel });
    setStatus(elements.routeStatus, `${messages.successMessage} locally; the rest of the mapped route is unchanged. Undo is available.`);
    return;
  }

  setBusy(true);
  setStatus(elements.routeStatus, messages.workingMessage, "working");
  try {
    const controls = closeLoop(anchorPoints);
    const routedCoords = QA_ROUTE_MODE ? createQaEditSegment(controls) : await requestPedestrianRoute(controls);
    if (QA_ROUTE_MODE) {
      resetRouteServiceLog();
      addRouteServiceMessage("Using the local regression route fixture.", "success");
      state.routingSource = "Local regression fixture";
    }
    const adjusted = simplifyRoute(cleanRoutedGeometry(routedCoords), 10);
    showDraft(adjusted, targetMiles, {
      fit: false,
      anchorPoints,
      recordHistory: true,
      historyLabel: messages.historyLabel
    });
    setStatus(elements.routeStatus, `${messages.successMessage}; the line was rerouted through ${anchorPoints.length} anchors via ${state.routingSource}.`);
  } catch (error) {
    showDraft(freeformCoords, targetMiles, {
      fit: false,
      anchorPoints,
      recordHistory: true,
      historyLabel: messages.historyLabel
    });
    setStatus(elements.routeStatus, `${messages.successMessage}, but walkable-street fitting was unavailable (${error.message}).`, "error");
  } finally {
    setBusy(false);
  }
}

function alignClosedLoopStart(coords, preferredStart) {
  const uniqueCoords = uniqueLoopCoords(coords);
  const startIndex = uniqueCoords.findIndex((point) => coordsEqual(point, preferredStart));
  if (startIndex <= 0) return closeLoop(uniqueCoords);
  return closeLoop(uniqueCoords.slice(startIndex).concat(uniqueCoords.slice(0, startIndex)));
}

function uniqueLoopCoords(coords) {
  const copied = cloneCoords(coords);
  return copied.length > 2 && coordsEqual(copied[0], copied[copied.length - 1]) ? copied.slice(0, -1) : copied;
}

function closeLoop(coords) {
  const result = coords.reduce((points, point) => {
    if (!points.length || !coordsEqual(points[points.length - 1], point)) points.push([...point]);
    return points;
  }, []);
  if (result.length && !coordsEqual(result[0], result[result.length - 1])) result.push([...result[0]]);
  return result;
}

function cleanRoutedGeometry(coords) {
  let cleaned = cloneCoords(coords);
  let removedSpur = true;
  while (removedSpur && cleaned.length > 4) {
    removedSpur = false;
    outer: for (let startIndex = 0; startIndex < cleaned.length - 2; startIndex += 1) {
      let traveled = 0;
      let furthest = 0;
      const start = L.latLng(cleaned[startIndex][0], cleaned[startIndex][1]);
      for (let endIndex = startIndex + 1; endIndex < cleaned.length; endIndex += 1) {
        traveled += map.distance(
          L.latLng(cleaned[endIndex - 1][0], cleaned[endIndex - 1][1]),
          L.latLng(cleaned[endIndex][0], cleaned[endIndex][1])
        );
        if (traveled > 400) break;
        furthest = Math.max(furthest, map.distance(start, L.latLng(cleaned[endIndex][0], cleaned[endIndex][1])));
        const returnedDistance = map.distance(start, L.latLng(cleaned[endIndex][0], cleaned[endIndex][1]));
        if (endIndex >= startIndex + 2 && returnedDistance <= 18 && furthest >= 25) {
          cleaned.splice(startIndex + 1, endIndex - startIndex - 1);
          removedSpur = true;
          break outer;
        }
      }
    }
  }
  return closeLoop(uniqueLoopCoords(cleaned));
}

function createQaEditSegment(controlPoints) {
  const result = [];
  controlPoints.slice(0, -1).forEach((start, index) => {
    const end = controlPoints[index + 1];
    for (let step = 0; step < 4; step += 1) {
      const amount = step / 4;
      result.push([
        start[0] + ((end[0] - start[0]) * amount),
        start[1] + ((end[1] - start[1]) * amount)
      ]);
    }
  });
  result.push([...controlPoints[controlPoints.length - 1]]);
  return result;
}

function updateVertexCount() {
  const count = state.draft?.anchorPoints?.length || 0;
  elements.vertexCount.textContent = `${count} ${count === 1 ? "anchor point" : "anchor points"}`;
}

function resetEditHistory(coords, anchorPoints) {
  state.editHistory = [{ coords: cloneCoords(coords), anchorPoints: cloneCoords(anchorPoints), label: "Generated route" }];
  state.editHistoryIndex = 0;
  updateHistoryControls();
}

function recordEditHistory(label) {
  if (!state.draftLayer || !state.draft) return;
  syncDraftCoords({ announce: false });
  const coords = cloneCoords(state.draft.coords);
  const anchorPoints = cloneCoords(state.draft.anchorPoints);
  const current = state.editHistory[state.editHistoryIndex];
  if (current && JSON.stringify(current.coords) === JSON.stringify(coords) && JSON.stringify(current.anchorPoints) === JSON.stringify(anchorPoints)) {
    updateHistoryControls();
    return;
  }
  state.editHistory = state.editHistory.slice(0, state.editHistoryIndex + 1);
  state.editHistory.push({ coords, anchorPoints, label });
  if (state.editHistory.length > 50) state.editHistory.shift();
  state.editHistoryIndex = state.editHistory.length - 1;
  updateHistoryControls();
}

function undoEdit() {
  if (state.busy || state.editHistoryIndex <= 0) return;
  state.editHistoryIndex -= 1;
  applyEditHistory("Undid");
}

function redoEdit() {
  if (state.busy || state.editHistoryIndex >= state.editHistory.length - 1) return;
  state.editHistoryIndex += 1;
  applyEditHistory("Redid");
}

function applyEditHistory(action) {
  const entry = state.editHistory[state.editHistoryIndex];
  if (!entry || !state.draft) return;
  const targetMiles = state.draft.targetMiles;
  showDraft(entry.coords, targetMiles, { fit: false, anchorPoints: entry.anchorPoints });
  updateHistoryControls();
  setStatus(elements.routeStatus, `${action} ${entry.label.toLowerCase()}.`);
}

function updateHistoryControls() {
  const canUndo = !state.busy && state.editHistoryIndex > 0;
  const canRedo = !state.busy && state.editHistoryIndex >= 0 && state.editHistoryIndex < state.editHistory.length - 1;
  [elements.undoEditButton, elements.mapUndoEditButton].forEach((button) => { button.disabled = !canUndo; });
  [elements.redoEditButton, elements.mapRedoEditButton].forEach((button) => { button.disabled = !canRedo; });
  elements.mapSnappingToggleButton.hidden = !state.editingEnabled;
  elements.mapSnappingToggleButton.disabled = state.busy || !state.draft || !state.editingEnabled;
  elements.mapAddAnchorButton.hidden = !state.editingEnabled;
  elements.mapAddAnchorButton.disabled = state.busy || !state.draft || !state.editingEnabled;
  elements.mapEditControls.hidden = !state.draft || (!state.editingEnabled && !canUndo && !canRedo);
}

function coordsEqual(first, second) {
  return first?.[0] === second?.[0] && first?.[1] === second?.[1];
}

function sampleRouteControls(coords, maxControls) {
  if (coords.length <= maxControls) return cloneCoords(coords);
  const controls = [];
  const lastIndex = coords.length - 1;
  for (let index = 0; index < maxControls - 1; index += 1) {
    controls.push([...coords[Math.round(index * lastIndex / (maxControls - 1))]]);
  }
  controls.push([...controls[0]]);
  return controls;
}

function keepDraft() {
  if (!state.draft || state.busy) return;
  const name = elements.trailName.value.trim();
  if (!name) {
    elements.trailName.focus();
    setStatus(elements.routeStatus, "Give the trail a name before keeping it.", "error");
    return;
  }

  syncDraftCoords();
  const existingTrail = state.trails.find((item) => item.id === state.editingTrailId);
  const trail = {
    id: state.editingTrailId || createTrailId(),
    name,
    city: state.draft.city,
    geometrySource: `${state.draft.routingSource} over OpenStreetMap, edited by the user`,
    coords: cloneCoords(state.draft.coords),
    anchorPoints: cloneCoords(state.draft.anchorPoints),
    targetMiles: state.draft.targetMiles,
    routingSource: state.draft.routingSource,
    color: existingTrail?.color || nextTrailColor(),
    visible: true,
    createdAt: existingTrail?.createdAt || new Date().toISOString()
  };

  if (state.editingTrailId) {
    state.trails = state.trails.map((item) => item.id === state.editingTrailId ? trail : item);
  } else {
    state.trails.unshift(trail);
  }
  state.activeTrailId = trail.id;
  persistTrails();
  discardDraft({ preserveStatus: true });
  renderSavedTrails();
  selectTrail(trail.id, { fit: true });
  setStatus(elements.routeStatus, `Saved “${trail.name}”. Build another whenever you are ready.`);
}

function discardDraft(options = {}) {
  clearDraftLayers();
  state.draft = null;
  state.editingTrailId = null;
  state.editingEnabled = false;
  setAddAnchorMode(false);
  state.editHistory = [];
  state.editHistoryIndex = -1;
  elements.mapEditControls.hidden = true;
  elements.trailName.value = "";
  updateVertexCount();
  updateEditingControls();
  updateHistoryControls();
  setBusy(false);
  elements.mapTip.innerHTML = '<i data-lucide="move"></i> Pan the map to choose a starting area';
  if (!options.preserveStatus) setStatus(elements.routeStatus, "Candidate discarded. Build another trail whenever you are ready.");
  renderSavedTrails();
  if (window.lucide) window.lucide.createIcons();
}

function clearDraftLayers() {
  hideVertexRemovalPopup();
  draftGroup.clearLayers();
  state.draftLayer = null;
  state.snapGuideLayer = null;
  state.anchorMarkers = [];
  state.segmentDistanceLayers = [];
}

function renderSavedTrails() {
  savedRouteGroup.clearLayers();
  savedMarkerGroup.clearLayers();
  state.trailLayers.clear();

  state.trails.forEach((trail, index) => {
    if (trail.id === state.editingTrailId) return;
    if (!trail.visible) return;
    const active = trail.id === state.activeTrailId;
    const trailColor = trail.color || trailColorForIndex(index);
    const layer = L.polyline(trail.coords, {
      color: trailColor,
      weight: active ? 6 : 5,
      opacity: active ? 0.98 : 0.76,
      lineJoin: "round",
      pmIgnore: true
    }).addTo(savedRouteGroup);
    layer.on("click", () => selectTrail(trail.id));
    state.trailLayers.set(trail.id, layer);

    const start = trail.coords[0];
    if (start) {
      L.marker(start, {
        icon: L.divIcon({ className: "", html: `<div class="route-start-marker" style="--trail-color:${trailColor}">S</div>`, iconSize: [28, 28], iconAnchor: [14, 14] }),
        keyboard: false,
        pmIgnore: true
      }).addTo(savedMarkerGroup);
    }
  });

  renderTrailList();
  updateExportButtons();
}

function renderTrailList() {
  elements.trailCount.textContent = String(state.trails.length);
  elements.trailList.innerHTML = "";

  if (!state.trails.length) {
    elements.trailList.innerHTML = '<div class="empty-state"><i data-lucide="route"></i><p>Your kept trails will appear here.</p></div>';
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  state.trails.forEach((trail, index) => {
    const card = document.createElement("article");
    card.className = `trail-card${trail.id === state.activeTrailId ? " is-active" : ""}${trail.visible ? "" : " is-hidden"}`;
    card.dataset.trailId = trail.id;
    card.style.setProperty("--trail-color", trail.color || trailColorForIndex(index));
    const isEditing = state.editingTrailId === trail.id && Boolean(state.draft);
    card.innerHTML = `
      <label class="visibility-toggle" title="Show or hide ${escapeHtml(trail.name)}">
        <span class="sr-only">Show ${escapeHtml(trail.name)}</span>
        <input type="checkbox" data-action="visibility" ${trail.visible ? "checked" : ""}>
      </label>
      <button class="trail-select" type="button" data-action="select">
        <strong>${escapeHtml(trail.name)}</strong>
        <small>${escapeHtml(trail.city)} · ${formatDistance(routeDistanceMiles(trail))}</small>
      </button>
      <button class="trail-remove" type="button" data-action="remove" aria-label="Remove ${escapeHtml(trail.name)}"><i data-lucide="x"></i></button>
      <div class="trail-editor">
        <label class="sr-only" for="rename-${trail.id}">Change trail name</label>
        <input id="rename-${trail.id}" type="text" maxlength="64" value="${escapeAttribute(trail.name)}" data-action="rename-input">
        <button class="secondary-action" type="button" data-action="rename">Rename</button>
      </div>
      <div class="trail-export-row" aria-label="Export ${escapeHtml(trail.name)}">
        <button class="text-button" type="button" data-action="gpx">GPX</button>
        <button class="text-button" type="button" data-action="kml">KML</button>
        <button class="text-button" type="button" data-action="geojson">GeoJSON</button>
      </div>
      <div class="trail-edit-actions">
        <button class="secondary-action trail-edit-route" type="button" data-action="edit" ${isEditing ? "disabled" : ""}>
          <i data-lucide="pencil-line"></i>
          Edit trail
        </button>
        <button class="secondary-action trail-save-edits" type="button" data-action="save-edits" ${isEditing ? "" : "disabled"}>
          <i data-lucide="save"></i>
          Save edits
        </button>
      </div>`;

    card.addEventListener("click", (event) => handleTrailCardClick(event, trail.id));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && event.target.dataset.action === "rename-input") renameTrail(trail.id, event.target.value);
    });
    elements.trailList.appendChild(card);
  });

  if (window.lucide) window.lucide.createIcons();
}

function handleTrailCardClick(event, trailId) {
  const action = event.target.closest("[data-action]")?.dataset.action;
  const trail = state.trails.find((item) => item.id === trailId);
  if (!trail || !action) return;

  if (action === "select") selectTrail(trailId, { fit: true });
  if (action === "edit") editSavedTrail(trailId);
  if (action === "save-edits" && state.editingTrailId === trailId) keepDraft();
  if (action === "visibility") {
    trail.visible = event.target.checked;
    if (!trail.visible && state.activeTrailId === trailId) state.activeTrailId = state.trails.find((item) => item.visible && item.id !== trailId)?.id ?? null;
    persistTrails();
    renderSavedTrails();
  }
  if (action === "remove") removeTrail(trailId);
  if (action === "rename") {
    const input = event.currentTarget.querySelector('[data-action="rename-input"]');
    renameTrail(trailId, input.value);
  }
  if (action === "gpx") downloadGpx([trail], `${safeFilename(trail.name)}.gpx`);
  if (action === "kml") downloadKml([trail], `${safeFilename(trail.name)}.kml`);
  if (action === "geojson") downloadGeoJson([trail], `${safeFilename(trail.name)}.geojson`);
}

function selectTrail(trailId, options = {}) {
  const trail = state.trails.find((item) => item.id === trailId);
  if (!trail) return;
  state.activeTrailId = trailId;
  if (!trail.visible) trail.visible = true;
  renderSavedTrails();
  if (options.fit) fitTrails([trail]);
}

function editSavedTrail(trailId) {
  const trail = state.trails.find((item) => item.id === trailId);
  if (!trail || state.busy) return;
  if (state.draft) {
    setStatus(elements.routeStatus, "Keep or discard the trail currently being edited before opening another.", "error");
    return;
  }

  state.editingTrailId = trailId;
  state.routingSource = trail.routingSource || "Saved route";
  elements.trailName.value = trail.name;
  renderSavedTrails();
  showDraft(trail.coords, trail.targetMiles || routeDistanceMiles(trail), {
    resetHistory: true,
    anchorPoints: trail.anchorPoints || deriveAnchorPoints(trail.coords),
    city: trail.city
  });
  state.editingEnabled = true;
  renderAnchorMarkers();
  updateEditingControls();
  updateHistoryControls();
  updateMapEditTip();
  setBusy(false);
  renderTrailList();
  setStatus(elements.routeStatus, `Editing “${trail.name}”. Save the trail to keep your changes.`);
}

function trailColorForIndex(index) {
  return TRAIL_COLORS[index % TRAIL_COLORS.length];
}

function nextTrailColor() {
  const usedColors = new Set(state.trails.map((trail) => trail.color).filter(Boolean));
  return TRAIL_COLORS.find((color) => !usedColors.has(color)) || trailColorForIndex(state.trails.length);
}

function renameTrail(trailId, value) {
  const trail = state.trails.find((item) => item.id === trailId);
  const name = value.trim();
  if (!trail || !name) return;
  trail.name = name;
  persistTrails();
  renderSavedTrails();
}

function removeTrail(trailId) {
  const trail = state.trails.find((item) => item.id === trailId);
  if (!trail || !window.confirm(`Remove “${trail.name}”?`)) return;
  state.trails = state.trails.filter((item) => item.id !== trailId);
  if (state.activeTrailId === trailId) state.activeTrailId = state.trails[0]?.id ?? null;
  persistTrails();
  renderSavedTrails();
}

function updateExportButtons() {
  const disabled = visibleTrails().length === 0;
  elements.downloadAllGpx.disabled = disabled;
  elements.downloadAllKml.disabled = disabled;
  elements.downloadAllGeoJson.disabled = disabled;
}

function visibleTrails() {
  return state.trails.filter((trail) => trail.visible);
}

function setBasemap(name) {
  const next = basemaps[name];
  if (!next || next === activeBasemap) return;
  map.removeLayer(activeBasemap);
  activeBasemap = next;
  activeBasemap.addTo(map);
  elements.basemapButtons.forEach((button) => {
    const active = button.dataset.basemap === name;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function setSidebarOpen(open) {
  elements.sidebar.classList.toggle("is-closed", !open);
  elements.openSidebarButton.classList.toggle("is-visible", !open);
  elements.openSidebarButton.setAttribute("aria-expanded", String(open));
}

function setBusy(busy) {
  state.busy = busy;
  const hasDraft = Boolean(state.draft);
  elements.citySearch.disabled = busy;
  elements.buildTrailButton.disabled = busy;
  elements.editingToggleButton.disabled = busy || !hasDraft;
  elements.snappingToggleButton.disabled = busy || !hasDraft;
  elements.segmentDistancesButton.disabled = busy || !hasDraft;
  elements.mapSnappingToggleButton.disabled = busy || !hasDraft || !state.editingEnabled;
  elements.discardDraftButton.disabled = busy || !hasDraft;
  elements.trailName.disabled = busy || !hasDraft;
  elements.keepTrailButton.disabled = busy || !hasDraft;
  elements.mapAddAnchorButton.disabled = busy || !hasDraft || !state.editingEnabled;
  updateHistoryControls();
}

function setStatus(element, message, kind = "") {
  element.textContent = message;
  element.classList.toggle("is-error", kind === "error");
  element.classList.toggle("is-working", kind === "working");
}

function friendlyRoutingError(error) {
  const detail = error?.message ? ` (${error.message})` : "";
  return `A walkable loop could not be generated here${detail}. Pan to a nearby walkable area and try again.`;
}

function fitTrails(trails) {
  const coords = trails.flatMap((trail) => trail.coords);
  if (coords.length) map.fitBounds(L.latLngBounds(coords), mapFitOptions(42));
}

function focusDraftRoute() {
  if (!state.draftLayer) return;
  const bounds = state.draftLayer.getBounds();
  if (!bounds.isValid()) return;
  window.requestAnimationFrame(() => {
    map.invalidateSize();
    window.requestAnimationFrame(() => {
      map.fitBounds(bounds, mapFitOptions(44));
    });
  });
}

function mapFitOptions(padding) {
  const sidebarOverlaysMap = isArticleEmbed && !elements.sidebar.classList.contains("is-closed") && window.innerWidth > 640;
  const panelWidth = sidebarOverlaysMap ? elements.sidebar.getBoundingClientRect().width : 0;
  return {
    paddingTopLeft: [panelWidth + padding, padding],
    paddingBottomRight: [padding, padding],
    maxZoom: 15
  };
}

function simplifyRoute(coords, toleranceMeters) {
  if (coords.length <= 3) return cloneCoords(coords);
  const first = coords[0];
  const last = coords[coords.length - 1];
  let maxDistance = 0;
  let splitIndex = 0;

  for (let index = 1; index < coords.length - 1; index += 1) {
    const distance = pointToSegmentMeters(coords[index], first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      splitIndex = index;
    }
  }

  if (maxDistance > toleranceMeters) {
    const left = simplifyRoute(coords.slice(0, splitIndex + 1), toleranceMeters);
    const right = simplifyRoute(coords.slice(splitIndex), toleranceMeters);
    return left.slice(0, -1).concat(right);
  }
  return [first, last];
}

function pointToSegmentMeters(point, start, end) {
  const referenceLat = toRadians((start[0] + end[0] + point[0]) / 3);
  const metersPerLonDegree = 111320 * Math.cos(referenceLat);
  const px = point[1] * metersPerLonDegree;
  const py = point[0] * 110540;
  const sx = start[1] * metersPerLonDegree;
  const sy = start[0] * 110540;
  const ex = end[1] * metersPerLonDegree;
  const ey = end[0] * 110540;
  const dx = ex - sx;
  const dy = ey - sy;
  const lengthSquared = (dx * dx) + (dy * dy);
  const ratio = lengthSquared ? Math.max(0, Math.min(1, (((px - sx) * dx) + ((py - sy) * dy)) / lengthSquared)) : 0;
  return Math.hypot(px - (sx + ratio * dx), py - (sy + ratio * dy));
}

function decodePolyline(shape) {
  let index = 0;
  let lat = 0;
  let lon = 0;
  const coordinates = [];

  while (index < shape.length) {
    const latitudeChange = decodeSignedValue(shape, index);
    index = latitudeChange.index;
    const longitudeChange = decodeSignedValue(shape, index);
    index = longitudeChange.index;
    lat += latitudeChange.value;
    lon += longitudeChange.value;
    coordinates.push([Number((lat / 1e6).toFixed(6)), Number((lon / 1e6).toFixed(6))]);
  }
  return coordinates;
}

function decodeSignedValue(shape, startIndex) {
  let result = 0;
  let shift = 0;
  let index = startIndex;
  let byte;
  do {
    byte = shape.charCodeAt(index) - 63;
    index += 1;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20);
  return { value: result & 1 ? ~(result >> 1) : result >> 1, index };
}

function routeDistanceMiles(trail) {
  let meters = 0;
  for (let index = 1; index < trail.coords.length; index += 1) meters += haversineMeters(trail.coords[index - 1], trail.coords[index]);
  return meters / 1609.344;
}

function haversineMeters(start, end) {
  const earthRadius = 6371000;
  const dLat = toRadians(end[0] - start[0]);
  const dLon = toRadians(end[1] - start[1]);
  const lat1 = toRadians(start[0]);
  const lat2 = toRadians(end[0]);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value) { return value * Math.PI / 180; }
function formatDistance(valueMiles, unit = getDistanceUnit()) {
  return unit === "kilometers"
    ? `${(valueMiles * 1.609344).toFixed(1)} km`
    : `${valueMiles.toFixed(1)} mi`;
}
function shortCityName(value) { return value.split(",")[0]; }
function cloneCoords(coords) { return coords.map(([lat, lon]) => [Number(lat), Number(lon)]); }
function latLngsToCoords(latlngs) { return latlngs.map((latlng) => [Number(latlng.lat.toFixed(6)), Number(latlng.lng.toFixed(6))]); }
function createTrailId() { return `trail-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }
function safeFilename(value) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "trail"; }

function loadTrails() {
  const trails = loadJson(STORAGE_KEY, []);
  if (!Array.isArray(trails)) return [];
  return trails.filter((trail) => trail && trail.id && trail.name && Array.isArray(trail.coords) && trail.coords.length > 1).map((trail, index) => ({ ...trail, color: trail.color || trailColorForIndex(index), visible: trail.visible !== false }));
}

function persistTrails() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.trails));
}

function loadJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function downloadGeoJson(trails, filename) {
  if (!trails.length) return;
  const collection = {
    type: "FeatureCollection",
    features: trails.map((trail) => ({
      type: "Feature",
      properties: {
        id: trail.id,
        name: trail.name,
        city: trail.city,
        distance_km: Number((routeDistanceMiles(trail) * 1.609344).toFixed(2)),
        distance_miles: Number(routeDistanceMiles(trail).toFixed(2)),
        geometry_source: trail.geometrySource
      },
      geometry: { type: "LineString", coordinates: trail.coords.map(([lat, lon]) => [lon, lat]) }
    }))
  };
  downloadText(JSON.stringify(collection, null, 2), filename, "application/geo+json");
}

function downloadGpx(trails, filename) {
  if (!trails.length) return;
  const tracks = trails.map((trail) => `  <trk>\n    <name>${escapeXml(trail.name)}</name>\n    <desc>${escapeXml(routeExportDescription(trail))}</desc>\n    <trkseg>\n${trail.coords.map(([lat, lon]) => `      <trkpt lat="${lat}" lon="${lon}"></trkpt>`).join("\n")}\n    </trkseg>\n  </trk>`).join("\n");
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Build a Trail" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">\n${tracks}\n</gpx>\n`;
  downloadText(gpx, filename, "application/gpx+xml");
}

function downloadKml(trails, filename) {
  if (!trails.length) return;
  const placemarks = trails.map((trail) => `    <Placemark>\n      <name>${escapeXml(trail.name)}</name>\n      <description>${escapeXml(routeExportDescription(trail))}</description>\n      <styleUrl>#trail-style</styleUrl>\n      <LineString>\n        <tessellate>1</tessellate>\n        <coordinates>\n${trail.coords.map(([lat, lon]) => `          ${lon},${lat},0`).join("\n")}\n        </coordinates>\n      </LineString>\n    </Placemark>`).join("\n");
  const kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n    <name>Build a Trail exports</name>\n    <Style id="trail-style"><LineStyle><color>ff3d5fe2</color><width>5</width></LineStyle></Style>\n${placemarks}\n  </Document>\n</kml>\n`;
  downloadText(kml, filename, "application/vnd.google-earth.kml+xml");
}

function routeExportDescription(trail) {
  return `${trail.city} | ${formatDistance(routeDistanceMiles(trail))} | ${trail.geometrySource}`;
}

function downloadText(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
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
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function escapeHtml(value) { return escapeXml(value); }
function escapeAttribute(value) { return escapeHtml(value); }

init();
