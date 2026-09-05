const STORAGE_KEY = "urban-trails-development-plan.trails.v2";
const GEOCODE_CACHE_KEY = "urban-trails-development-plan.city-cache.v1";
const COLOR_SETTINGS_KEY = "urban-trails-development-plan.colors.v2";
const SPATIAL_EXPORT_VERSION_KEY = "urban-trails-development-plan.spatial-export-version.v1";
const VALHALLA_URL = "https://valhalla1.openstreetmap.de/route";
const OSM_FOOT_URL = "https://routing.openstreetmap.de/routed-foot/route/v1/driving";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const VALHALLA_RETRY_DELAY_MS = 5 * 60 * 1000;
const MIN_CUSTOM_DISTANCE = 0.5;
const MAX_ROUTE_OVERLAP = 0.1;
const MAX_OVERLAP_ATTEMPTS = 18;
const MIN_LOOP_CIRCULARITY = 0.18;
const MIN_LOOP_ASPECT_RATIO = 0.28;
const MAX_LOOP_LEG_SHARE = 0.34;
const MAX_LOOP_LEG_DETOUR = 3.2;
const TRAIL_COLORS = ["#2d7277", "#7b4f91", "#b34f2c", "#3f6f3a", "#3566a8", "#a53f57", "#8a6a20", "#52606d", "#9a5b13", "#087e8b"];
const ROUTE_COLOR_PALETTES = {
  classic: TRAIL_COLORS,
  bright: ["#ff4d00", "#7c3cff", "#00a8ff", "#00c853", "#ff2d95", "#ffb000", "#006dff", "#8e24aa", "#00a884", "#e53935"],
  highlighter: ["#ffea00", "#ff3df2", "#00efff", "#7dff00", "#ff6b00", "#9b5cff", "#00ff9d", "#ff477e", "#c6ff00", "#00b8ff"]
};
const ACTIVE_COLOR = "#e25f3d";
const DEFAULT_VIEW = { lat: 20, lon: 0, zoom: 2 };
const pageParams = new URLSearchParams(window.location.search);
const IS_LOCAL_DEVELOPMENT = ["127.0.0.1", "localhost"].includes(window.location.hostname);
const QA_ROUTE_MODE = IS_LOCAL_DEVELOPMENT && pageParams.get("qaRoute") === "1";
const savedColorSettings = loadJson(COLOR_SETTINGS_KEY, {});
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
  trails: IS_LOCAL_DEVELOPMENT ? [] : loadTrails(),
  activeTrailId: null,
  hoveredTrailId: null,
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
  distanceUnit: "kilometers",
  routeColorMode: savedColorSettings.mode === "multi" ? "multi" : "mono",
  routePalette: ROUTE_COLOR_PALETTES[savedColorSettings.palette] ? savedColorSettings.palette : "classic",
  monoColor: normalizeHexColor(savedColorSettings.monoColor, "#173a3c"),
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
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: "Roads &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors",
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

let activeBasemapName = "OpenStreetMap";
let activeBasemap = basemaps[activeBasemapName];
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
  minDistance: document.getElementById("minDistance"),
  maxDistance: document.getElementById("maxDistance"),
  minDistanceSlider: document.getElementById("minDistanceSlider"),
  maxDistanceSlider: document.getElementById("maxDistanceSlider"),
  rangeFill: document.getElementById("rangeFill"),
  minDistanceOutput: document.getElementById("minDistanceOutput"),
  maxDistanceOutput: document.getElementById("maxDistanceOutput"),
  distanceUnitLabels: document.querySelectorAll(".distance-unit-label"),
  routeCount: document.getElementById("routeCount"),
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
  keepTrailButton: document.getElementById("keepTrailButton"),
  trailCount: document.getElementById("trailCount"),
  trailList: document.getElementById("trailList"),
  downloadAllGpx: document.getElementById("downloadAllGpx"),
  downloadAllKml: document.getElementById("downloadAllKml"),
  downloadAllGeoJson: document.getElementById("downloadAllGeoJson"),
  downloadMap: document.getElementById("downloadMap"),
  downloadPdf: document.getElementById("downloadPdf"),
  downloadImage: document.getElementById("downloadImage"),
  monoColorMode: document.getElementById("monoColorMode"),
  multiColorMode: document.getElementById("multiColorMode"),
  monoColorChoices: document.getElementById("monoColorChoices"),
  multiColorChoices: document.getElementById("multiColorChoices"),
  customRouteColor: document.getElementById("customRouteColor"),
  colorSwatches: document.querySelectorAll("[data-route-color]"),
  paletteSwatches: document.querySelectorAll("[data-route-palette]"),
  sidebar: document.getElementById("trailSidebar"),
  closeSidebarButton: document.getElementById("closeSidebarButton"),
  openSidebarButton: document.getElementById("openSidebarButton"),
  basemapButtons: document.querySelectorAll(".basemap-button"),
  mapTip: document.getElementById("mapTip")
};

function init() {
  state.activeTrailId = null;
  bindEvents();
  updateDistanceRange();
  updateRouteColorPicker();
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
  elements.buildTrailButton.addEventListener("click", generateTrails);
  elements.minDistance.addEventListener("input", () => updateDistanceRange("min-number"));
  elements.maxDistance.addEventListener("input", () => updateDistanceRange("max-number"));
  elements.minDistanceSlider.addEventListener("input", () => updateDistanceRange("min-slider"));
  elements.maxDistanceSlider.addEventListener("input", () => updateDistanceRange("max-slider"));
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
  elements.downloadAllGpx.addEventListener("click", () => downloadGpx(visibleTrailsInCurrentExtent(), "urban-trails-plan.gpx"));
  elements.downloadAllKml.addEventListener("click", () => downloadKml(visibleTrailsInCurrentExtent(), "urban-trails-plan.kml"));
  elements.downloadAllGeoJson.addEventListener("click", () => downloadGeoJson(visibleTrailsInCurrentExtent(), "urban-trails-plan.geojson"));
  elements.downloadMap.addEventListener("click", exportShareableMap);
  elements.downloadPdf.addEventListener("click", exportPdfMap);
  elements.downloadImage.addEventListener("click", exportImageMap);
  elements.monoColorMode.addEventListener("click", () => setRouteColorMode("mono"));
  elements.multiColorMode.addEventListener("click", () => setRouteColorMode("multi"));
  elements.customRouteColor.addEventListener("input", (event) => applyMonoRouteColor(event.target.value));
  elements.colorSwatches.forEach((button) => {
    button.addEventListener("click", () => applyMonoRouteColor(button.dataset.routeColor));
  });
  elements.paletteSwatches.forEach((button) => {
    button.addEventListener("click", () => applyMulticolorPalette(button.dataset.routePalette));
  });

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
  map.on("click", handleMapRouteSelection);
  map.on("click", handleMapAddAnchor);
  map.on("mousemove", handleMapRouteHover);
  map.on("zoomend moveend resize", renderSavedRouteLabels);
  map.on("zoomend moveend resize", updateExportButtons);
  map.getContainer().addEventListener("mouseleave", () => setHoveredTrail(null));
  window.addEventListener("resize", () => map.invalidateSize());
}

async function handleCitySearch(event) {
  event.preventDefault();
  const query = elements.citySearch.value.trim();
  await searchAndShowCity(query);
}

