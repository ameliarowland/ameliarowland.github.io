import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createSchematicEngine,schematicDrawingStyle} from '../public/rail-vs-air/schematic.js';
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
 const passes=new Set(result.displayed.features.flatMap(f=>f.properties.stationPositions.map(p=>p.Code+'|'+p.name)));
 const missingPasses=(data.routes.sourceStationPasses||[]).filter(key=>!key.endsWith('|Auto Train')&&!passes.has(key));
 assert.deepEqual(missingPasses,[],'Every station passed on the original tracks must remain a line vertex, independently of stop membership');
 assert(result.displayed.features.every(f=>f.geometry.coordinates.length===2),'Only straight segments');
 const stationCodes=new Set(data.stations.features.map(s=>s.properties.Code));
 assert(result.displayed.features.every(f=>stationCodes.has(f.properties.from)&&stationCodes.has(f.properties.to)),'Every line endpoint is an actual station');
 const grouped=Map.groupBy(result.displayed.features,f=>[f.properties.from,f.properties.to].sort().join('|'));
 const project=p=>[p[0],Math.log(Math.tan(Math.PI/4+p[1]*Math.PI/360))*180/Math.PI];
 const side=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
 const crossed=[];
 for(const [pair,group] of grouped)for(let i=0;i<group.length;i++)for(let j=i+1;j<group.length;j++){
  const a=group[i],b=group[j];if(a.properties.symbologyName===b.properties.symbologyName)continue;
  const [u,v]=a.geometry.coordinates.map(project),[p,q]=b.geometry.coordinates.map(project);
  if(side(u,v,p)*side(u,v,q)<-1e-20&&side(p,q,u)*side(p,q,v)<-1e-20)crossed.push(pair+' '+a.properties.name+' / '+b.properties.name);
 }
 assert.deepEqual(crossed,[],'Parallel routes must not cross between the same stations');
 if(zoom===7.9)fs.writeFileSync('../station-schematic-render.json',JSON.stringify(result));
}
const lnc=data.routes.features.filter(f=>f.properties.name==='Pennsylvanian'&&(f.properties.from==='LNC'||f.properties.to==='LNC'));assert(lnc.length);
assert(engine.journey({route:'Pennsylvanian',origin:'PHL',destination:'NYP'}).length);

const ewrNames=new Set(data.routes.features.filter(f=>[f.properties.from,f.properties.to].includes('EWR')).map(f=>f.properties.symbologyName));
const nwkNames=new Set(data.routes.features.filter(f=>[f.properties.from,f.properties.to].includes('NWK')).map(f=>f.properties.symbologyName));
for(const name of nwkNames)assert(ewrNames.has(name),'Newark corridor must include airport pass-through for '+name);
const ewr=data.stations.features.find(s=>s.properties.Code==='EWR');assert.deepEqual(ewr.properties.routeNames,['Keystone Service','Northeast Regional'],'Pass-through fixes must not add scheduled stops');

console.log('Station schematic checks passed: all stops attached, no shared-segment crossings, station-only endpoints and Newark pass-throughs.');

