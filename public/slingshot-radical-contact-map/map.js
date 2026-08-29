(() => {
  const mapNode = document.querySelector('#map');
  const searchInput = document.querySelector('#map-search');
  const regionRow = document.querySelector('#region-row');
  const resultList = document.querySelector('#result-list');
  const shownCount = document.querySelector('#shown-count');
  const placeCount = document.querySelector('#place-count');
  const panel = document.querySelector('#directory-panel');
  const openButton = document.querySelector('#open-directory');
  const closeButton = document.querySelector('#close-directory');
  const resetButton = document.querySelector('#reset-filters');

  let locations = [];
  let visible = [];
  let activeRegion = 'All';
  let map;
  let clusterLayer;
  const markers = new Map();

  function addText(parent, tagName, text, className) {
    const element = document.createElement(tagName);
    element.textContent = text;
    if (className) element.className = className;
    parent.appendChild(element);
    return element;
  }

  function popupFor(location) {
    const popup = document.createElement('div');
    popup.className = 'map-popup';
    addText(popup, 'p', location.country, 'map-kicker');
    addText(popup, 'h2', location.name);
    addText(popup, 'p', location.address || location.country, 'map-address');

    const links = document.createElement('div');
    links.className = 'map-links';
    if (location.website) {
      const website = addText(links, 'a', 'Visit website ↗');
      website.href = location.website;
      website.target = '_blank';
      website.rel = 'noreferrer';
    }
    const source = addText(links, 'a', 'Slingshot source ↗');
    source.href = location.source;
    source.target = '_blank';
    source.rel = 'noreferrer';
    popup.appendChild(links);
    return popup;
  }

  function markerIcon() {
    return L.divIcon({
      html: '<span></span>',
      className: 'slingshot-marker',
      iconSize: L.point(18, 18),
      iconAnchor: L.point(9, 9),
    });
  }

  function renderMarkers(shouldFit) {
    if (clusterLayer) map.removeLayer(clusterLayer);
    markers.clear();
    clusterLayer = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 48,
      iconCreateFunction(group) {
        return L.divIcon({
          html: `<span>${group.getChildCount()}</span>`,
          className: 'slingshot-cluster',
          iconSize: L.point(42, 42),
        });
      },
    });

    visible.forEach((location) => {
      const marker = L.marker([location.lat, location.lng], {
        icon: markerIcon(),
        title: location.name,
      });
      marker.bindPopup(popupFor(location), { maxWidth: 300, minWidth: 220 });
      clusterLayer.addLayer(marker);
      markers.set(location.id, marker);
    });
    map.addLayer(clusterLayer);

    if (shouldFit && visible.length) {
      const bounds = L.latLngBounds(visible.map((location) => [location.lat, location.lng]));
      map.fitBounds(bounds, { padding: [70, 70], maxZoom: 12 });
    }
  }

  function focusLocation(location) {
    const marker = markers.get(location.id);
    if (!marker) return;
    clusterLayer.zoomToShowLayer(marker, () => {
      map.flyTo([location.lat, location.lng], 15, { duration: 0.9 });
      window.setTimeout(() => marker.openPopup(), 650);
    });
  }

  function renderResults() {
    resultList.replaceChildren();
    shownCount.textContent = `${visible.length.toLocaleString()} shown`;

    visible.slice(0, 80).forEach((location) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'result-row';
      row.addEventListener('click', () => focusLocation(location));
      addText(row, 'span', '•', 'pin');
      const copy = document.createElement('span');
      addText(copy, 'strong', location.name);
      addText(copy, 'small', location.address || location.country);
      row.appendChild(copy);
      addText(row, 'span', '◎', 'row-action');
      resultList.appendChild(row);
    });

    if (visible.length > 80) {
      addText(resultList, 'p', 'Zoom or refine your search to see more.', 'more-results');
    }
    if (!visible.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      addText(empty, 'p', 'No places match those filters.');
      const clear = addText(empty, 'button', 'Clear filters');
      clear.type = 'button';
      clear.addEventListener('click', resetFilters);
      resultList.appendChild(empty);
    }
  }

  function renderRegions() {
    const regions = ['All', ...new Set(locations.map((location) => location.region).filter(Boolean))];
    regions.sort((a, b) => a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b));
    regionRow.replaceChildren();
    regions.forEach((region) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = region === activeRegion ? 'region-chip active' : 'region-chip';
      button.textContent = region;
      button.addEventListener('click', () => {
        activeRegion = region;
        renderRegions();
        applyFilters(true);
      });
      regionRow.appendChild(button);
    });
  }

  function applyFilters(shouldFit) {
    const needle = searchInput.value.trim().toLowerCase();
    visible = locations.filter((location) => {
      const matchesRegion = activeRegion === 'All' || location.region === activeRegion;
      const haystack = `${location.name} ${location.address} ${location.country} ${location.region}`.toLowerCase();
      return matchesRegion && (!needle || haystack.includes(needle));
    });
    renderMarkers(shouldFit && Boolean(needle || activeRegion !== 'All'));
    renderResults();
  }

  function resetFilters() {
    searchInput.value = '';
    activeRegion = 'All';
    renderRegions();
    applyFilters(false);
  }

  async function start() {
    try {
      const response = await fetch('/slingshot-radical-contact-map/locations.json');
      if (!response.ok) throw new Error(`Directory request failed (${response.status})`);
      const payload = await response.json();
      locations = payload.locations.filter((location) => Number.isFinite(location.lat) && Number.isFinite(location.lng));
      visible = locations;
      placeCount.textContent = `${locations.length.toLocaleString()} active places`;

      map = L.map(mapNode, { zoomControl: false, minZoom: 2, worldCopyJump: true }).setView([27, 2], 2);
      L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · tiles by <a href="https://www.hotosm.org/">HOT</a>',
      }).addTo(map);
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      renderRegions();
      applyFilters(false);
    } catch (error) {
      placeCount.textContent = 'Directory unavailable';
      resultList.replaceChildren();
      addText(resultList, 'p', 'The map data could not be loaded. Please refresh and try again.', 'status-message error');
      console.error(error);
    }
  }

  searchInput.addEventListener('input', () => applyFilters(true));
  resetButton.addEventListener('click', resetFilters);
  closeButton.addEventListener('click', () => {
    panel.classList.remove('is-open');
    panel.classList.add('is-closed');
    openButton.classList.add('is-visible');
  });
  openButton.addEventListener('click', () => {
    panel.classList.remove('is-closed');
    panel.classList.add('is-open');
    openButton.classList.remove('is-visible');
  });

  start();
})();