async function searchAndShowCity(query, selectFirst = false) {
  if (!query || state.busy) return;

  setBusy(true);
  setStatus(elements.cityStatus, `Finding ${query}…`, "working");

  try {
    const places = await searchCities(query);
    if (!places.length) throw new Error("No city matched that search. Try including a state or country.");
    if (selectFirst) {
      selectCity(places[0]);
      return;
    }
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
      searchAndShowCity(city, true);
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

async function generateTrails() {
  if (state.busy) return;
  if (state.draft) {
    setStatus(elements.routeStatus, "Save or discard the route currently being edited before generating a new plan set.", "error");
    return;
  }
  const unit = getDistanceUnit();
  const minDistance = Number(elements.minDistance.value);
  const maxDistance = Number(elements.maxDistance.value);
  if (!Number.isFinite(minDistance) || !Number.isFinite(maxDistance) || minDistance < MIN_CUSTOM_DISTANCE || maxDistance > 25 || minDistance >= maxDistance) {
    setStatus(elements.routeStatus, `Choose a distance range from 0.5 to 25 ${unit}, with the maximum above the minimum.`, "error");
    return;
  }
  const minMiles = unit === "kilometers" ? minDistance / 1.609344 : minDistance;
  const maxMiles = unit === "kilometers" ? maxDistance / 1.609344 : maxDistance;
  const baseCenter = map.getCenter();
  const searchedCityBounds = state.currentCity?.bounds ? L.latLngBounds(state.currentCity.bounds) : null;
  const mapCenterIsInSearchedCity = Boolean(searchedCityBounds?.contains(baseCenter));
  const routeSearchBounds = mapCenterIsInSearchedCity ? searchedCityBounds : map.getBounds();
  const planningCity = mapCenterIsInSearchedCity ? state.currentCity.name : "Map location";
  const routeCount = Math.max(1, Math.min(10, Number(elements.routeCount.value) || 10));
  const existingTrails = state.trails.filter((trail) => trail.coords?.length);
  const generatedTrails = [];
  let routeControlScale = 0.72;

  setBusy(true);
  setStatus(elements.routeStatus, QA_ROUTE_MODE ? `Creating ${routeCount} local regression routes…` : `Generating route 1 of ${routeCount}…`, "working");

  try {
    state.editingTrailId = null;
    resetRouteServiceLog();
    if (QA_ROUTE_MODE) addRouteServiceMessage("Using the local regression route fixture.", "success");
    if (state.currentCity && !mapCenterIsInSearchedCity) addRouteServiceMessage("The map has moved outside the searched city; using the current map area instead.", "success");
    else addRouteServiceMessage("Searching across the selected city for viable loops.", "success");
    for (let index = 0; index < routeCount; index += 1) {
      setStatus(elements.routeStatus, `Generating route ${index + 1} of ${routeCount}…`, "working");
      try {
        const targetMiles = routeCount === 1
          ? (minMiles + maxMiles) / 2
          : minMiles + ((maxMiles - minMiles) * index / (routeCount - 1));
        let accepted = null;
        let lowestOverlap = Infinity;
        let lastCandidateError = null;
        for (let overlapAttempt = 0; overlapAttempt < MAX_OVERLAP_ATTEMPTS; overlapAttempt += 1) {
          const generationIndex = state.generationCount;
          state.generationCount += 1;
          const routeCenter = planningCenter(baseCenter, index, routeCount, overlapAttempt, targetMiles, routeSearchBounds);
          try {
            const generated = await generateDistanceMatchedLoop(routeCenter, targetMiles, minMiles, maxMiles, generationIndex, routeControlScale);
            routeControlScale = Math.max(0.35, Math.min(1.25, (routeControlScale * 0.25) + (generated.suggestedControlScale * 0.75)));
            const simplified = simplifyRoute(generated.coords, 10);
            const overlap = routeOverlapRatio(simplified, [...existingTrails, ...generatedTrails]);
            lowestOverlap = Math.min(lowestOverlap, overlap);
            if (overlap <= MAX_ROUTE_OVERLAP) {
              accepted = { ...generated, simplified, targetMiles, overlap };
              break;
            }
            addRouteServiceMessage(`Route ${index + 1} overlapped ${(overlap * 100).toFixed(0)}%; trying another part of the city.`, "working");
          } catch (error) {
            lastCandidateError = error;
            const reason = error.code === "ROUTE_QUALITY"
              ? `failed the loop-quality check (${error.message})`
              : error.message || "was unavailable";
            addRouteServiceMessage(`Route ${index + 1} candidate ${reason}; trying another part of the map.`, "working");
          }
        }
        if (!accepted) {
          const reason = Number.isFinite(lowestOverlap)
            ? `no alternative stayed below 10% overlap (best ${(lowestOverlap * 100).toFixed(0)}%)`
            : lastCandidateError?.message || "no usable pedestrian route was returned";
          throw new Error(reason);
        }
        const { controls, attempts, simplified, overlap } = accepted;
        if (QA_ROUTE_MODE) state.routingSource = "Local regression fixture";
        const city = planningCity;
        const routeNumber = nextRouteNumber(city, generatedTrails);
        generatedTrails.push({
          id: createTrailId(),
          name: `${shortCityName(city)} Route ${routeNumber}`,
          city,
          geometrySource: `${state.routingSource} over OpenStreetMap, generated for planning review`,
          coords: cloneCoords(simplified),
          anchorPoints: cloneCoords(uniqueLoopCoords(controls)),
          targetMiles,
          routingSource: state.routingSource,
          color: trailColorForIndex(index),
          visible: true,
          createdAt: new Date().toISOString(),
          overlapPercent: Number((overlap * 100).toFixed(1))
        });
        addRouteServiceMessage(`Route ${index + 1} ready at ${(overlap * 100).toFixed(0)}% overlap${attempts > 1 ? " after distance adjustment" : ""}.`, "success");
      } catch (error) {
        addRouteServiceMessage(`Route ${index + 1} could not be generated: ${error.message}`, "error");
      }
    }
    if (!generatedTrails.length) throw new Error("the routing services did not return any usable concepts");
    state.trails = [...generatedTrails, ...state.trails];
    state.activeTrailId = null;
    persistTrails();
    renderSavedTrails();
    fitTrails(generatedTrails);
    setStatus(elements.routeStatus, `${generatedTrails.length} of ${routeCount} routes are ready across the selected distance range, each with no more than 10% overlap. Select one on the map or in the list to edit it.`);
  } catch (error) {
    setStatus(elements.routeStatus, friendlyRoutingError(error), "error");
  } finally {
    setBusy(false);
  }
}

async function generateDistanceMatchedLoop(center, targetMiles, minMiles, maxMiles, generationIndex, initialControlScale = 0.72) {
  const maxAttempts = QA_ROUTE_MODE ? 1 : 6;
  let controlMiles = targetMiles * Math.max(0.35, Math.min(1.25, initialControlScale));
  let best = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controls = createLoopControlPoints(center, controlMiles, generationIndex);
    const routedCoords = QA_ROUTE_MODE ? createQaEditSegment(controls) : await requestPedestrianRoute(controls);
    const coords = cleanRoutedGeometry(routedCoords);
    const loopQuality = assessLoopQuality(coords, controls);
    if (!loopQuality.acceptable) {
      const qualityError = new Error(loopQuality.reason);
      qualityError.code = "ROUTE_QUALITY";
      throw qualityError;
    }
    const actualMiles = routeDistanceMiles({ coords: simplifyRoute(coords, 10) });
    const rangeError = actualMiles < minMiles
      ? (minMiles - actualMiles) / minMiles
      : actualMiles > maxMiles
      ? (actualMiles - maxMiles) / maxMiles
      : 0;
    if (actualMiles >= MIN_CUSTOM_DISTANCE / 1.609344 && (!best || rangeError < best.rangeError)) {
      best = {
        coords,
        controls,
        actualMiles,
        rangeError,
        attempts: attempt,
        suggestedControlScale: Math.max(0.35, Math.min(1.25, controlMiles / Math.max(actualMiles, 0.1)))
      };
    }
    if (rangeError === 0) break;

    if (actualMiles < minMiles) {
      if (attempt < maxAttempts) {
        controlMiles *= Math.max(1.15, Math.min(2.25, minMiles / Math.max(actualMiles, 0.1)));
        addRouteServiceMessage(`${formatDistance(actualMiles)} was below the selected range. Retrying with a wider loop…`, "working");
        setStatus(elements.routeStatus, `The route was too short. Trying a wider walkable loop…`, "working");
      }
      continue;
    }

    const scale = Math.max(0.45, Math.min(0.9, maxMiles / actualMiles));
    controlMiles *= scale;
    setStatus(
      elements.routeStatus,
      `${formatDistance(actualMiles)} was above the selected range. Trying a shorter walkable loop…`,
      "working"
    );
    addRouteServiceMessage(`${formatDistance(actualMiles)} was above the selected range. Retrying with a smaller loop…`, "working");
  }

  if (!best || best.rangeError > 0) {
    throw new Error(`the pedestrian router could not return a loop between ${formatDistance(minMiles)} and ${formatDistance(maxMiles)}`);
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

function getDistanceUnit() {
  return document.querySelector('input[name="distanceUnit"]:checked')?.value || "kilometers";
}

function planningCenter(baseCenter, routeIndex, routeCount, attempt, targetMiles, searchBounds = null) {
  const sequence = routeIndex + 1 + (attempt * routeCount);
  if (searchBounds?.isValid()) {
    const latitudeShare = 0.12 + (halton(sequence, 2) * 0.76);
    const longitudeShare = 0.12 + (halton(sequence, 3) * 0.76);
    return L.latLng(
      searchBounds.getSouth() + (searchBounds.getNorth() - searchBounds.getSouth()) * latitudeShare,
      searchBounds.getWest() + (searchBounds.getEast() - searchBounds.getWest()) * longitudeShare
    );
  }
  const angle = sequence * 2.399963;
  const offsetMiles = targetMiles * (0.9 + (sequence % 4) * 0.35);
  const latMilesPerDegree = 69;
  const lonMilesPerDegree = Math.max(20, 69 * Math.cos(toRadians(baseCenter.lat)));
  return L.latLng(
    baseCenter.lat + Math.sin(angle) * offsetMiles / latMilesPerDegree,
    baseCenter.lng + Math.cos(angle) * offsetMiles / lonMilesPerDegree
  );
}

function halton(index, base) {
  let fraction = 1;
  let result = 0;
  let value = index;
  while (value > 0) {
    fraction /= base;
    result += fraction * (value % base);
    value = Math.floor(value / base);
  }
  return result;
}

function routeOverlapRatio(candidateCoords, acceptedTrails) {
  if (!acceptedTrails.length) return 0;
  const comparisonSegments = acceptedTrails.flatMap((trail) => trail.coords.slice(1).map((point, index) => [trail.coords[index], point]));
  let totalMeters = 0;
  let overlapMeters = 0;
  for (let index = 1; index < candidateCoords.length; index += 1) {
    const start = candidateCoords[index - 1];
    const end = candidateCoords[index];
    const length = haversineMeters(start, end);
    totalMeters += length;
    const sampleCount = Math.max(1, Math.ceil(length / 15));
    const sampleLength = length / sampleCount;
    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      const fraction = (sampleIndex + 0.5) / sampleCount;
      const sample = [
        start[0] + ((end[0] - start[0]) * fraction),
        start[1] + ((end[1] - start[1]) * fraction)
      ];
      if (comparisonSegments.some(([comparisonStart, comparisonEnd]) => pointToSegmentMeters(sample, comparisonStart, comparisonEnd) <= 20)) {
        overlapMeters += sampleLength;
      }
    }
  }
  return totalMeters ? overlapMeters / totalMeters : 1;
}

function assessLoopQuality(routeCoords, controlPoints) {
  if (routeCoords.length < 4) return { acceptable: false, reason: "the route contained too little geometry" };
  const perimeter = routeDistanceMiles({ coords: routeCoords }) * 1609.344;
  if (!Number.isFinite(perimeter) || perimeter <= 0) return { acceptable: false, reason: "the route had no usable length" };

  const closureGap = haversineMeters(routeCoords[0], routeCoords[routeCoords.length - 1]);
  if (closureGap > Math.max(60, perimeter * 0.015)) {
    return { acceptable: false, reason: "the route did not return to its starting area" };
  }

  const meanLatitude = routeCoords.reduce((sum, point) => sum + point[0], 0) / routeCoords.length;
  const metersPerLongitudeDegree = 111320 * Math.cos(toRadians(meanLatitude));
  const projected = uniqueLoopCoords(routeCoords).map(([lat, lon]) => [lon * metersPerLongitudeDegree, lat * 110540]);
  const xs = projected.map((point) => point[0]);
  const ys = projected.map((point) => point[1]);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  const aspectRatio = Math.min(width, height) / Math.max(width, height, 1);
  let twiceArea = 0;
  projected.forEach((point, index) => {
    const next = projected[(index + 1) % projected.length];
    twiceArea += (point[0] * next[1]) - (next[0] * point[1]);
  });
  const area = Math.abs(twiceArea) / 2;
  const circularity = 4 * Math.PI * area / (perimeter * perimeter);
  if (circularity < MIN_LOOP_CIRCULARITY || aspectRatio < MIN_LOOP_ASPECT_RATIO) {
    return { acceptable: false, reason: "the route was too narrow or folded to work as a useful loop" };
  }

  const matchedIndexes = matchControlsToRoute(controlPoints, routeCoords);
  if (matchedIndexes.length === controlPoints.length) {
    const cumulative = [0];
    for (let index = 1; index < routeCoords.length; index += 1) {
      cumulative.push(cumulative[index - 1] + haversineMeters(routeCoords[index - 1], routeCoords[index]));
    }
    for (let index = 1; index < matchedIndexes.length; index += 1) {
      const routedLeg = cumulative[matchedIndexes[index]] - cumulative[matchedIndexes[index - 1]];
      const directLeg = haversineMeters(controlPoints[index - 1], controlPoints[index]);
      if (routedLeg / perimeter > MAX_LOOP_LEG_SHARE || (directLeg > 40 && routedLeg / directLeg > MAX_LOOP_LEG_DETOUR)) {
        return { acceptable: false, reason: "one side required too large a detour to form a balanced loop" };
      }
    }
  }

  return { acceptable: true, circularity, aspectRatio };
}

function matchControlsToRoute(controlPoints, routeCoords) {
  const indexes = [];
  let cursor = 0;
  controlPoints.forEach((control) => {
    let nearestIndex = cursor;
    let nearestDistance = Infinity;
    for (let index = cursor; index < routeCoords.length; index += 1) {
      const distance = haversineMeters(control, routeCoords[index]);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    }
    if (nearestDistance <= 120) {
      indexes.push(nearestIndex);
      cursor = nearestIndex;
    }
  });
  return indexes;
}

function handleDistanceUnitChange() {
  const nextUnit = getDistanceUnit();
  if (nextUnit !== state.distanceUnit) {
    const factor = nextUnit === "miles" ? 1 / 1.609344 : 1.609344;
    const minValue = Math.max(0.5, Math.min(25, Number(elements.minDistance.value) * factor));
    const maxValue = Math.max(0.5, Math.min(25, Number(elements.maxDistance.value) * factor));
    elements.minDistance.value = roundRangeValue(minValue);
    elements.maxDistance.value = roundRangeValue(maxValue);
    state.distanceUnit = nextUnit;
  }
  updateDistanceRange();
  renderSavedTrails();
  if (state.draft) syncDraftCoords();
}

function updateDistanceRange(source = "") {
  const step = 0.5;
  let minValue = Number(source === "min-slider" ? elements.minDistanceSlider.value : elements.minDistance.value);
  let maxValue = Number(source === "max-slider" ? elements.maxDistanceSlider.value : elements.maxDistance.value);
  minValue = Math.max(0.5, Math.min(25, Number.isFinite(minValue) ? minValue : 5));
  maxValue = Math.max(0.5, Math.min(25, Number.isFinite(maxValue) ? maxValue : 10));
  if (minValue > maxValue - step) {
    if (source.startsWith("min")) minValue = Math.max(0.5, maxValue - step);
    else maxValue = Math.min(25, minValue + step);
  }
  minValue = roundRangeValue(minValue);
  maxValue = roundRangeValue(maxValue);
  elements.minDistance.value = minValue;
  elements.maxDistance.value = maxValue;
  elements.minDistanceSlider.value = minValue;
  elements.maxDistanceSlider.value = maxValue;
  const unitLabel = getDistanceUnit() === "kilometers" ? "km" : "mi";
  elements.distanceUnitLabels.forEach((label) => { label.textContent = unitLabel; });
  elements.minDistanceOutput.textContent = `${minValue} ${unitLabel}`;
  elements.maxDistanceOutput.textContent = `${maxValue} ${unitLabel}`;
  elements.rangeFill.style.left = `${((minValue - 0.5) / 24.5) * 100}%`;
  elements.rangeFill.style.right = `${100 - (((maxValue - 0.5) / 24.5) * 100)}%`;
}

function roundRangeValue(value) {
  return Math.round(value * 2) / 2;
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
        "X-Client-Id": "ameliarowland.github.io-urban-trails-development-plan"
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
  const previousDraft = state.draft;
  const resetHistory = options.resetHistory ?? !previousDraft;
  if (resetHistory) state.editingEnabled = false;
  clearDraftLayers();
  const requestedAnchorPoints = options.anchorPoints || previousDraft?.anchorPoints || deriveAnchorPoints(coords);
  const shouldSnapAnchorPoints = options.snapAnchorPoints ?? state.snappingEnabled;
  state.draft = {
    coords: cloneCoords(coords),
    originalCoords: cloneCoords(previousDraft?.originalCoords || coords),
    anchorPoints: shouldSnapAnchorPoints
      ? snapAnchorPointsToRoute(requestedAnchorPoints, coords)
      : cloneCoords(requestedAnchorPoints),
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
    let suppressClickUntil = 0;
    let dragStartCoords = null;
    let dragStartAnchor = null;
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
    marker.on("click", () => {
      if (Date.now() < suppressClickUntil) return;
      openVertexRemovalPopup(marker.getLatLng(), index);
    });
    marker.on("dragstart", () => {
      hideVertexRemovalPopup();
      dragStartCoords = cloneCoords(state.draft.coords);
      dragStartAnchor = [...state.draft.anchorPoints[index]];
    });
    marker.on("drag", () => {
      if (!dragStartCoords || !dragStartAnchor || !state.draftLayer) return;
      const latLng = marker.getLatLng();
      state.draftLayer.setLatLngs(movePointNearAnchor(dragStartCoords, dragStartAnchor, [latLng.lat, latLng.lng]));
    });
    marker.on("dragend", () => {
      suppressClickUntil = Date.now() + 400;
      dragStartCoords = null;
      dragStartAnchor = null;
      handleAnchorDragEnd(index, marker.getLatLng());
    });
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
  coords[nearestIndex] = [...movedPoint];
  if (nearestIndex === 0 && wasClosed) coords[coords.length - 1] = [...movedPoint];
  return closeLoop(uniqueLoopCoords(coords));
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
  if (state.busy) return;
  if (!state.draftLayer) {
    if (state.activeTrailId) editSavedTrail(state.activeTrailId);
    else setStatus(elements.routeStatus, "Select a route on the map or in the list before editing.", "error");
    return;
  }
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
    ? "Snapping is on. Existing freeform lines are unchanged; future anchor edits will follow walkable streets."
    : "Snapping is off. Moving one anchor keeps every other anchor fixed and changes only the nearby route line.");
}

function updateEditingControls() {
  const editingLabel = state.editingEnabled ? "Editing on" : state.draft ? "Editing off" : state.activeTrailId ? "Edit selected route" : "Select a route";
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
  updateVertexCount();
}

function setToggleButton(button, active, label) {
  button.classList.toggle("is-active", active);
  button.setAttribute("aria-pressed", String(active));
  button.querySelector("span").textContent = label;
}

function updateMapEditTip() {
  const distance = state.draft ? formatDistance(routeDistanceMiles(state.draft)) : "";
  const editedTrail = state.trails.find((trail) => trail.id === state.editingTrailId);
  const routeName = editedTrail?.name || "Selected route";
  const editingPrefix = `Editing “${escapeHtml(routeName)}”`;
  elements.mapTip.innerHTML = state.addAnchorMode
    ? `<i data-lucide="plus"></i> ${editingPrefix} · ${distance} · Click on or near the route`
    : state.editingEnabled
    ? `<i data-lucide="mouse-pointer-2"></i> ${editingPrefix} · ${distance} · Drag an anchor · select for minus removal`
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
    showDraft(freeformCoords, targetMiles, { fit: false, anchorPoints, snapAnchorPoints: false, recordHistory: true, historyLabel: messages.historyLabel });
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
      snapAnchorPoints: false,
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
  if (state.editingEnabled && state.draft) {
    const count = state.draft.anchorPoints?.length || 0;
    elements.vertexCount.textContent = `${count} ${count === 1 ? "anchor point" : "anchor points"}`;
    return;
  }
  const selectedTrail = state.trails.find((trail) => trail.id === state.activeTrailId);
  const route = state.draft || selectedTrail;
  elements.vertexCount.textContent = route ? `${formatDistance(routeDistanceMiles(route))} route` : "No route selected";
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
  syncDraftCoords();
  const existingTrail = state.trails.find((item) => item.id === state.editingTrailId);
  const otherTrails = state.trails.filter((item) => item.id !== state.editingTrailId && item.visible);
  const overlap = routeOverlapRatio(state.draft.coords, otherTrails);
  if (overlap > MAX_ROUTE_OVERLAP) {
    setStatus(elements.routeStatus, `This edit overlaps other visible routes by ${(overlap * 100).toFixed(0)}%. Adjust it to 10% or less before saving.`, "error");
    return;
  }
  const name = existingTrail?.name || `${shortCityName(state.draft.city)} Route ${state.trails.length + 1}`;
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
    createdAt: existingTrail?.createdAt || new Date().toISOString(),
    overlapPercent: Number((overlap * 100).toFixed(1))
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
  setStatus(elements.routeStatus, `Saved edits to “${trail.name}”.`);
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
  state.hoveredTrailId = null;

  state.trails.forEach((trail, index) => {
    if (trail.id === state.editingTrailId) return;
    if (!trail.visible) return;
    const active = trail.id === state.activeTrailId;
    const trailColor = trail.color || trailColorForIndex(index);
    const layer = L.polyline(trail.coords, {
      color: trailColor,
      weight: active ? 8 : 5,
      opacity: active ? 1 : 0.76,
      lineJoin: "round",
      className: `saved-route-line${active ? " is-selected-route" : ""}`,
      pmIgnore: true
    }).addTo(savedRouteGroup);
    if (active && layer.getElement()) {
      layer.getElement().style.filter = `drop-shadow(0 0 2px rgba(255,255,255,0.95)) drop-shadow(0 0 5px ${trailColor})`;
    }
    layer.on("click", (event) => {
      if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
      selectTrail(trail.id);
    });
    const hitLayer = L.polyline(trail.coords, {
      color: "#000",
      weight: 22,
      opacity: 0.001,
      interactive: true,
      className: "route-hit-target",
      pmIgnore: true
    }).addTo(savedRouteGroup);
    hitLayer.on("click", (event) => {
      if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
      selectTrail(trail.id);
    });
    state.trailLayers.set(trail.id, { layer, hitLayer, trailColor });
  });

  renderSavedRouteLabels();

  renderTrailList();
  updateExportButtons();
  updateEditingControls();
}

function handleMapRouteSelection(event) {
  if (state.addAnchorMode || state.draft || state.busy) return;
  const nearest = nearestSelectableTrail(event.latlng);
  if (nearest?.distance <= 16) selectTrail(nearest.trail.id);
  else clearTrailSelection();
}

function handleMapRouteHover(event) {
  if (state.editingEnabled || state.draft || state.busy) {
    setHoveredTrail(null);
    return;
  }
  const nearest = nearestSelectableTrail(event.latlng);
  setHoveredTrail(nearest?.distance <= 16 ? nearest.trail.id : null);
}

function nearestSelectableTrail(latlng) {
  if (state.addAnchorMode || state.draft || state.busy) return null;
  const click = map.latLngToContainerPoint(latlng);
  let nearest = null;
  state.trails.filter((trail) => trail.visible).forEach((trail) => {
    const points = trail.coords.map((coord) => {
      const point = map.latLngToContainerPoint(coord);
      return [point.x, point.y];
    });
    for (let index = 1; index < points.length; index += 1) {
      const distance = pointToSegmentPixels([click.x, click.y], points[index - 1], points[index]);
      if (!nearest || distance < nearest.distance) nearest = { trail, distance };
    }
  });
  return nearest;
}

function setHoveredTrail(trailId) {
  const nextTrailId = state.editingEnabled || state.draft || state.busy ? null : trailId;
  if (state.hoveredTrailId === nextTrailId) return;
  state.hoveredTrailId = nextTrailId;
  refreshTrailInteractionStyles();
}

function refreshTrailInteractionStyles() {
  state.trailLayers.forEach(({ layer, hitLayer, trailColor }, id) => {
    const active = id === state.activeTrailId;
    const hovered = id === state.hoveredTrailId;
    layer.setStyle({
      weight: hovered ? (active ? 11 : 9) : (active ? 8 : 5),
      opacity: hovered ? 1 : (active ? 1 : 0.76)
    });
    const routeElement = layer.getElement();
    if (routeElement) {
      routeElement.style.filter = hovered
        ? `drop-shadow(0 0 3px rgba(255,255,255,0.98)) drop-shadow(0 0 7px ${trailColor})`
        : active
        ? `drop-shadow(0 0 2px rgba(255,255,255,0.95)) drop-shadow(0 0 5px ${trailColor})`
        : "";
    }
    if (hovered || active) {
      layer.bringToFront();
      hitLayer.bringToFront();
    }
  });
}

function pointToSegmentPixels(point, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  const ratio = lengthSquared
    ? Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared))
    : 0;
  return Math.hypot(point[0] - (start[0] + ratio * dx), point[1] - (start[1] + ratio * dy));
}

