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
 assert(result.dots.features.every(f=>2*f.properties.radius<result.style.baseWidth),'White stop dots fit inside their route bands');
 assert.equal(result.dots.features.length,909);assert.equal(missing.length,0,'All station circles must lie on their route');
 const passes=new Set(result.displayed.features.flatMap(f=>f.properties.stationPositions.map(p=>p.Code+'|'+p.name)));
 const missingPasses=(data.routes.sourceStationPasses||[]).filter(key=>!key.endsWith('|Auto Train')&&!passes.has(key));
 assert.deepEqual(missingPasses,[],'Every station passed on the original tracks must remain a line vertex, independently of stop membership');
 assert(result.displayed.features.every(f=>f.properties.parallelBody.length===2),'Straight parallel body between station joins');
 const stationCodes=new Set(data.stations.features.map(s=>s.properties.Code));
 assert(result.displayed.features.every(f=>stationCodes.has(f.properties.from)&&stationCodes.has(f.properties.to)),'Every line endpoint is an actual station');
 const grouped=Map.groupBy(result.displayed.features,f=>[f.properties.from,f.properties.to].sort().join('|'));
 const project=p=>[p[0],Math.log(Math.tan(Math.PI/4+p[1]*Math.PI/360))*180/Math.PI];
 const side=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
 const crossed=[];
 for(const [pair,group] of grouped)for(let i=0;i<group.length;i++)for(let j=i+1;j<group.length;j++){
  const a=group[i],b=group[j];if(a.properties.symbologyName===b.properties.symbologyName)continue;
  const [u,v]=a.properties.parallelBody.map(project),[p,q]=b.properties.parallelBody.map(project);
  if(side(u,v,p)*side(u,v,q)<-1e-20&&side(p,q,u)*side(p,q,v)<-1e-20)crossed.push(pair+' '+a.properties.name+' / '+b.properties.name);
 }
 assert.deepEqual(crossed,[],'Parallel routes must not cross between the same stations');
 const world=512*2**zoom,screen=p=>[(p[0]+180)/360*world,(1-Math.log(Math.tan(Math.PI/4+p[1]*Math.PI/360))/Math.PI)/2*world];
 const spacing=result.style.laneSpacing;
 for(const [pair,group] of grouped){
  const source=data.routes.features[group[0].properties.edgeId].geometry.coordinates.map(screen),dx=source[1][0]-source[0][0],dy=source[1][1]-source[0][1],length=Math.hypot(dx,dy),normal=[-dy/length,dx/length];
  if(length<1e-8)continue; // Two inventory codes can represent the same physical station.
  const lane=f=>{const p=screen(f.properties.parallelBody[0]),c=screen(data.routes.features[f.properties.edgeId].geometry.coordinates[0]);return (p[0]-c[0])*normal[0]+(p[1]-c[1])*normal[1];};
  for(const f of group){const ends=f.properties.parallelBody.map(screen),anchors=f.properties.stationPositions.map(p=>screen(p.coordinates));for(let i=0;i<2;i++){const delta=[ends[i][0]-anchors[i][0],ends[i][1]-anchors[i][1]];assert(Math.abs(delta[0]*dx/length+delta[1]*dy/length)<1e-6,'Station joins must trim at the displayed dot, without overshooting to the original station at '+pair);}}
  for(const f of group){const [a,b]=f.properties.parallelBody.map(screen),vector=[b[0]-a[0],b[1]-a[1]];assert(Math.abs(vector[0]*normal[0]+vector[1]*normal[1])<1e-6,'Every interstation body is parallel to its source at '+pair+' '+Math.abs(vector[0]*normal[0]+vector[1]*normal[1]));}
  const unique=[...new Map(group.map(f=>[f.properties.symbologyName,f])).values()].sort((a,b)=>lane(a)-lane(b));
  for(let i=1;i<unique.length;i++)assert(Math.abs(lane(unique[i])-lane(unique[i-1])-spacing)<1e-6,'Constant perpendicular lane gap at '+pair);
  const byName=new Map(group.map(f=>[f.properties.symbologyName,f]));
  for(const [below,above] of [['Borealis','Empire Builder'],['Capitol Limited','Floridian']])if(byName.has(below)&&byName.has(above))assert((lane(byName.get(below))-lane(byName.get(above)))*normal[1]>=-1e-6,below+' stays south of '+above+' at '+pair);
  if(byName.has('Vermonter')&&byName.has('Acela'))assert((lane(byName.get('Vermonter'))-lane(byName.get('Acela')))*normal[0]<=1e-6,'Vermonter stays west of Acela at '+pair);
  for(const [west,east] of [['Northeast Regional','Acela'],['Silver Meteor','Floridian'],['Pacific Surfliner','Southwest Chief'],['Missouri River Runner','Texas Eagle'],['Lincoln Service Missouri River Runner','Texas Eagle']])if(byName.has(west)&&byName.has(east))assert((lane(byName.get(west))-lane(byName.get(east)))*normal[0]<=1e-6,west+' stays west of '+east+' at '+pair);
  if(unique.length===1&&!pair.split('|').includes('CHI'))assert(Math.abs(lane(unique[0]))<1e-6,'Single-route corridors must not inherit a distant hub displacement at '+pair);
  if(byName.has('Coast Starlight')&&byName.has('Pacific Surfliner'))assert((lane(byName.get('Pacific Surfliner'))-lane(byName.get('Coast Starlight')))*(normal[0]-normal[1])>0,'Pacific Surfliner stays on the northeast side of Coast Starlight at '+pair);
  if(byName.has('Blue Water')&&byName.has('Wolverine'))assert((lane(byName.get('Blue Water'))-lane(byName.get('Wolverine')))*normal[1]<0,'Blue Water stays north of Wolverine at '+pair);
  if(byName.has('Pere Marquette'))for(const [name,f] of byName)assert((lane(byName.get('Pere Marquette'))-lane(f))*normal[1]<=1e-6,'Pere Marquette stays north of every shared route at '+pair);
  if(byName.has('Maple Leaf'))for(const [name,f] of byName)assert((lane(byName.get('Maple Leaf'))-lane(f))*normal[1]<=1e-6,'Maple Leaf stays north at '+pair);
 }

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
assert.deepEqual(westToEast,['Borealis','Empire Builder','Hiawatha Service','California Zephyr','Southwest Chief','Carl Sandburg','Illinois Zephyr','Lincoln Service','Lincoln Service Missouri River Runner','Texas Eagle','City Of New Orleans','Illini','Saluki','Cardinal','Capitol Limited','Floridian','Lake Shore Limited','Wolverine','Blue Water','Pere Marquette']);
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
 if(code!=='CHI') assert(distance>=diameter-.001,'New York circles do not overlap');
 assert(distance>0,'Every hub route keeps a distinct position');
}
console.log('Chicago station ports and New York minimum circle spacing verified.');