const meteor=data.routes.features.filter(f=>f.properties.name==='Silver Meteor');
for(const code of ['FAY','SSM','WLN','RMT'])assert.equal(meteor.filter(f=>[f.properties.from,f.properties.to].includes(code)).length,2,'Silver Meteor must have no spurs at '+code);
for(const [a,b] of [['DIL','FAY'],['FAY','SSM'],['SSM','WLN'],['WLN','RMT']])assert(meteor.some(f=>[f.properties.from,f.properties.to].sort().join('|')===[a,b].sort().join('|')),'Missing Silver Meteor station sequence '+a+'-'+b);
assert(!meteor.some(f=>[f.properties.from,f.properties.to].includes('DIL')&&[f.properties.from,f.properties.to].includes('SSM')),'No bypass around Fayetteville');
assert(schematicDrawingStyle(4).baseWidth<schematicDrawingStyle(12).baseWidth);
assert(schematicDrawingStyle(4).highlightWidth<schematicDrawingStyle(12).highlightWidth);
for(const zoom of [4,8,12])assert(schematicDrawingStyle(zoom).hoverWidth>schematicDrawingStyle(zoom).baseWidth);
const wide=engine.render({id:2,zoom:4,records:[]}),close=engine.render({id:3,zoom:12,records:[]});
assert(wide.dots.features[0].properties.radius<close.dots.features[0].properties.radius);
console.log('Silver Meteor continuity and zoom sizing checks passed.');
const chicago=engine.render({id:4,zoom:12,records:[]}),chicagoPositions=new Map();
for(const f of chicago.displayed.features)for(const p of f.properties.stationPositions)if(p.Code==='CHI')chicagoPositions.set(p.name,p.coordinates[0]);
const westToEast=[...chicagoPositions].sort((a,b)=>a[1]-b[1]).map(([name])=>name);
assert.deepEqual(westToEast,['Borealis','Empire Builder','Hiawatha Service','California Zephyr','Carl Sandburg','Illinois Zephyr','Southwest Chief','Lincoln Service','Lincoln Service Missouri River Runner','Texas Eagle','City Of New Orleans','Illini','Saluki','Cardinal','Floridian','Capitol Limited','Lake Shore Limited','Wolverine','Blue Water','Pere Marquette']);
console.log('Chicago Union Station west-to-east order verified for all 20 lanes.');

for(const code of ['HMI','NBU','SOB']){
 const positions=new Map();for(const f of chicago.displayed.features)for(const p of f.properties.stationPositions)if(p.Code===code)positions.set(p.name,p.coordinates[0]);
 const actual=[...positions].sort((a,b)=>a[1]-b[1]).map(([name])=>name);
 assert.deepEqual(actual,westToEast.filter(name=>positions.has(name)),'Chicago order must continue at '+code);
}
console.log('Chicago order retained at Hammond-Whiting, New Buffalo and South Bend.');

for(const [code,expected] of [['CLT',['Crescent','Carolinian','Piedmont']],['GRO',['Crescent','Carolinian','Piedmont']],['RGH',['Carolinian','Piedmont','Floridian']],['CYN',['Carolinian','Piedmont','Floridian']]]){
 const positions=new Map();for(const f of chicago.displayed.features)for(const p of f.properties.stationPositions)if(p.Code===code&&expected.includes(p.name))positions.set(p.name,p.coordinates[1]);
 assert.deepEqual([...positions].sort((a,b)=>b[1]-a[1]).map(([name])=>name),expected,'North-to-south service order at '+code);
}
console.log('Crescent / Carolinian / Piedmont and Raleigh Floridian ordering verified.');

const regional=data.routes.features.filter(f=>f.properties.name==='Northeast Regional'),pair=f=>[f.properties.from,f.properties.to].sort().join('|');
assert(regional.some(f=>pair(f)==='PTB|RVR'),'Richmond western bypass connects Staples Mill to Petersburg');
assert(regional.some(f=>pair(f)==='RVM|RVR'),'Main Street branch connects to Staples Mill');
assert(!regional.some(f=>pair(f)==='PTB|RVM'),'No artificial Main Street–Petersburg triangle');
console.log('Original-track pass-through station retention and Richmond branch topology verified.');

for(const code of ['CHI','NYP'])for(const zoom of [4,8,12,16]){
 const result=engine.render({id:5,zoom,records:[]}),dots=result.dots.features.filter(f=>f.properties.Code===code).sort((a,b)=>a.geometry.coordinates[0]-b.geometry.coordinates[0]);
 const project=p=>[(p[0]+180)/360*512*2**zoom,(1-Math.log(Math.tan(Math.PI/4+p[1]*Math.PI/360))/Math.PI)/2*512*2**zoom];
 const a=project(dots[0].geometry.coordinates),b=project(dots[1].geometry.coordinates),distance=Math.hypot(a[0]-b[0],a[1]-b[1]),diameter=2*(dots[0].properties.radius+dots[0].properties.ringWidth);
 assert(distance<diameter,'Hub dots should overlap slightly at '+code+' zoom '+zoom);
 assert(distance>diameter*.8,'Hub overlap must stay modest at '+code+' zoom '+zoom);
}
console.log('Slight station-circle overlap verified at Chicago Union and New York Penn.');