function renderSavedRouteLabels() {
  savedMarkerGroup.clearLayers();
  let labelOverlay = map.getContainer().querySelector(".map-route-label-overlay");
  if (!labelOverlay) {
    labelOverlay = document.createElement("div");
    labelOverlay.className = "map-route-label-overlay";
    labelOverlay.setAttribute("aria-hidden", "true");
    map.getContainer().appendChild(labelOverlay);
  }
  labelOverlay.replaceChildren();
  const size = map.getSize();
  if (!size.x || !size.y) return;
  const rightInset = 64;
  const routes = state.trails.filter((trail) => trail.visible && trail.id !== state.editingTrailId);
  const projectedRoutes = routes.map((trail) => ({
    trail,
    points: trail.coords.map((coord) => {
      const point = map.latLngToContainerPoint(coord);
      return [point.x, point.y];
    })
  }));
  const segments = projectedRoutes.flatMap(({ points }) => points.slice(1).map((point, index) => [points[index], point]));
  const placed = [];

  projectedRoutes.forEach(({ trail, points }) => {
    if (!points.some(([x, y]) => x >= 0 && x <= size.x && y >= 0 && y <= size.y)) return;
    const labelLines = wrapMapLabel(trail.name);
    const labelWidth = Math.min(235, Math.max(84, Math.max(...labelLines.map((line) => line.length)) * 10.8 + 8));
    const labelHeight = labelLines.length * 23 + 8;
    let best = null;
    [0.16, 0.3, 0.45, 0.6, 0.75, 0.88].forEach((fraction) => {
      const anchor = points[Math.min(points.length - 1, Math.floor((points.length - 1) * fraction))];
      routeLabelOffsets(labelWidth, labelHeight).forEach(([dx, dy, placementPenalty, anchorLeft]) => {
        const rect = { x: anchor[0] + dx, y: anchor[1] + dy, width: labelWidth, height: labelHeight };
        if (rect.x < 8 || rect.y < 8 || rect.x + rect.width > size.x - rightInset || rect.y + rect.height > size.y - 8) return;
        if (placed.some((other) => rectanglesOverlap(rect, other))) return;
        let score = Math.abs(dx) + Math.abs(dy) + placementPenalty;
        const collisionRect = anchorLeft ? { ...rect, x: rect.x + 10, width: Math.max(0, rect.width - 10) } : rect;
        segments.forEach(([start, end]) => { if (segmentTouchesRect(start, end, collisionRect)) score += 3000; });
        if (!best || score < best.score) best = { rect, score };
      });
    });
    if (!best) {
      const anchor = points[Math.floor((points.length - 1) * 0.5)];
      for (let y = 8; y <= size.y - labelHeight - 8; y += labelHeight + 6) {
        for (let x = 8; x <= size.x - labelWidth - rightInset; x += 18) {
          const rect = { x, y, width: labelWidth, height: labelHeight };
          if (placed.some((other) => rectanglesOverlap(rect, other))) continue;
          let score = Math.hypot(x - anchor[0], y - anchor[1]);
          segments.forEach(([start, end]) => { if (segmentTouchesRect(start, end, rect)) score += 3000; });
          if (!best || score < best.score) best = { rect, score };
        }
      }
    }
    if (!best) return;
    placed.push(best.rect);
    const label = document.createElement("span");
    label.className = "map-route-label";
    label.style.left = `${best.rect.x}px`;
    label.style.top = `${best.rect.y}px`;
    label.textContent = labelLines.join("\n");
    labelOverlay.appendChild(label);
  });
}

