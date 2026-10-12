import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createSchematicEngine} from '../public/rail-vs-air/schematic.js';
import {filterDisplayData} from '../public/rail-vs-air/model.js';
const load=n=>JSON.parse(fs.readFileSync('public/rail-vs-air/data/'+n,'utf8'));
const data=filterDisplayData(load('station-schematic.geojson'),load('stations.geojson'),load('comparisons.json')),manifest=load('manifest.json');
for(const f of data.routes.features)f.properties.color=manifest.routeColors[f.properties.symbologyName||f.properties.name];
const started=performance.now(),engine=createSchematicEngine(data.routes,data.stations);console.log('Initialize ms',Math.round(performance.now()-started));
for(const zoom of [4,7.9,12,16]){
 const result=engine.render({id:1,zoom,records:data.comparisons.filter(r=>r.railMinutes<=r.flightMinutes+240)});
 const points=new Set(result.displayed.features.flatMap(f=>f.geometry.coordinates.map(p=>(f.properties.symbologyName||f.properties.name)+'|'+p.join(','))));
 const missing=result.dots.features.filter(f=>!points.has(f.properties.symbolRoutes[0]+'|'+f.geometry.coordinates.join(',')));
 console.log(JSON.stringify({zoom,ms:result.layoutMilliseconds,segments:result.displayed.features.length,dots:result.dots.features.length,missing:missing.map(f=>f.properties.Code+'|'+f.properties.symbolRoutes[0])}));
 assert.equal(result.dots.features.length,909);assert.equal(missing.length,0,'All station circles must lie on their route');
 assert(result.displayed.features.every(f=>f.geometry.coordinates.length===2),'Only straight segments');
 if(zoom===7.9)fs.writeFileSync('../station-schematic-render.json',JSON.stringify(result));
}
const lnc=data.routes.features.filter(f=>f.properties.name==='Pennsylvanian'&&(f.properties.from==='LNC'||f.properties.to==='LNC'));assert(lnc.length);
assert(engine.journey({route:'Pennsylvanian',origin:'PHL',destination:'NYP'}).length);
console.log('Station schematic checks passed.');
