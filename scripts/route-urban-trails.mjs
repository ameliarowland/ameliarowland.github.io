import fs from "node:fs";
import vm from "node:vm";

const dataPath = new URL("../public/urban-trails-finder/data.js", import.meta.url);
const source = fs.readFileSync(dataPath, "utf8");
const context = {};
vm.createContext(context);
vm.runInContext(`${source}\nthis.TRAILS = TRAILS;`, context);

const routedTrails = [];

for (const trail of context.TRAILS) {
  const controlPoints = trail.controlPoints || trail.coords;
  const routedCoords = await routePedestrianLoop(controlPoints, trail.id);
  routedTrails.push({
    ...trail,
    geometrySource: "Valhalla pedestrian routing over OpenStreetMap control points",
    controlPoints,
    coords: routedCoords
  });
  console.log(`${trail.id}: ${controlPoints.length} controls -> ${routedCoords.length} routed vertices`);
  await sleep(350);
}

const output = `const TRAILS = ${JSON.stringify(routedTrails, null, 2)};\n`;
fs.writeFileSync(dataPath, output);

async function routePedestrianLoop(controlPoints, trailId) {
  const request = {
    locations: controlPoints.map(([lat, lon]) => ({ lat, lon })),
    costing: "pedestrian",
    directions_options: { units: "miles" }
  };
  const url = `https://valhalla1.openstreetmap.de/route?json=${encodeURIComponent(JSON.stringify(request))}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${trailId}: Valhalla returned ${response.status}`);
  }

  const json = await response.json();
  if (!json.trip?.legs?.length) {
    throw new Error(`${trailId}: Valhalla returned no route legs`);
  }

  const coords = json.trip.legs.flatMap((leg, index) => {
    const decoded = decodePolyline(leg.shape);
    return index === 0 ? decoded : decoded.slice(1);
  });

  if (coords.length < controlPoints.length) {
    throw new Error(`${trailId}: routed geometry has fewer vertices than control points`);
  }

  return coords.map(([lat, lon]) => [
    Number(lat.toFixed(6)),
    Number(lon.toFixed(6))
  ]);
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
    coordinates.push([lat / 1e6, lon / 1e6]);
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

  const value = result & 1 ? ~(result >> 1) : result >> 1;
  return { value, index };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
