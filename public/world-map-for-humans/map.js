(() => {
  const initialView = { center: [7, 16], zoom: 1.35 };
  const layerState = {
    coastlines: true,
    water: true,
    urban: true,
    population: false,
    'land-cover': false,
    'false-colour': false,
  };

  const layerIds = {
    coastlines: ['coastline-halo', 'coastline'],
    water: ['water-fill'],
    urban: ['urban-fill', 'urban-outline'],
    population: ['population-density'],
    'land-cover': ['worldcover-land-cover'],
    'false-colour': ['worldcover-false-colour'],
  };

  const worldCoverBase = 'https://mapproxy.terrascope.be/mapproxy/wmts';
  const ghslPopulationCog = 'https://human-settlement.emergency.copernicus.eu/data/tiles/tilesets1/NEW2/COG/POP/WUP_POP_2020.tif';
  const ghslPopulationTiles = `https://titiler.terrascope.be/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png?url=${encodeURIComponent(ghslPopulationCog)}&expression=b1%2A%28b1%3C255%29&colormap_name=plasma&rescale=1%2C18&nodata=0`;
  const osmAttribution = '<a href="https://openfreemap.org/" target="_blank">OpenFreeMap</a> · <a href="https://www.openmaptiles.org/" target="_blank">© OpenMapTiles</a> · data <a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors, ODbL</a>';
  const worldCoverAttribution = '<a href="https://esa-worldcover.org/en/data-access" target="_blank">© ESA WorldCover</a> · service <a href="https://terrascope.be/" target="_blank">Terrascope</a>';
  const ghslAttribution = '<a href="https://human-settlement.emergency.copernicus.eu/ghs_wup_pop_r2025a.php" target="_blank">© EU · GHS-WUP-POP</a> · <a href="https://terrascope.be/" target="_blank">Terrascope tiles</a>';

  const map = new maplibregl.Map({
    container: 'map',
    center: initialView.center,
    zoom: initialView.zoom,
    minZoom: 0.75,
    maxZoom: 14,
    renderWorldCopies: false,
    attributionControl: false,
    style: {
      version: 8,
      sources: {
        openmaptiles: {
          type: 'vector',
          url: 'https://tiles.openfreemap.org/planet',
          attribution: osmAttribution,
        },
        urban: {
          type: 'geojson',
          data: '/world-map-for-humans/urban-areas.geojson',
          attribution: '<a href="https://www.naturalearthdata.com/" target="_blank">Made with Natural Earth</a>',
        },
        'worldcover-land-cover': {
          type: 'raster',
          tiles: [`${worldCoverBase}/esa-worldcover-map-10m-2021-v2_map/webmercator/{z}/{x}/{y}.png`],
          tileSize: 256,
          minzoom: 0,
          maxzoom: 13,
          attribution: worldCoverAttribution,
        },
        'worldcover-false-colour': {
          type: 'raster',
          tiles: [`${worldCoverBase}/esa-worldcover-s2rgbnir-10m-2021-v2_fcc/webmercator/{z}/{x}/{y}.png`],
          tileSize: 256,
          minzoom: 0,
          maxzoom: 13,
          attribution: worldCoverAttribution,
        },
      },
      layers: [
        {
          id: 'paper',
          type: 'background',
          paint: { 'background-color': '#e9e5d9' },
        },
        {
          id: 'worldcover-land-cover',
          type: 'raster',
          source: 'worldcover-land-cover',
          layout: { visibility: 'none' },
          paint: { 'raster-opacity': 0.94, 'raster-fade-duration': 180 },
        },
        {
          id: 'worldcover-false-colour',
          type: 'raster',
          source: 'worldcover-false-colour',
          layout: { visibility: 'none' },
          paint: { 'raster-opacity': 0.94, 'raster-fade-duration': 180 },
        },
        {
          id: 'water-fill',
          type: 'fill',
          source: 'openmaptiles',
          'source-layer': 'water',
          paint: {
            'fill-color': '#8cb9bb',
            'fill-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.92, 8, 0.82],
          },
        },
        {
          id: 'urban-fill',
          type: 'fill',
          source: 'urban',
          paint: {
            'fill-color': '#e25f3d',
            'fill-opacity': ['interpolate', ['linear'], ['zoom'], 1, 0.42, 8, 0.62],
          },
        },
        {
          id: 'urban-outline',
          type: 'line',
          source: 'urban',
          minzoom: 3,
          paint: { 'line-color': '#7f2f22', 'line-width': 0.65, 'line-opacity': 0.6 },
        },
        {
          id: 'coastline-halo',
          type: 'line',
          source: 'openmaptiles',
          'source-layer': 'water',
          paint: {
            'line-color': '#f7f1e3',
            'line-width': ['interpolate', ['linear'], ['zoom'], 0, 1.7, 8, 3.2],
            'line-opacity': 0.8,
          },
        },
        {
          id: 'coastline',
          type: 'line',
          source: 'openmaptiles',
          'source-layer': 'water',
          paint: {
            'line-color': '#173a3c',
            'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.7, 8, 1.25],
            'line-opacity': 0.94,
          },
        },
      ],
    },
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }), 'bottom-right');
  map.addControl(new maplibregl.AttributionControl({ compact: false }), 'bottom-right');

  const status = document.querySelector('#map-status');
  const layerPanel = document.querySelector('#layer-panel');
  const openLayers = document.querySelector('#open-layers');
  const closeLayers = document.querySelector('#close-layers');
  const coordinateReadout = document.querySelector('#coordinate-readout');
  const zoomReadout = document.querySelector('#zoom-readout');
  const landCoverLegend = document.querySelector('#land-cover-legend');
  const populationLegend = document.querySelector('#population-legend');

  function ensurePopulationLayer() {
    if (map.getLayer('population-density')) return;

    map.addSource('ghsl-population', {
      type: 'raster',
      tiles: [ghslPopulationTiles],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 10,
      attribution: ghslAttribution,
    });
    map.addLayer({
      id: 'population-density',
      type: 'raster',
      source: 'ghsl-population',
      layout: { visibility: 'none' },
      paint: { 'raster-opacity': 0.9, 'raster-fade-duration': 140 },
    }, 'water-fill');
  }

  function setLayerVisibility(layerName, isVisible) {
    if (layerName === 'population' && isVisible) ensurePopulationLayer();
    layerState[layerName] = isVisible;
    layerIds[layerName].forEach((id) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', isVisible ? 'visible' : 'none');
    });
    const button = document.querySelector(`[data-layer="${layerName}"]`);
    if (button) {
      button.classList.toggle('is-on', isVisible);
      button.setAttribute('aria-pressed', String(isVisible));
    }
    if (layerName === 'land-cover') landCoverLegend.hidden = !isVisible;
    if (layerName === 'population') populationLegend.hidden = !isVisible;
  }

  function toggleLayer(layerName) {
    const next = !layerState[layerName];
    if (next && layerName === 'land-cover') setLayerVisibility('false-colour', false);
    if (next && layerName === 'false-colour') setLayerVisibility('land-cover', false);
    setLayerVisibility(layerName, next);
    if (next && layerName === 'population') {
      status.textContent = 'Loading population tiles…';
      status.classList.remove('is-hidden', 'is-error');
      map.once('idle', () => {
        if (!status.classList.contains('is-error')) status.classList.add('is-hidden');
      });
    }
  }

  function updatePosition() {
    const center = map.getCenter();
    const lat = `${Math.abs(center.lat).toFixed(1)}°${center.lat < 0 ? 'S' : 'N'}`;
    const lon = `${Math.abs(center.lng).toFixed(1)}°${center.lng < 0 ? 'W' : 'E'}`;
    coordinateReadout.textContent = `${lat}, ${lon}`;
    zoomReadout.textContent = map.getZoom() < 2 ? 'World view' : `Zoom ${map.getZoom().toFixed(1)}`;
  }

  function setPanel(open) {
    layerPanel.classList.toggle('is-hidden', !open);
    openLayers.classList.toggle('is-visible', !open);
    openLayers.setAttribute('aria-expanded', String(open));
  }

  document.querySelectorAll('.layer-toggle').forEach((button) => {
    button.addEventListener('click', () => toggleLayer(button.dataset.layer));
  });

  document.querySelector('#reset-view').addEventListener('click', () => {
    map.flyTo({ center: initialView.center, zoom: initialView.zoom, duration: 900 });
  });
  closeLayers.addEventListener('click', () => setPanel(false));
  openLayers.addEventListener('click', () => setPanel(true));
  map.on('move', updatePosition);
  map.once('idle', () => {
    status.classList.add('is-hidden');
    updatePosition();
  });
  map.on('error', (event) => {
    if (event.error && /urban-areas\.geojson/.test(String(event.error.message))) {
      status.textContent = 'The urban layer could not be loaded.';
      status.classList.add('is-error');
    }
    if (event.sourceId === 'ghsl-population') {
      status.textContent = 'The population layer could not be loaded.';
      status.classList.remove('is-hidden');
      status.classList.add('is-error');
    }
  });
})();
