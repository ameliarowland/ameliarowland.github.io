import fs from 'node:fs';
import {loadOffsetEngine} from '../public/rail-vs-air/offset-engine.js';
import {createLayoutEngine} from '../public/rail-vs-air/layout-core.js';
import {filterDisplayData} from '../public/rail-vs-air/model.js';
const load=n=>JSON.parse(fs.readFileSync('public/rail-vs-air/data/'+n,'utf8'));
const data=filterDisplayData(load('routes.geojson'),load('stations.geojson'),load('comparisons.json')),manifest=load('manifest.json');
for(const f of data.routes.features)f.properties.color=manifest.routeColors[f.properties.name];
const started=performance.now(),layout=createLayoutEngine(data.routes,data.stations,load('shapes.json'),await loadOffsetEngine());console.log('Prepare ms',Math.round(performance.now()-started));
for(const job of [{zoom:12,bounds:[-90.27,38.88,-90.14,39.02]},{zoom:12,bounds:[-90.27,38.88,-90.14,39.02]},{zoom:13,bounds:[-90.23,38.92,-90.16,38.99]}]) {
 const result=layout({...job,id:1,records:data.comparisons.filter(r=>r.railMinutes<=r.flightMinutes+240)});console.log(JSON.stringify({zoom:job.zoom,ms:result.layoutMilliseconds,cacheHit:result.cacheHit,vertices:result.displayed.features.reduce((n,f)=>n+f.geometry.coordinates.length,0),dots:result.dots.features.length,brokenJunctions:result.displayed.connectivityAudit.brokenJunctions}));
 if(job.zoom===12)fs.writeFileSync('../texas-unsimplified-render.json',JSON.stringify(result));
}