function wrapMapLabel(value, maxCharacters = 20) {
  let remaining = String(value).trim();
  const lines = [];
  while (remaining.length > maxCharacters) {
    let breakAt = remaining.lastIndexOf(" ", maxCharacters + 1);
    if (breakAt < 1) breakAt = maxCharacters;
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  return lines.length ? lines : [""];
}

function routeLabelOffsets(width, height) {
  return [5, 12, 22, 36, 56, 84].flatMap((distance) => [
    [distance, -height / 2, 0, true],
    [-width - distance, -height / 2, 35, false],
    [distance, -height - distance, 55, false],
    [distance, distance, 55, false],
    [-width - distance, -height - distance, 75, false],
    [-width - distance, distance, 75, false],
    [-width / 2, -height - distance, 90, false],
    [-width / 2, distance, 90, false]
  ]);
}

function renderTrailList() {
  elements.trailCount.textContent = String(state.trails.length);
  elements.trailList.innerHTML = "";

  if (!state.trails.length) {
    elements.trailList.innerHTML = '<div class="empty-state"><i data-lucide="route"></i><p>Your generated route concepts will appear here.</p></div>';
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
  const becameVisible = !trail.visible;
  state.activeTrailId = trailId;
  if (!trail.visible) trail.visible = true;
  if (becameVisible) renderSavedTrails();
  else {
    refreshTrailInteractionStyles();
    updateTrailListSelection();
    updateEditingControls();
  }
  setBusy(state.busy);
  updateExportButtons();
  if (options.fit) fitTrails([trail]);
  updateSelectedTrailTip(trail);
  setStatus(elements.routeStatus, `Selected “${trail.name}” · ${formatDistance(routeDistanceMiles(trail))}. Use Section 3 to edit it.`);
}

function clearTrailSelection() {
  if (!state.activeTrailId || state.draft || state.busy) return;
  state.activeTrailId = null;
  refreshTrailInteractionStyles();
  updateTrailListSelection();
  updateEditingControls();
  setBusy(state.busy);
  updateExportButtons();
  elements.mapTip.innerHTML = '<i data-lucide="crosshair"></i> Trail will start near the map center';
  if (window.lucide) window.lucide.createIcons();
  setStatus(elements.routeStatus, "Route selection cleared. Select a route on the map or in the list to inspect or edit it.");
}

function updateTrailListSelection() {
  elements.trailList.querySelectorAll(".trail-card").forEach((card) => {
    card.classList.toggle("is-active", card.dataset.trailId === state.activeTrailId);
  });
}

function updateSelectedTrailTip(trail) {
  elements.mapTip.innerHTML = `<i data-lucide="mouse-pointer-2"></i> Selected “${escapeHtml(trail.name)}” · ${formatDistance(routeDistanceMiles(trail))} · Use Section 3 to edit`;
  if (window.lucide) window.lucide.createIcons();
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
  setStatus(elements.routeStatus, `Editing “${trail.name}”. Use Save edits to keep your changes.`);
}

function trailColorForIndex(index) {
  if (state.routeColorMode === "mono") return state.monoColor;
  const palette = ROUTE_COLOR_PALETTES[state.routePalette] || TRAIL_COLORS;
  return palette[index % palette.length];
}

function nextTrailColor() {
  if (state.routeColorMode === "mono") return state.monoColor;
  const palette = ROUTE_COLOR_PALETTES[state.routePalette] || TRAIL_COLORS;
  const usedColors = new Set(state.trails.map((trail) => trail.color).filter(Boolean));
  return palette.find((color) => !usedColors.has(color)) || trailColorForIndex(state.trails.length);
}

function setRouteColorMode(mode) {
  state.routeColorMode = mode === "mono" ? "mono" : "multi";
  applyRouteColorScheme();
}

function applyMonoRouteColor(value) {
  state.monoColor = normalizeHexColor(value, state.monoColor);
  state.routeColorMode = "mono";
  applyRouteColorScheme();
}

function applyMulticolorPalette(name) {
  if (!ROUTE_COLOR_PALETTES[name]) return;
  state.routePalette = name;
  state.routeColorMode = "multi";
  applyRouteColorScheme();
}

function applyRouteColorScheme() {
  state.trails.forEach((trail, index) => { trail.color = trailColorForIndex(index); });
  localStorage.setItem(COLOR_SETTINGS_KEY, JSON.stringify({
    mode: state.routeColorMode,
    palette: state.routePalette,
    monoColor: state.monoColor
  }));
  persistTrails();
  updateRouteColorPicker();
  renderSavedTrails();
}

function updateRouteColorPicker() {
  const mono = state.routeColorMode === "mono";
  elements.monoColorMode.classList.toggle("is-active", mono);
  elements.monoColorMode.setAttribute("aria-pressed", String(mono));
  elements.multiColorMode.classList.toggle("is-active", !mono);
  elements.multiColorMode.setAttribute("aria-pressed", String(!mono));
  elements.monoColorChoices.hidden = !mono;
  elements.multiColorChoices.hidden = mono;
  elements.customRouteColor.value = state.monoColor;
  elements.colorSwatches.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.routeColor.toLowerCase() === state.monoColor.toLowerCase());
  });
  elements.paletteSwatches.forEach((button) => {
    const active = button.dataset.routePalette === state.routePalette;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function renameTrail(trailId, value) {
  const trail = state.trails.find((item) => item.id === trailId);
  const name = value.trim();
  if (!trail || !name) return;
  trail.name = name;
  persistTrails();
  renderSavedTrails();
  if (state.editingTrailId === trailId && state.draft) updateMapEditTip();
  else if (state.activeTrailId === trailId) updateSelectedTrailTip(trail);
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
  const disabled = visibleTrailsInCurrentExtent().length === 0;
  elements.downloadAllGpx.disabled = disabled;
  elements.downloadAllKml.disabled = disabled;
  elements.downloadAllGeoJson.disabled = disabled;
  elements.downloadMap.disabled = disabled;
  elements.downloadPdf.disabled = disabled;
  elements.downloadImage.disabled = disabled;
}

function visibleTrails() {
  return state.trails.filter((trail) => trail.visible);
}

function visibleTrailsInCurrentExtent() {
  return visibleTrails().filter(trailIsShownInCurrentExtent);
}

function trailIsShownInCurrentExtent(trail) {
  const size = map.getSize();
  const frame = { x: 0, y: 0, width: size.x, height: size.y };
  const points = trail.coords.map((coord) => {
    const point = map.latLngToContainerPoint(coord);
    return [point.x, point.y];
  });
  return points.some(([x, y]) => x >= 0 && x <= size.x && y >= 0 && y <= size.y)
    || points.slice(1).some((point, index) => segmentTouchesRect(points[index], point, frame));
}

function setBasemap(name) {
  const next = basemaps[name];
  if (!next || next === activeBasemap) return;
  map.removeLayer(activeBasemap);
  activeBasemapName = name;
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
  elements.routeCount.disabled = busy;
  elements.minDistance.disabled = busy;
  elements.maxDistance.disabled = busy;
  elements.minDistanceSlider.disabled = busy;
  elements.maxDistanceSlider.disabled = busy;
  [elements.monoColorMode, elements.multiColorMode, elements.customRouteColor, ...elements.colorSwatches, ...elements.paletteSwatches]
    .forEach((control) => { control.disabled = busy; });
  elements.editingToggleButton.disabled = busy || (!hasDraft && !state.activeTrailId);
  elements.snappingToggleButton.disabled = busy || !hasDraft;
  elements.segmentDistancesButton.disabled = busy || !hasDraft;
  elements.mapSnappingToggleButton.disabled = busy || !hasDraft || !state.editingEnabled;
  elements.discardDraftButton.disabled = busy || !hasDraft;
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

function nextRouteNumber(city, pendingTrails = []) {
  const prefix = `${shortCityName(city)} Route `;
  const numbers = [...state.trails, ...pendingTrails]
    .map((trail) => trail.name?.startsWith(prefix) ? Number(trail.name.slice(prefix.length)) : NaN)
    .filter(Number.isFinite);
  return numbers.length ? Math.max(...numbers) + 1 : 1;
}
function cloneCoords(coords) { return coords.map(([lat, lon]) => [Number(lat), Number(lon)]); }
function latLngsToCoords(latlngs) { return latlngs.map((latlng) => [Number(latlng.lat.toFixed(6)), Number(latlng.lng.toFixed(6))]); }
function createTrailId() { return `trail-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }
function safeFilename(value) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "trail"; }

function loadTrails() {
  const trails = loadJson(STORAGE_KEY, []);
  if (!Array.isArray(trails)) return [];
  return trails.filter((trail) => trail && trail.id && trail.name && Array.isArray(trail.coords) && trail.coords.length > 1).map((trail, index) => ({
    ...trail,
    name: normalizeGeneratedRouteName(trail.name),
    color: trail.color || trailColorForIndex(index),
    visible: trail.visible !== false
  }));
}

function normalizeGeneratedRouteName(name) {
  return String(name).replace(/^(.+?)(?: Plan Route| generated walking route)(?: (\d+))?$/i, (_, city, number) => `${city} Route${number ? ` ${number}` : ""}`);
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
  trails = trails.filter((trail) => trail.visible && trailIsShownInCurrentExtent(trail));
  if (!trails.length) return;
  const version = nextSpatialExportVersion();
  const exportedAt = new Date().toISOString();
  const collection = {
    type: "FeatureCollection",
    export_version: version,
    exported_at: exportedAt,
    features: trails.map((trail) => ({
      type: "Feature",
      properties: {
        id: trail.id,
        name: trail.name,
        city: trail.city,
        color: trail.color,
        distance_km: Number((routeDistanceMiles(trail) * 1.609344).toFixed(2)),
        distance_miles: Number(routeDistanceMiles(trail).toFixed(2)),
        geometry_source: trail.geometrySource
      },
      geometry: { type: "LineString", coordinates: trail.coords.map(([lat, lon]) => [lon, lat]) }
    }))
  };
  downloadText(JSON.stringify(collection, null, 2), versionedExportFilename(filename, version), "application/geo+json");
}

function routesAreMonocolor(trails) {
  return new Set(trails.map((trail, index) => normalizeHexColor(trail.color, trailColorForIndex(index)))).size <= 1;
}

function routingSourcesForTrails(trails) {
  const sourceText = trails.map((trail) => `${trail.routingSource || ""} ${trail.geometrySource || ""}`).join(" ").toLowerCase();
  const sources = [];
  if (sourceText.includes("valhalla")) sources.push({ label: "Valhalla routing", url: "https://valhalla.github.io/valhalla/" });
  if (sourceText.includes("osm pedestrian") || sourceText.includes("openstreetmap pedestrian")) {
    sources.push({ label: "OSM pedestrian routing", url: "https://routing.openstreetmap.de/" });
  }
  return sources.length ? sources : [{ label: "OpenStreetMap-based pedestrian routing", url: "https://www.openstreetmap.org/copyright" }];
}

function exportShareableMap() {
  const trails = visibleTrailsInCurrentExtent();
  if (!trails.length) return;
  const monocolor = routesAreMonocolor(trails);
  const cityNames = [...new Set(trails.map((trail) => trail.city))].join(" · ");
  const payload = trails.map((trail, index) => ({
    name: trail.name,
    city: trail.city,
    color: trail.color || trailColorForIndex(index),
    distance: formatDistance(routeDistanceMiles(trail)),
    label: wrapMapLabel(trail.name).join("\n"),
    coords: trail.coords
  }));
  const serialized = JSON.stringify(payload).replaceAll("<", "\\u003c");
  const serializedBasemapLayers = JSON.stringify(exportBasemapLayers()).replaceAll("<", "\\u003c");
  const legend = monocolor
    ? `<h2 class="mono-legend"><span style="background:${payload[0].color}"></span>Proposed routes</h2>`
    : `<h2>Proposed routes</h2><ul>${payload.map((trail) => `<li><span style="background:${trail.color}"></span><strong>${escapeHtml(trail.name)}</strong><small>${escapeHtml(trail.distance)}</small></li>`).join("")}</ul>`;
  const routingAttribution = routingSourcesForTrails(trails).map((source) => `<a href="${source.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label)}</a>`).join(" and ");
  const basemapAttribution = activeBasemapName === "OpenStreetMap"
    ? `<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>`
    : `<a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">Esri and contributors</a>`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Urban Trails Development Plan — ${escapeHtml(cityNames)}</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>*{box-sizing:border-box}body{margin:0;color:#173a3c;background:#f3efe4;font-family:"Avenir Next","Segoe UI",Arial,sans-serif}header{padding:18px 22px;border-bottom:1px solid #173a3c}h1{margin:0 0 5px;font-family:Georgia,serif;font-weight:400}header p{margin:0;color:#6e7069}main{display:grid;grid-template-columns:minmax(250px,340px) 1fr;height:calc(100vh - 91px);align-items:start}aside{padding:18px;overflow:auto;background:#fffdfa;border:1px solid #173a3c;border-top:0}ul{display:grid;gap:10px;padding:0;list-style:none}li{display:grid;grid-template-columns:14px 1fr auto;gap:8px;align-items:center}li span,.mono-legend span{width:12px;height:12px;border-radius:50%}li small{color:#6e7069}.mono-legend{display:flex;align-items:center;gap:8px}#map{position:relative;height:100%;min-height:480px}.map-label-overlay{position:absolute;z-index:700;inset:0;overflow:hidden;pointer-events:none}.export-route-label{position:absolute;max-width:20ch;padding:2px;color:#fff;background:transparent;font-family:"Avenir Next","Segoe UI",Arial,sans-serif;font-size:1.18rem;font-weight:900;line-height:1.12;letter-spacing:.01em;text-align:center;white-space:pre-line;text-shadow:-1px -1px 0 #303a38,1px -1px 0 #303a38,-1px 1px 0 #303a38,1px 1px 0 #303a38,0 2px 3px rgba(32,41,40,.68);-webkit-text-stroke:.9px #303a38}.note{margin-top:20px;font-size:12px;line-height:1.45;color:#6e7069}.note a{color:#173a3c}@media(max-width:700px){main{grid-template-columns:1fr;height:auto}aside{border-right:0}#map{height:65vh}}@media print{header{padding:10mm}main{grid-template-columns:65mm 1fr;height:165mm}aside{padding:6mm}#map{height:165mm}.leaflet-control-container{display:none}}</style></head>
<body><header><h1>Urban Trails Development Plan</h1><p>${escapeHtml(cityNames)} · ${trails.length} route concepts · Community review map</p></header>
<main><aside>${legend}<p class="note">Routes generated using ${routingAttribution}, with routing-network and map data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>. Basemap: ${basemapAttribution}. Routes are not field-verified or intended for turn-by-turn navigation.</p></aside><div id="map" aria-label="Map of proposed urban trails"></div></main>
 <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script><script>
 const trails=${serialized};
 const basemapLayers=${serializedBasemapLayers};
 const map=L.map('map');
 basemapLayers.forEach(function(layer){L.tileLayer(layer.url,{maxZoom:layer.maxZoom,attribution:layer.attribution,crossOrigin:true}).addTo(map)});
 const group=L.featureGroup().addTo(map);
 trails.forEach(function(t){const line=L.polyline(t.coords,{color:t.color,weight:5,opacity:.88,lineCap:'round',lineJoin:'round'});const popup=document.createElement('span');popup.textContent=t.name+' · '+t.distance;line.bindPopup(popup).addTo(group)});
const coords=trails.flatMap(function(t){return t.coords});
const lats=coords.map(function(c){return c[0]});const lons=coords.map(function(c){return c[1]});
let south=Math.min.apply(null,lats),north=Math.max.apply(null,lats),west=Math.min.apply(null,lons),east=Math.max.apply(null,lons);
const latSpan=Math.max(.002,north-south),lonSpan=Math.max(.002,east-west);south-=latSpan*.15;north+=latSpan*.15;west-=lonSpan*.15;east+=lonSpan*.15;
map.fitBounds([[south,west],[north,east]],{animate:false,padding:[0,0]});
const overlay=document.createElement('div');overlay.className='map-label-overlay';document.getElementById('map').appendChild(overlay);
function hitsLine(rect,a,b){const minX=Math.min(a.x,b.x),maxX=Math.max(a.x,b.x),minY=Math.min(a.y,b.y),maxY=Math.max(a.y,b.y);return !(maxX<rect.x||minX>rect.x+rect.w||maxY<rect.y||minY>rect.y+rect.h)}
function labelOffsets(w,h){return[5,12,22,36,56,84].flatMap(function(d){return[[d,-h/2,0,true],[-w-d,-h/2,35,false],[d,-h-d,55,false],[d,d,55,false],[-w-d,-h-d,75,false],[-w-d,d,75,false],[-w/2,-h-d,90,false],[-w/2,d,90,false]]})}
function overlaps(rect,p){return!(rect.x+rect.w<p.x||rect.x>p.x+p.w||rect.y+rect.h<p.y||rect.y>p.y+p.h)}
function placeLabels(){overlay.replaceChildren();const size=map.getSize();const segments=[];trails.forEach(function(t){for(let i=1;i<t.coords.length;i++){segments.push([map.latLngToContainerPoint(t.coords[i-1]),map.latLngToContainerPoint(t.coords[i])])}});const placed=[];trails.forEach(function(t){const el=document.createElement('div');el.className='export-route-label';el.textContent=t.label;overlay.appendChild(el);const w=el.offsetWidth,h=el.offsetHeight;let best=null;[.22,.38,.55,.7,.84].forEach(function(f){const anchor=map.latLngToContainerPoint(t.coords[Math.min(t.coords.length-1,Math.floor((t.coords.length-1)*f))]);labelOffsets(w,h).forEach(function(offset){const rect={x:anchor.x+offset[0],y:anchor.y+offset[1],w:w,h:h};if(rect.x<8||rect.y<8||rect.x+w>size.x-8||rect.y+h>size.y-8||placed.some(function(p){return overlaps(rect,p)}))return;let score=Math.abs(offset[0])+Math.abs(offset[1])+offset[2];const collisionRect=offset[3]?{x:rect.x+10,y:rect.y,w:Math.max(0,rect.w-10),h:rect.h}:rect;segments.forEach(function(s){if(hitsLine(collisionRect,s[0],s[1]))score+=3000});if(!best||score<best.score)best={rect:rect,score:score}})});if(!best){const anchor=map.latLngToContainerPoint(t.coords[Math.floor((t.coords.length-1)*.5)]);best={rect:{x:Math.max(8,Math.min(size.x-w-8,anchor.x+5)),y:Math.max(8,Math.min(size.y-h-8,anchor.y-h/2)),w:w,h:h}}}placed.push(best.rect);el.style.left=best.rect.x+'px';el.style.top=best.rect.y+'px'})}
map.whenReady(function(){setTimeout(placeLabels,60)});map.on('zoomend moveend resize',placeLabels);
<\/script></body></html>`;
  const name = safeFilename(shortCityName(trails[0].city || "community"));
  downloadText(html, `${name}-urban-trails-community-map.html`, "text/html");
}

async function exportImageMap() {
  const trails = visibleTrailsInCurrentExtent();
  if (!trails.length) return;
  try {
    elements.downloadImage.disabled = true;
    setStatus(elements.routeStatus, "Preparing map image with basemap…", "working");
    const canvas = await renderExportCanvas(trails);
    const blob = await canvasToBlob(canvas, "image/png");
    downloadBlob(blob, `${safeFilename(shortCityName(trails[0].city || "community"))}-urban-trails-map.png`);
    setStatus(elements.routeStatus, "Image export ready.");
  } catch (error) {
    setStatus(elements.routeStatus, `Image export failed: ${error.message}`, "error");
  } finally {
    updateExportButtons();
  }
}

function normalizeHexColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value).toLowerCase() : fallback;
}

async function exportPdfMap() {
  const trails = visibleTrailsInCurrentExtent();
  if (!trails.length) return;
  try {
    elements.downloadPdf.disabled = true;
    setStatus(elements.routeStatus, "Preparing PDF with basemap…", "working");
    const canvas = await renderExportCanvas(trails);
    const jpeg = await canvasToBlob(canvas, "image/jpeg", 0.92);
    const pdf = createImagePdf(new Uint8Array(await jpeg.arrayBuffer()), canvas.width, canvas.height, canvas.exportLinks || []);
    downloadBlob(pdf, `${safeFilename(shortCityName(trails[0].city || "community"))}-urban-trails-map.pdf`);
    setStatus(elements.routeStatus, "PDF export ready.");
  } catch (error) {
    setStatus(elements.routeStatus, `PDF export failed: ${error.message}`, "error");
  } finally {
    updateExportButtons();
  }
}

function createExportLayout(frame, viewBounds) {
  const minLat = viewBounds.getSouth();
  const maxLat = viewBounds.getNorth();
  const minLon = viewBounds.getWest();
  const maxLon = viewBounds.getEast();
  const northWest = webMercatorPoint(maxLat, minLon);
  const southEast = webMercatorPoint(minLat, maxLon);
  const worldWidth = Math.max(0.0000001, southEast.x - northWest.x);
  const worldHeight = Math.max(0.0000001, southEast.y - northWest.y);
  return {
    frame,
    bounds: { minLat, maxLat, minLon, maxLon },
    project: ([lat, lon]) => {
      const point = webMercatorPoint(lat, lon);
      return [
        frame.x + ((point.x - northWest.x) / worldWidth) * frame.width,
        frame.y + ((point.y - northWest.y) / worldHeight) * frame.height
      ];
    }
  };
}

async function renderExportCanvas(trails) {
  const width = 1400;
  const mapSize = map.getSize();
  const mapAspectRatio = Math.max(0.5, Math.min(4, mapSize.x / Math.max(1, mapSize.y)));
  const frame = { x: 330, y: 105, width: 1030, height: Math.round(1030 / mapAspectRatio) };
  const footerLineOneY = frame.y + frame.height + 27;
  const footerLineTwoY = footerLineOneY + 21;
  const height = footerLineTwoY + 14;
  const layout = createExportLayout(frame, map.getBounds());
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.exportLinks = [];
  const context = canvas.getContext("2d");
  context.fillStyle = "#f3efe4";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#173a3c";
  context.font = "42px Georgia, serif";
  context.fillText("Urban Trails Development Plan", 35, 57);
  context.fillStyle = "#6e7069";
  context.font = "18px Arial, sans-serif";
  const cityNames = [...new Set(trails.map((trail) => trail.city))].join(" · ");
  context.fillText(`${cityNames} · ${trails.length} routes · Community review map`, 35, 85);
  const monocolor = routesAreMonocolor(trails);
  const legendSpacing = Math.min(55, Math.max(29, (frame.height - 64) / Math.max(1, trails.length)));
  const legendHeight = monocolor ? 58 : Math.min(frame.height, 62 + (trails.length * legendSpacing));
  context.fillStyle = "#fffdfa";
  context.fillRect(20, frame.y, 285, legendHeight);
  context.strokeStyle = "#173a3c";
  context.lineWidth = 1;
  context.strokeRect(20, frame.y, 285, legendHeight);
  context.fillStyle = "#173a3c";
  context.font = "700 17px Arial, sans-serif";
  if (monocolor) {
    context.fillStyle = trails[0].color || trailColorForIndex(0);
    context.beginPath();
    context.arc(43, frame.y + 27, 7, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#173a3c";
    context.fillText("PROPOSED ROUTES", 60, frame.y + 32);
  } else {
    context.fillText("PROPOSED ROUTES", 35, frame.y + 30);
    trails.forEach((trail, index) => {
      const y = frame.y + 51 + index * legendSpacing;
      context.fillStyle = trail.color || trailColorForIndex(index);
      context.beginPath();
      context.arc(43, y - 5, 7, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#173a3c";
      context.font = "700 17px Arial, sans-serif";
      context.fillText(trail.name, 60, y, 225);
      context.fillStyle = "#6e7069";
      context.font = "14px Arial, sans-serif";
      context.fillText(formatDistance(routeDistanceMiles(trail)), 60, y + 20);
    });
  }
  const basemap = await fetchExportBasemap(layout.bounds, frame.width, frame.height);
  context.drawImage(basemap, frame.x, frame.y, frame.width, frame.height);
  context.save();
  context.beginPath();
  context.rect(frame.x, frame.y, frame.width, frame.height);
  context.clip();
  trails.forEach((trail, index) => {
    const projected = trail.coords.map(layout.project);
    context.beginPath();
    projected.forEach(([x, y], pointIndex) => pointIndex ? context.lineTo(x, y) : context.moveTo(x, y));
    context.strokeStyle = trail.color || trailColorForIndex(index);
    context.lineWidth = 6;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.stroke();
  });
  drawExportLabels(context, trails, layout);
  context.fillStyle = "rgba(255,253,250,0.9)";
  context.fillRect(frame.x + frame.width - 184, frame.y + frame.height - 22, 184, 22);
  context.fillStyle = "#4f5f5d";
  context.font = "11px Arial, sans-serif";
  const attributionLabel = activeBasemapName === "OpenStreetMap" ? "© OpenStreetMap contributors" : "© Esri and contributors";
  context.fillText(attributionLabel, frame.x + frame.width - 178, frame.y + frame.height - 7);
  context.restore();
  context.strokeStyle = "#173a3c";
  context.lineWidth = 1;
  context.strokeRect(frame.x, frame.y, frame.width, frame.height);
  context.fillStyle = "#6e7069";
  context.font = "16px Arial, sans-serif";
  const routingParts = [{ text: "Routing: " }];
  routingSourcesForTrails(trails).forEach((source, index) => {
    if (index) routingParts.push({ text: " + " });
    routingParts.push({ text: source.label, url: source.url });
  });
  routingParts.push({ text: " · Routes are not field-verified" });
  drawLinkedCanvasLine(context, routingParts, frame.x, footerLineOneY, canvas.exportLinks);
  const basemapSource = activeBasemapName === "OpenStreetMap"
    ? { label: "OpenStreetMap contributors", url: "https://www.openstreetmap.org/copyright" }
    : { label: "Esri and contributors", url: "https://www.esri.com/" };
  drawLinkedCanvasLine(context, [
    { text: "Routing-network and map data: " },
    { text: "OpenStreetMap contributors", url: "https://www.openstreetmap.org/copyright" },
    { text: ` · ${activeBasemapName} basemap: ` },
    { text: basemapSource.label, url: basemapSource.url }
  ], frame.x, footerLineTwoY, canvas.exportLinks);
  return canvas;
}

function drawLinkedCanvasLine(context, parts, x, y, links) {
  let cursorX = x;
  parts.forEach((part) => {
    context.fillStyle = part.url ? "#173a3c" : "#6e7069";
    context.fillText(part.text, cursorX, y);
    const width = context.measureText(part.text).width;
    if (part.url) {
      context.strokeStyle = "#173a3c";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(cursorX, y + 2);
      context.lineTo(cursorX + width, y + 2);
      context.stroke();
      links.push({ url: part.url, x: cursorX, y: y - 16, width, height: 20 });
    }
    cursorX += width;
  });
}

async function fetchExportBasemap(bounds, width, height) {
  const layers = exportBasemapLayers();
  const northWest = webMercatorPoint(bounds.maxLat, bounds.minLon);
  const southEast = webMercatorPoint(bounds.minLat, bounds.maxLon);
  const worldWidth = Math.max(0.0000001, southEast.x - northWest.x);
  const worldHeight = Math.max(0.0000001, southEast.y - northWest.y);
  const layerMaxZoom = Math.min(...layers.map((layer) => layer.maxZoom));
  const zoom = Math.max(1, Math.min(layerMaxZoom, Math.floor(Math.min(
    Math.log2(width / (256 * worldWidth)),
    Math.log2(height / (256 * worldHeight))
  ))));
  const scale = 2 ** zoom;
  const minTileX = Math.floor(northWest.x * scale);
  const maxTileX = Math.floor(southEast.x * scale);
  const minTileY = Math.max(0, Math.floor(northWest.y * scale));
  const maxTileY = Math.min(scale - 1, Math.floor(southEast.y * scale));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const context = canvas.getContext("2d");
  context.fillStyle = "#e7e0d2";
  context.fillRect(0, 0, canvas.width, canvas.height);
  let loadedTileCount = 0;

  for (const layer of layers) {
    const requests = [];
    for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
      for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
        const wrappedX = ((tileX % scale) + scale) % scale;
        const url = layer.url
          .replace("{s}", ["a", "b", "c"][(wrappedX + tileY) % 3])
          .replace("{z}", zoom)
          .replace("{x}", wrappedX)
          .replace("{y}", tileY);
        requests.push(loadTileImage(url).then((image) => ({ image, tileX, tileY })).catch(() => null));
      }
    }
    const tiles = await Promise.all(requests);
    tiles.filter(Boolean).forEach(({ image, tileX, tileY }) => {
      const x = ((tileX / scale) - northWest.x) / worldWidth * width;
      const y = ((tileY / scale) - northWest.y) / worldHeight * height;
      const tileWidth = (1 / scale) / worldWidth * width;
      const tileHeight = (1 / scale) / worldHeight * height;
      context.drawImage(image, x, y, tileWidth + 1, tileHeight + 1);
      loadedTileCount += 1;
    });
  }
  if (!loadedTileCount) throw new Error(`${activeBasemapName} could not be loaded.`);
  return canvas;
}

async function loadTileImage(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Basemap tile returned ${response.status}`);
  const blob = await response.blob();
  if ("createImageBitmap" in window) return createImageBitmap(blob);
  return loadBlobImage(blob);
}

function webMercatorPoint(lat, lon) {
  const limitedLatitude = Math.max(-85.051129, Math.min(85.051129, lat));
  const sine = Math.sin(toRadians(limitedLatitude));
  return {
    x: (lon + 180) / 360,
    y: 0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)
  };
}

function exportBasemapLayers(name = activeBasemapName) {
  const layerSets = {
    "Esri Topographic": [
      { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", maxZoom: 19, attribution: "Tiles &copy; <a href=\"https://www.esri.com/\" target=\"_blank\" rel=\"noopener noreferrer\">Esri and contributors</a>" }
    ],
    "Esri Light Gray": [
      { url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", maxZoom: 16, attribution: "Tiles &copy; <a href=\"https://www.esri.com/\" target=\"_blank\" rel=\"noopener noreferrer\">Esri</a>" },
      { url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}", maxZoom: 16, attribution: "Labels &copy; <a href=\"https://www.esri.com/\" target=\"_blank\" rel=\"noopener noreferrer\">Esri</a>" }
    ],
    Satellite: [
      { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", maxZoom: 19, attribution: "Tiles &copy; <a href=\"https://www.esri.com/\" target=\"_blank\" rel=\"noopener noreferrer\">Esri and contributors</a>" },
      { url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}", maxZoom: 19, attribution: "Roads &copy; <a href=\"https://www.esri.com/\" target=\"_blank\" rel=\"noopener noreferrer\">Esri</a> and <a href=\"https://www.openstreetmap.org/copyright\" target=\"_blank\" rel=\"noopener noreferrer\">OpenStreetMap contributors</a>" },
      { url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", maxZoom: 19, attribution: "Labels &copy; <a href=\"https://www.esri.com/\" target=\"_blank\" rel=\"noopener noreferrer\">Esri</a>" }
    ],
    OpenStreetMap: [
      { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", maxZoom: 19, attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\" target=\"_blank\" rel=\"noopener noreferrer\">OpenStreetMap contributors</a>" }
    ]
  };
  return layerSets[name] || layerSets.OpenStreetMap;
}

function loadBlobImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("The basemap image could not be decoded.")); };
    image.src = url;
  });
}

function drawExportLabels(context, trails, layout) {
  const paths = trails.map((trail) => trail.coords.map(layout.project));
  const segments = paths.flatMap((path) => path.slice(1).map((point, index) => [path[index], point]));
  const placed = [];
  trails.forEach((trail, trailIndex) => {
    const routePath = paths[trailIndex];
    const routeTouchesFrame = routePath.some(([x, y]) => (
      x >= layout.frame.x && x <= layout.frame.x + layout.frame.width && y >= layout.frame.y && y <= layout.frame.y + layout.frame.height
    )) || routePath.slice(1).some((point, index) => segmentTouchesRect(routePath[index], point, {
      x: layout.frame.x,
      y: layout.frame.y,
      width: layout.frame.width,
      height: layout.frame.height
    }));
    if (!routeTouchesFrame) return;
    context.font = "900 19px 'Avenir Next', 'Segoe UI', Arial, sans-serif";
    const labelLines = wrapMapLabel(trail.name);
    const labelWidth = Math.min(330, Math.max(72, Math.max(...labelLines.map((line) => context.measureText(line).width)) + 8));
    const labelHeight = labelLines.length * 22 + 8;
    let best = null;
    [0.2, 0.35, 0.52, 0.68, 0.84].forEach((fraction) => {
      const anchor = paths[trailIndex][Math.min(paths[trailIndex].length - 1, Math.floor((paths[trailIndex].length - 1) * fraction))];
      routeLabelOffsets(labelWidth, labelHeight).forEach(([dx, dy, placementPenalty, anchorLeft]) => {
        const rect = { x: anchor[0] + dx, y: anchor[1] + dy, width: labelWidth, height: labelHeight };
        if (rect.x < layout.frame.x + 8 || rect.y < layout.frame.y + 8 || rect.x + rect.width > layout.frame.x + layout.frame.width - 8 || rect.y + rect.height > layout.frame.y + layout.frame.height - 8) return;
        if (placed.some((other) => rectanglesOverlap(rect, other))) return;
        let score = Math.abs(dx) + Math.abs(dy) + placementPenalty;
        const collisionRect = anchorLeft ? { ...rect, x: rect.x + 10, width: Math.max(0, rect.width - 10) } : rect;
        segments.forEach(([start, end]) => { if (segmentTouchesRect(start, end, collisionRect)) score += 3000; });
        if (!best || score < best.score) best = { rect, score };
      });
    });
    if (!best) {
      const anchor = paths[trailIndex][Math.floor((paths[trailIndex].length - 1) * 0.5)];
      best = { rect: { x: Math.max(layout.frame.x + 8, Math.min(layout.frame.x + layout.frame.width - labelWidth - 8, anchor[0] + 12)), y: Math.max(layout.frame.y + 8, Math.min(layout.frame.y + layout.frame.height - labelHeight - 8, anchor[1] - labelHeight - 12)), width: labelWidth, height: labelHeight } };
    }
    placed.push(best.rect);
    context.save();
    context.font = "900 19px 'Avenir Next', 'Segoe UI', Arial, sans-serif";
    context.textBaseline = "middle";
    context.lineJoin = "round";
    context.strokeStyle = "#303a38";
    context.lineWidth = 3.6;
    context.fillStyle = "#fff";
    labelLines.forEach((line, lineIndex) => {
      const y = best.rect.y + 14 + lineIndex * 22;
      context.strokeText(line, best.rect.x + 3, y, best.rect.width - 6);
      context.fillText(line, best.rect.x + 3, y, best.rect.width - 6);
    });
    context.restore();
  });
}

