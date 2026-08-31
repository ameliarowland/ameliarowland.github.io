export const TOOL_LINKS: Record<string, string> = {
  'ArcGIS Pro': 'https://www.esri.com/en-us/arcgis/products/arcgis-pro/overview',
  'Copernicus GHSL': 'https://human-settlement.emergency.copernicus.eu/',
  'ESA WorldCover': 'https://esa-worldcover.org/',
  GeoJSON: 'https://www.rfc-editor.org/info/rfc7946/',
  HOT: 'https://www.hotosm.org/',
  Leaflet: 'https://leafletjs.com/',
  'MapLibre GL JS': 'https://maplibre.org/maplibre-gl-js/docs/',
  'Natural Earth': 'https://www.naturalearthdata.com/',
  OpenStreetMap: 'https://www.openstreetmap.org/',
  QGIS: 'https://qgis.org/',
};

export const SCRIPTING_LANGUAGES = new Set(['JavaScript', 'Python', 'R', 'TypeScript']);

export function getToolLink(tool: string) {
  return TOOL_LINKS[tool];
}

export function toolNeedsLink(tool: string) {
  return !SCRIPTING_LANGUAGES.has(tool);
}
