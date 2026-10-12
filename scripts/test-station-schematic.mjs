import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createSchematicEngine,schematicDrawingStyle} from '../public/rail-vs-air/schematic.js';
import {filterDisplayData} from '../public/rail-vs-air/model.js';
const load=n=>JSON.parse(fs.readFileSync('public/rail-vs-air/data/'+n,'utf8'));
const data=filterDisplayData(load('station-schematic.geojson'),load('stations.geojson'),load('comparisons.json')),manifest=load('manifest.json');
for(const f of data.routes.features)f.properties.color=manifest.routeColors[f.properties.symbologyName||f.properties.name];
const started=performance.now(),engine=createSchematicEngine(data.routes,data.stations);console.log('Initialize ms',Math.round(performance.now()-started));
for(const zoom of [3,4,4.8,5.8,6.8,7.9,12,16]){
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
assert.deepEqual(westToEast,['Borealis','Empire Builder','Hiawatha Service','California Zephyr','Southwest Chief','Carl Sandburg','Illinois Zephyr','Lincoln Service','Lincoln Service Missouri River Runner','Texas Eagle','City Of New Orleans','Illini','Saluki','Cardinal','Floridian','Capitol Limited','Lake Shore Limited','Wolverine','Blue Water','Pere Marquette']);
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
 if(code==='CHI')assert(distance<diameter,'Chicago keeps its existing overlap');else assert(Math.abs(distance-diameter)<.001,'New York circles touch without overlap');
 assert(distance>0,'Every hub route keeps a distinct position');
}
console.log('Chicago spacing preserved; New York circles touch.');

const hammond=new Map();for(const f of chicago.displayed.features)for(const p of f.properties.stationPositions)if(p.Code==='HMI')hammond.set(p.name,p.coordinates[1]);
assert.deepEqual([...hammond].sort((a,b)=>b[1]-a[1]).map(([name])=>name),['Pere Marquette','Blue Water','Wolverine','Lake Shore Limited','Capitol Limited','Floridian']);
console.log('Hammond–Whiting north-to-south order verified.');

for(const zoom of [4,8,12,16]){
 const result=engine.render({id:6,zoom,records:[]}),stations=new Map(),diameter=2*(result.dots.features[0].properties.radius+result.dots.features[0].properties.ringWidth);
 const project=p=>[(p[0]+180)/360*512*2**zoom,(1-Math.log(Math.tan(Math.PI/4+p[1]*Math.PI/360))/Math.PI)/2*512*2**zoom];
 for(const f of result.displayed.features)for(const p of f.properties.stationPositions){if(!stations.has(p.Code))stations.set(p.Code,new Map());stations.get(p.Code).set(p.name,p.coordinates);}
 for(const [code,routes] of stations){const points=[...routes.values()].sort((a,b)=>a[0]-b[0]);for(let i=1;i<points.length;i++){
  const a=project(points[i-1]),b=project(points[i]),distance=Math.hypot(a[0]-b[0],a[1]-b[1]);
  if(code==='CHI')assert(distance<diameter&&distance>0,'Chicago retains its existing spacing');else assert(Math.abs(distance-diameter)<.001,'Uniform touching circle spacing at '+code+' zoom '+zoom);
 }}
}
console.log('Uniform touching spacing verified at every station except Chicago.');
const aligned=engine.render({id:7,zoom:12,records:[]}),dotGroups=Map.groupBy(aligned.dots.features,f=>f.properties.Code);
const screenPoint=p=>[(p[0]+180)/360*512*2**12,(1-Math.log(Math.tan(Math.PI/4+p[1]*Math.PI/360))/Math.PI)/2*512*2**12];
for(const [code,dots] of dotGroups){if(dots.length<3||code==='CHI')continue;const [a,b,...rest]=dots.map(f=>screenPoint(f.geometry.coordinates)),dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);for(const p of rest)assert(Math.abs(dx*(p[1]-a[1])-dy*(p[0]-a[0]))/length<.001,'All dots share one row at '+code);}
for(const code of ['POS','ONA']){
 const points=dotGroups.get(code).map(f=>screenPoint(f.geometry.coordinates));
 assert(Math.abs(points[1][0]-points[0][0])<Math.abs(points[1][1]-points[0][1])*.15,'Dots align across the east-west route bundle at '+code);
}
console.log('Station dot rows verified, including Pomona and Ontario transverse alignment.');