function segmentTouchesRect(start, end, rect) {
  const minX = Math.min(start[0], end[0]);
  const maxX = Math.max(start[0], end[0]);
  const minY = Math.min(start[1], end[1]);
  const maxY = Math.max(start[1], end[1]);
  return !(maxX < rect.x || minX > rect.x + rect.width || maxY < rect.y || minY > rect.y + rect.height);
}

function rectanglesOverlap(first, second) {
  return !(first.x + first.width < second.x || first.x > second.x + second.width || first.y + first.height < second.y || first.y > second.y + second.height);
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("The export image could not be created.")), type, quality));
}

function createImagePdf(jpegBytes, imageWidth, imageHeight, links = []) {
  const encoder = new TextEncoder();
  const parts = [];
  const offsets = [0];
  let length = 0;
  const addText = (value) => { const bytes = encoder.encode(value); parts.push(bytes); length += bytes.length; };
  const addObject = (number, value) => { offsets[number] = length; addText(`${number} 0 obj\n${value}\nendobj\n`); };
  addText("%PDF-1.4\n%UrbanTrails\n");
  addObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
  addObject(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  const pageWidth = 792;
  const pageHeight = pageWidth * imageHeight / imageWidth;
  const annotationReferences = links.map((unused, index) => `${index + 6} 0 R`).join(" ");
  const annotations = annotationReferences ? ` /Annots [${annotationReferences}]` : "";
  addObject(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight.toFixed(3)}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R${annotations} >>`);
  const content = `q ${pageWidth} 0 0 ${pageHeight.toFixed(3)} 0 0 cm /Im0 Do Q`;
  addObject(4, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  offsets[5] = length;
  addText(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
  parts.push(jpegBytes);
  length += jpegBytes.length;
  addText("\nendstream\nendobj\n");
  const scale = pageWidth / imageWidth;
  links.forEach((link, index) => {
    const left = link.x * scale;
    const right = (link.x + link.width) * scale;
    const bottom = pageHeight - ((link.y + link.height) * scale);
    const top = pageHeight - (link.y * scale);
    addObject(index + 6, `<< /Type /Annot /Subtype /Link /Rect [${left.toFixed(3)} ${bottom.toFixed(3)} ${right.toFixed(3)} ${top.toFixed(3)}] /Border [0 0 0] /A << /S /URI /URI (${escapePdfText(link.url)}) >> >>`);
  });
  const objectCount = 5 + links.length;
  const xrefOffset = length;
  addText(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`);
  for (let index = 1; index <= objectCount; index += 1) addText(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
  addText(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return new Blob(parts, { type: "application/pdf" });
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((index) => (parseInt(value.slice(index, index + 2), 16) / 255).toFixed(3));
}

function asciiText(value) {
  return String(value).normalize("NFKD").replace(/[^\x20-\x7E]/g, "");
}

function escapePdfText(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function downloadGpx(trails, filename) {
  trails = trails.filter((trail) => trail.visible && trailIsShownInCurrentExtent(trail));
  if (!trails.length) return;
  const version = nextSpatialExportVersion();
  const exportedAt = new Date().toISOString();
  const tracks = trails.map((trail) => `  <trk>\n    <name>${escapeXml(trail.name)}</name>\n    <desc>${escapeXml(`${routeExportDescription(trail)} | Export version ${version}`)}</desc>\n    <trkseg>\n${trail.coords.map(([lat, lon]) => `      <trkpt lat="${lat}" lon="${lon}"></trkpt>`).join("\n")}\n    </trkseg>\n  </trk>`).join("\n");
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Urban Trails Development Plan" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">\n  <metadata>\n    <name>Urban Trails Development Plan v${version}</name>\n    <desc>Spatial route data export version ${version}</desc>\n    <time>${exportedAt}</time>\n  </metadata>\n${tracks}\n</gpx>\n`;
  downloadText(gpx, versionedExportFilename(filename, version), "application/gpx+xml");
}

function downloadKml(trails, filename) {
  trails = trails.filter((trail) => trail.visible && trailIsShownInCurrentExtent(trail));
  if (!trails.length) return;
  const version = nextSpatialExportVersion();
  const exportedAt = new Date().toISOString();
  const styles = trails.map((trail, index) => `    <Style id="trail-style-${index}"><LineStyle><color>${kmlColor(trail.color || trailColorForIndex(index))}</color><width>5</width></LineStyle></Style>`).join("\n");
  const placemarks = trails.map((trail, index) => `    <Placemark>\n      <name>${escapeXml(trail.name)}</name>\n      <description>${escapeXml(`${routeExportDescription(trail)} | Export version ${version}`)}</description>\n      <styleUrl>#trail-style-${index}</styleUrl>\n      <LineString>\n        <tessellate>1</tessellate>\n        <coordinates>\n${trail.coords.map(([lat, lon]) => `          ${lon},${lat},0`).join("\n")}\n        </coordinates>\n      </LineString>\n    </Placemark>`).join("\n");
  const kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n    <name>Urban Trails Development Plan v${version}</name>\n    <ExtendedData>\n      <Data name="export_version"><value>${version}</value></Data>\n      <Data name="exported_at"><value>${exportedAt}</value></Data>\n    </ExtendedData>\n${styles}\n${placemarks}\n  </Document>\n</kml>\n`;
  downloadText(kml, versionedExportFilename(filename, version), "application/vnd.google-earth.kml+xml");
}

function nextSpatialExportVersion() {
  const previous = Number.parseInt(localStorage.getItem(SPATIAL_EXPORT_VERSION_KEY) || "0", 10);
  const version = Number.isFinite(previous) ? previous + 1 : 1;
  localStorage.setItem(SPATIAL_EXPORT_VERSION_KEY, String(version));
  return version;
}

function versionedExportFilename(filename, version) {
  const extensionIndex = filename.lastIndexOf(".");
  return extensionIndex > 0
    ? `${filename.slice(0, extensionIndex)}-v${version}${filename.slice(extensionIndex)}`
    : `${filename}-v${version}`;
}

function kmlColor(hex) {
  const color = normalizeHexColor(hex, "#e25f3d").slice(1);
  return `ff${color.slice(4, 6)}${color.slice(2, 4)}${color.slice(0, 2)}`;
}

function routeExportDescription(trail) {
  return `${trail.city} | ${formatDistance(routeDistanceMiles(trail))} | ${trail.geometrySource}`;
}

function downloadText(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
}

function downloadBlob(blob, filename) {
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