const hammond=new Map();for(const f of chicago.displayed.features)for(const p of f.properties.stationPositions)if(p.Code==='HMI')hammond.set(p.name,p.coordinates[1]);
assert.deepEqual([...hammond].sort((a,b)=>b[1]-a[1]).map(([name])=>name),['Pere Marquette','Blue Water','Wolverine','Lake Shore Limited','Floridian','Capitol Limited']);
console.log('Hammond–Whiting north-to-south order verified.');

for(const zoom of [4,8,12,16]){
 const result=engine.render({id:6,zoom,records:[]}),stations=new Map(),diameter=2*(result.dots.features[0].properties.radius+result.dots.features[0].properties.ringWidth);
 const project=p=>[(p[0]+180)/360*512*2**zoom,(1-Math.log(Math.tan(Math.PI/4+p[1]*Math.PI/360))/Math.PI)/2*512*2**zoom];
 for(const f of result.displayed.features)for(const p of f.properties.stationPositions){if(!stations.has(p.Code))stations.set(p.Code,new Map());stations.get(p.Code).set(p.name,p.coordinates);}
 for(const [code,routes] of stations){const points=[...routes.values()].sort((a,b)=>a[0]-b[0]);for(let i=1;i<points.length;i++){
  const a=project(points[i-1]),b=project(points[i]),distance=Math.hypot(a[0]-b[0],a[1]-b[1]);
  if(code!=='CHI') assert(distance>=diameter-.001,'Circle spacing prevents overlap at '+code+' zoom '+zoom);
 }}
}
console.log('Circle outlines do not overlap at every station except Chicago.');
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
assert(chiRow.get('Borealis')<chiRow.get('Empire Builder'),'Borealis is south of Empire Builder at Chicago');
assert(chiRow.get('Capitol Limited')<chiRow.get('Floridian'),'Capitol Limited is south of Floridian at Chicago');
console.log('Chicago northern, western and southern arrivals verified without crossings.');
const orderedRows=new Map();for(const f of chicago.displayed.features)for(const p of f.properties.stationPositions){if(!orderedRows.has(p.Code))orderedRows.set(p.Code,new Map());orderedRows.get(p.Code).set(p.name,p.coordinates);}
for(const [code,row] of orderedRows){
 if(row.has('Northeast Regional')){const nr=row.get('Northeast Regional');for(const [name,p] of row)if(!['Northeast Regional','Acela'].includes(name))assert(screenPoint(nr)[0]+screenPoint(nr)[1]>=screenPoint(p)[0]+screenPoint(p)[1]-1e-7,'Northeast Regional stays on the southeast side at '+code);}
 if(row.has('Texas Eagle')&&row.has('Sunset Limited'))assert(row.get('Texas Eagle')[1]>row.get('Sunset Limited')[1],'Texas Eagle is north of Sunset Limited at '+code);
 const coastal=['Coast Starlight','Amtrak Cascades','Empire Builder'].filter(name=>row.has(name));
 if(coastal.length>1&&[...row.values()][0][0]<-116)assert.deepEqual([...coastal].sort((a,b)=>row.get(a)[0]-row.get(b)[0]),coastal,'West-coast service order at '+code);
 if(row.has('Coast Starlight')&&[...row.values()][0][0]<-116)for(const [name,p] of row)assert(row.get('Coast Starlight')[0]<=p[0]+1e-10,'Coast Starlight remains westernmost at '+code);
}
for(const [code,row] of orderedRows)if(row.has('Acela')&&row.has('Northeast Regional'))assert(row.get('Acela')[0]>row.get('Northeast Regional')[0],'Acela east of Northeast Regional at '+code);
for(const [code,row] of orderedRows)if(row.has('Silver Meteor')&&row.has('Floridian'))assert(row.get('Silver Meteor')[0]<row.get('Floridian')[0],'Silver Meteor west of Floridian / Silver Star at '+code);
for(const [code,row] of orderedRows)if(row.has('Blue Water')&&row.has('Wolverine'))assert(row.get('Blue Water')[1]>row.get('Wolverine')[1],'Blue Water north of Wolverine at station '+code);
const southBend=orderedRows.get('SOB'),southBendNames=['Lake Shore Limited','Floridian','Capitol Limited'];assert.deepEqual(southBendNames.toSorted((a,b)=>southBend.get(b)[1]-southBend.get(a)[1]),southBendNames,'South Bend north-to-south order');
const pittsburgh=orderedRows.get('PGH');assert(pittsburgh.get('Pennsylvanian')[1]>pittsburgh.get('Floridian')[1],'Pennsylvanian north of Floridian / Silver Star at Pittsburgh');
const la=orderedRows.get('LAX');assert.deepEqual([...la].sort((a,b)=>a[1][0]-b[1][0]).map(([name])=>name),['Coast Starlight','Pacific Surfliner','Southwest Chief','Texas Eagle','Sunset Limited']);
const northern=chicago.displayed.features.filter(f=>[f.properties.from,f.properties.to].sort().join('|')==='CHI|GLN'),sourceNorthern=data.routes.features[northern[0].properties.edgeId].geometry.coordinates.map(screenPoint),dx=sourceNorthern[1][0]-sourceNorthern[0][0],dy=sourceNorthern[1][1]-sourceNorthern[0][1],length=Math.hypot(dx,dy);
const mid=northern.map(f=>{const [a,b]=f.properties.parallelBody.map(screenPoint);return [(a[0]+b[0])/2,(a[1]+b[1])/2];});
for(let i=0;i<mid.length;i++)for(let j=i+1;j<mid.length;j++)assert(Math.abs(-dy*(mid[i][0]-mid[j][0])+dx*(mid[i][1]-mid[j][1]))/length>chicago.style.baseWidth,'Glenview–Chicago strokes remain visibly separated');
console.log('Northeast Regional, Texas Eagle, Los Angeles and west-coast ordering verified; Glenview lines visibly separated.');
