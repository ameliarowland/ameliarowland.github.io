import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadOffsetEngine} from '../public/rail-vs-air/offset-engine.js';
import {createLayoutEngine} from '../public/rail-vs-air/layout-core.js';
import {filterDisplayData,simplifyDisplayGeometry} from '../public/rail-vs-air/model.js';
const load=n=>JSON.parse(fs.readFileSync('public/rail-vs-air/data/'+n,'utf8'));
const data=filterDisplayData(load('routes.geojson'),load('stations.geojson'),load('comparisons.json')),manifest=load('manifest.json');
for(const f of data.routes.features)f.properties.color=manifest.routeColors[f.properties.name];
assert.equal(manifest.displayTopology.simplification,false);
for(const z of [3,7.9,12,16])assert.equal(simplifyDisplayGeometry(data.routes,z),data.routes);
const expected=new Set(data.stations.features.flatMap(s=>s.properties.routeNames.map(name=>s.properties.Code+'|'+name)));
const layout=createLayoutEngine(data.routes,data.stations,load('shapes.json'),await loadOffsetEngine());
const regions={godfrey:[-90.28,38.86,-90.13,39.04],selma:[-78.48,35.45,-78.20,35.67],richmond:[-77.51,37.51,-77.36,37.65],philadelphia:[-75.23,39.93,-75.13,40.01],newHaven:[-72.96,41.28,-72.86,41.35],newYork:[-74.04,40.71,-73.90,40.86],washington:[-77.2,38.70,-76.9,39.02]};
let id=0;
for(const [region,bounds] of Object.entries(regions))for(const zoom of [5,7.9,12,16]) {
 const r=layout({id:++id,zoom,bounds,records:[]});
 assert.deepEqual(r.displayed.connectivityAudit.brokenJunctions,[],`${region} ${zoom}`);
 assert.deepEqual(new Set(r.dots.features.map(s=>s.properties.Code+'|'+s.properties.symbolRoutes[0])),expected,`Station omitted: ${region} ${zoom}`);
 for(const f of r.displayed.features)for(const s of f.properties.stationPositions)assert(f.geometry.coordinates.some(p=>Math.hypot(p[0]-s.coordinates[0],p[1]-s.coordinates[1])<1e-9),`Disconnected dot ${s.Code} ${s.name}`);
 console.log(region,zoom,r.layoutMilliseconds+' ms');
}
const job={id:++id,zoom:12,bounds:regions.godfrey,records:[]};layout(job);assert.equal(layout(job).cacheHit,true);
const repairs=load('source-gap-repairs.json');
const texas=repairs.verified.find(r=>r.route==='Texas Eagle'&&Math.abs(r.lengthMeters-233)<1);
assert(texas&&texas.gtfsMaximumDeviationMeters<1);
assert(repairs.unverified.every(r=>r.gtfsMaximumDeviationMeters===null||r.gtfsMaximumDeviationMeters>100));
console.log('Verified visible connections, every scheduled station marker, no simplification, and cache reuse across seven regions/four zooms.');