const referenceAxes=new Map();
for(const zoom of [3.8,4.8,5.7,5.8,5.9,6.8,7.9,12,16]){
 const result=engine.render({id:8,zoom,records:[]}),world=512*2**zoom,project=p=>[(p[0]+180)/360*world,(1-Math.log(Math.tan(Math.PI/4+p[1]*Math.PI/360))/Math.PI)/2*world],rows=new Map();
 for(const f of result.displayed.features){
  const source=data.routes.features[f.properties.edgeId],a=project(source.geometry.coordinates[0]),b=project(source.geometry.coordinates[1]),u=project(f.geometry.coordinates[0]),v=project(f.geometry.coordinates[1]),dx=b[0]-a[0],dy=b[1]-a[1];
  assert(f.geometry.coordinates.every(p=>p.every(Number.isFinite)),'Finite straight station-to-station geometry');
  for(const p of f.properties.stationPositions){if(!rows.has(p.Code))rows.set(p.Code,new Map());rows.get(p.Code).set(p.name,project(p.coordinates));}
 }
 for(const [code,positions] of rows){if(positions.size<2)continue;const names=[...positions.keys()].sort(),a=positions.get(names[0]),b=positions.get(names.at(-1)),length=Math.hypot(b[0]-a[0],b[1]-a[1]),axis=[(b[0]-a[0])/length,(b[1]-a[1])/length];
  if(!referenceAxes.has(code))referenceAxes.set(code,axis);else{const ref=referenceAxes.get(code);assert(ref[0]*axis[0]+ref[1]*axis[1]>.99999,'Station row direction cannot flip with zoom at '+code);}
 }
}
console.log('Fractional-zoom row-direction stability passed, including zoom 5.8.');
const chicagoArrivals=chicago.displayed.features.filter(f=>['CHI'].includes(f.properties.from)||['CHI'].includes(f.properties.to));
const westFamily=new Set(westToEast.slice(0,westToEast.indexOf('Cardinal'))),westArrivals=chicagoArrivals.filter(f=>westFamily.has(f.properties.symbologyName));
const arrivalSide=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
for(let i=0;i<westArrivals.length;i++)for(let j=i+1;j<westArrivals.length;j++){
 const [a,b]=westArrivals[i].geometry.coordinates.map(screenPoint),[c,d]=westArrivals[j].geometry.coordinates.map(screenPoint);
 assert(!(arrivalSide(a,b,c)*arrivalSide(a,b,d)<-1e-8&&arrivalSide(c,d,a)*arrivalSide(c,d,b)<-1e-8),'Chicago northern / western / southern arrivals must not cross: '+westArrivals[i].properties.name+' / '+westArrivals[j].properties.name);
}
const chiRow=new Map();for(const f of chicago.displayed.features)for(const p of f.properties.stationPositions)if(p.Code==='CHI')chiRow.set(p.name,p.coordinates[1]);
for(let i=1;i<westToEast.indexOf('Cardinal');i++)assert(chiRow.get(westToEast[i-1])>chiRow.get(westToEast[i]),'Chicago row runs northwest to southeast in the requested order');
console.log('Chicago northern, western and southern arrivals verified without crossings.');
const orderedRows=new Map();for(const f of chicago.displayed.features)for(const p of f.properties.stationPositions){if(!orderedRows.has(p.Code))orderedRows.set(p.Code,new Map());orderedRows.get(p.Code).set(p.name,p.coordinates);}
for(const [code,row] of orderedRows){
 if(row.has('Northeast Regional')){const nr=row.get('Northeast Regional');for(const [name,p] of row)if(name!=='Northeast Regional')assert(nr[0]>=p[0]-1e-10&&nr[1]<=p[1]+1e-10,'Northeast Regional stays south/east at '+code);}
 if(row.has('Texas Eagle')&&row.has('Sunset Limited'))assert(row.get('Texas Eagle')[1]>row.get('Sunset Limited')[1],'Texas Eagle is north of Sunset Limited at '+code);
 const coastal=['Coast Starlight','Amtrak Cascades','Empire Builder'].filter(name=>row.has(name));
 if(coastal.length>1&&[...row.values()][0][0]<-116)assert.deepEqual([...coastal].sort((a,b)=>row.get(a)[0]-row.get(b)[0]),coastal,'West-coast service order at '+code);
 if(row.has('Coast Starlight')&&[...row.values()][0][0]<-116)for(const [name,p] of row)assert(row.get('Coast Starlight')[0]<=p[0]+1e-10,'Coast Starlight remains westernmost at '+code);
}
const la=orderedRows.get('LAX');assert.deepEqual([...la].sort((a,b)=>a[1][0]-b[1][0]).map(([name])=>name),['Coast Starlight','Pacific Surfliner','Southwest Chief','Texas Eagle','Sunset Limited']);
const northern=chicago.displayed.features.filter(f=>[f.properties.from,f.properties.to].sort().join('|')==='CHI|GLN'),sourceNorthern=data.routes.features[northern[0].properties.edgeId].geometry.coordinates.map(screenPoint),dx=sourceNorthern[1][0]-sourceNorthern[0][0],dy=sourceNorthern[1][1]-sourceNorthern[0][1],length=Math.hypot(dx,dy);
const mid=northern.map(f=>{const [a,b]=f.geometry.coordinates.map(screenPoint);return [(a[0]+b[0])/2,(a[1]+b[1])/2];});
for(let i=0;i<mid.length;i++)for(let j=i+1;j<mid.length;j++)assert(Math.abs(-dy*(mid[i][0]-mid[j][0])+dx*(mid[i][1]-mid[j][1]))/length>chicago.style.baseWidth,'Glenview–Chicago strokes remain visibly separated');
console.log('Northeast Regional, Texas Eagle, Los Angeles and west-coast ordering verified; Glenview lines visibly separated.');
