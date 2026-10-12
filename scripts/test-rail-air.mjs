import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {delta,qualifies,prepareLanes,mergedHighlights,networkHighlights,offsetNetwork,alignLaneFrames,routeDrawingStyle,continuousRoutePaths,stationSymbols,simplifyDisplayGeometry,anchorStationGeometry} from '../public/rail-vs-air/model.js';
assert.equal(delta({railMinutes:240,flightMinutes:60}),0);
assert(qualifies({railMinutes:300,flightMinutes:60},60));
assert(!qualifies({railMinutes:301,flightMinutes:60},60));
assert(qualifies({railMinutes:120,flightMinutes:60},0));
// Opposite source directions must occupy different physical sides of the track.
const shapes={forward:[[0,0],[1,0],[2,0]],reverse:[[2,0],[1,0],[0,0]]};
const records=[{shapeId:'forward',route:'A',shapeRange:[0,2]},{shapeId:'reverse',route:'B',shapeRange:[0,2]}];
const lanes=prepareLanes(records,shapes);
assert.deepEqual(lanes.get('forward|A'),[-.5,-.5]);
assert.deepEqual(lanes.get('reverse|B'),[-.5,-.5]); // reversed vector = opposite physical offset
assert.equal(mergedHighlights(records,shapes,()=> '#000',lanes).features.length,2);
// Heading reversals around a bend must not swap the sides of a shared track.
const bend=[[0,0],[2,1],[1,2],[-1,3]],bendShapes={a:bend,b:[...bend].reverse()};
const bent=prepareLanes([{shapeId:'a',route:'A'},{shapeId:'b',route:'B'}],bendShapes);
for(const values of bent.values())assert(values.every(v=>v===values[0]));
// Highlight lanes must follow the base network even if their own membership differs.
const reference={type:'FeatureCollection',features:[{type:'Feature',properties:{name:'A',lane:1.5},geometry:{type:'LineString',coordinates:bend}}]};
const aligned=prepareLanes([{shapeId:'a',route:'A'}],bendShapes,reference);
assert.deepEqual(aligned.get('a|A'),[1.5,1.5,1.5]);
// Qualifying strokes must reuse exact base-network vertices and lane offsets.
const canonical={type:'FeatureCollection',features:[{type:'Feature',properties:{name:'A',lane:-1.5},geometry:{type:'LineString',coordinates:[[0,0],[.001,.001],[.002,.001]]}}]};
const overlay=networkHighlights([{route:'A',ntadName:'A',shapeId:'x',shapeRange:[0,2]}],{x:[[0,.0001],[.001,.0011],[.002,.0011]]},canonical,()=> '#fff');
assert.equal(overlay.features.length,1);
assert.deepEqual(overlay.features[0].geometry.coordinates,canonical.features[0].geometry.coordinates);
assert.equal(overlay.features[0].properties.lane,-1.5);
// A near-reversal formerly produced huge shader offset spikes. Every bevel
// point must remain within twice the intended pixel offset of the source vertex.
const hairpin={type:'FeatureCollection',features:[{type:'Feature',properties:{name:'test',lane:3},geometry:{type:'LineString',coordinates:[[-77,39],[-76.999,39],[-77,39.000001],[-76.999,39.000002]]}}]};
for(const zoom of [4,8,12,16]) {
 const shifted=offsetNetwork(hairpin,zoom).features[0].geometry.coordinates;
 const world=512*2**zoom,project=p=>[(p[0]+180)/360*world,(1-Math.log(Math.tan(Math.PI/4+p[1]*Math.PI/360))/Math.PI)/2*world];
 const source=hairpin.features[0].geometry.coordinates.map(project);
 for(const p of shifted.map(project)) {
  assert(p.every(Number.isFinite));
  const distances=source.slice(1).map((b,i)=>{
   const a=source[i],dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
   const t=den?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)):0;
   return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
  });
  assert(Math.min(...distances)<=2*3*routeDrawingStyle(hairpin,zoom).spacing+1); // bounded offset plus subpixel generalization
 }
}
// Adjacent source sections of the same service must remain connected after a lane change.
const sections={type:'FeatureCollection',features:[
 {type:'Feature',properties:{name:'A',lane:-1},geometry:{type:'LineString',coordinates:[[-.01,0],[0,0]]}},
 {type:'Feature',properties:{name:'A',lane:1},geometry:{type:'LineString',coordinates:[[0,0],[.01,0]]}},
 {type:'Feature',properties:{name:'B',lane:2},geometry:{type:'LineString',coordinates:[[0,0],[0,.01]]}}
]};
const joined=offsetNetwork(sections,12);
assert.equal(joined.features.length,2); // one continuous A path, separate B branch
assert(joined.features.every(f=>!f.properties.displayJoin));
const continuous=continuousRoutePaths(sections);
const aPath=continuous.features.find(f=>f.properties.name==='A');
assert.deepEqual(aPath.geometry.coordinates,[[-.01,0],[0,0],[.01,0]]);
assert.deepEqual(aPath.properties.edgeLanes,[-1,1]);
// Reversed stored sections must retain the same physical lane ordering.
const reversedFrames={type:'FeatureCollection',features:[
 {type:'Feature',properties:{name:'A',lane:-1},geometry:{type:'LineString',coordinates:[[-.01,0],[0,0]]}},
 {type:'Feature',properties:{name:'A',lane:-1},geometry:{type:'LineString',coordinates:[[.01,0],[0,0]]}}
]};
const alignedFrames=alignLaneFrames(reversedFrames);
assert.equal(alignedFrames.features[0].properties.lane,-alignedFrames.features[1].properties.lane);
const style=routeDrawingStyle(alignedFrames,12);assert(style.baseWidth<style.spacing);assert(style.highlightWidth<style.spacing);
// A branch must not impose contradictory all-pairs lane-direction constraints.
const branchFrames={type:'FeatureCollection',features:[
 {type:'Feature',properties:{name:'A',lane:.5},geometry:{type:'LineString',coordinates:[[0,0],[1,0]]}},
 {type:'Feature',properties:{name:'A',lane:.5},geometry:{type:'LineString',coordinates:[[1,0],[2,0]]}},
 {type:'Feature',properties:{name:'A',lane:.5},geometry:{type:'LineString',coordinates:[[1,0],[1,1]]}}
]};
assert(alignLaneFrames(branchFrames).features.every(f=>f.properties.lane===.5));
// Each stopping lane receives its own circle; known passing lanes get a
// perpendicular no-stop tick, never a stop circle or a shared station bar.
const stationFixture={type:'FeatureCollection',features:[
 {type:'Feature',properties:{Code:'MULTI',routeNames:['A','B']},geometry:{type:'Point',coordinates:[0,0]}},
 {type:'Feature',properties:{Code:'SINGLE',routeNames:['A']},geometry:{type:'Point',coordinates:[.005,0]}}
]};
const stationTracks={type:'FeatureCollection',features:['A','B'].map((name,i)=>({type:'Feature',properties:{name,lane:i-.5},geometry:{type:'LineString',coordinates:[[-.01,0],[.01,0]]}}))};
for(const zoom of [4,10,15]) {
 const style=routeDrawingStyle(stationTracks,zoom),display=offsetNetwork(stationTracks,zoom,style);
 const symbols=stationSymbols(stationFixture,stationTracks,display,zoom,style);
 assert.equal(symbols.dots.features.length,3);
 assert.equal(symbols.dots.features.filter(f=>f.properties.Code==='MULTI').length,2);
 assert.equal(symbols.passes.features.length,1);
 assert.equal(symbols.passes.features[0].properties.Code,'SINGLE');
 assert.deepEqual(symbols.passes.features[0].properties.symbolRoutes,['B']);
 const [a,b]=symbols.passes.features[0].geometry.coordinates;
 assert(Math.abs(a[0]-b[0])<1e-10); // tick perpendicular to east–west track
 for(const f of symbols.dots.features)assert(f.properties.radius>0&&f.properties.ringWidth>0);
}
const interleaved={type:'FeatureCollection',features:['A','B','C'].map((name,i)=>({type:'Feature',properties:{name,lane:i-1},geometry:{type:'LineString',coordinates:[[-.01,0],[.01,0]]}}))};
const stopsOnly={type:'FeatureCollection',features:[
 {type:'Feature',properties:{Code:'SPLIT',routeNames:['A','C']},geometry:{type:'Point',coordinates:[0,0]}},
 {type:'Feature',properties:{Code:'NONE',routeNames:[]},geometry:{type:'Point',coordinates:[.005,0]}}
]};
const splitStyle=routeDrawingStyle(interleaved,12),split=stationSymbols(stopsOnly,interleaved,offsetNetwork(interleaved,12,splitStyle),12,splitStyle,new Set(['A','B','C']));
assert.equal(split.dots.features.length,2);
assert.deepEqual(split.dots.features.flatMap(f=>f.properties.symbolRoutes).sort(),['A','C']);
assert.deepEqual(split.passes.features.filter(f=>f.properties.Code==='SPLIT').flatMap(f=>f.properties.symbolRoutes),['B']);
assert.equal(split.passes.features.filter(f=>f.properties.Code==='NONE').length,3);
const root=new URL('../public/rail-vs-air/data/',import.meta.url);
const load=async name=>JSON.parse(await readFile(new URL(name,root),'utf8'));
const [comparisons,geometry,manifest,evidence,stationData]=await Promise.all(['comparisons.json','shapes.json','manifest.json','gtfs-evidence.json','stations.geojson'].map(load));
// Regression for the reported Coatesville–Downingtown color switching.
const actualNetwork=alignLaneFrames(await load('routes.geojson'));
for(const [name,expected] of [['Pennsylvanian',-.5],['Keystone Service',.5]]) {
 const corridor=actualNetwork.features.filter(f=>f.properties.name===name&&f.geometry.coordinates.some(p=>p[0]>-75.85&&p[0]<-75.65&&p[1]>39.98&&p[1]<40.06));
 assert(corridor.length>=1);
 assert(corridor.every(f=>f.properties.lane===expected),`${name} changed sides on the Pennsylvania corridor`);
}
// Every shared Pennsylvanian edge must retain the northernmost physical lane.
const sharedLanes=new Map();
for(const f of actualNetwork.features) {
 const points=f.geometry.coordinates;
 for(let i=1;i<points.length;i++) {
  const a=points[i-1],b=points[i],keys=[a.join(','),b.join(',')].sort(),key=keys.join('|');
  if(!sharedLanes.has(key))sharedLanes.set(key,[]);
  sharedLanes.get(key).push({name:f.properties.name,lane:f.properties.lane*(b[0]>=a[0]?1:-1)});
 }
}
let priorityEdges=0;
for(const lanes of sharedLanes.values()) {
 const penn=lanes.find(f=>f.name==='Pennsylvanian');
 if(!penn||lanes.length<2)continue;
 priorityEdges++;
 assert(lanes.every(f=>f.lane>=penn.lane),'Pennsylvanian is south of another shared route');
}
assert(priorityEdges>200);
assert.equal(new Set(actualNetwork.features.map(f=>f.properties.name)).size,manifest.routeCount);
// All eleven routes continue across North Philadelphia, including the source
// Crescent gap drawn along the retained shared NEC track.
const phnA=[-75.1585532,39.995913],phnB=[-75.1575273,39.9962988];
for(const name of ['Pennsylvanian','Acela','Cardinal','Carolinian','Crescent','Keystone Service','Northeast Regional','Palmetto','Silver Meteor','Silver Star','Vermonter']) {
 const through=continuousRoutePaths(actualNetwork).features.find(f=>f.properties.name===name&&f.geometry.coordinates.some(p=>p[0]===phnA[0]&&p[1]===phnA[1])&&f.geometry.coordinates.some(p=>p[0]===phnB[0]&&p[1]===phnB[1]));
 assert(through,`${name} is disconnected at North Philadelphia`);
 assert(![through.geometry.coordinates[0],through.geometry.coordinates.at(-1)].some(p=>[phnA,phnB].some(q=>p[0]===q[0]&&p[1]===q[1])),`${name} ends at the connection`);
}
// The NEC must not reverse its lane frame through 30th Street Station.
for(const name of ['Acela','Cardinal','Carolinian','Crescent','Northeast Regional','Palmetto','Silver Meteor','Silver Star','Vermonter']) {
 const lanes=[];
 for(const f of continuousRoutePaths(actualNetwork).features.filter(f=>f.properties.name===name)) {
  const p=f.geometry.coordinates;
  for(let i=1;i<p.length;i++)if(p[i][0]>-75.2&&p[i][0]<-75.175&&p[i][1]>39.949&&p[i][1]<39.968)lanes.push(f.properties.edgeLanes[i-1]);
 }
 assert(lanes.length>=3,`${name} station approach is missing`);
 assert(lanes.every(l=>l===0||Math.sign(l)===Math.sign(lanes.find(x=>x!==0))),`${name} reverses order at Philadelphia`);
}
// Newark had three duplicate offset fragments for many of the same services.
const newark=actualNetwork.features.filter(f=>f.geometry.coordinates.some(p=>p[0]>-74.22&&p[0]<-74.1&&p[1]>40.70&&p[1]<40.8));
assert.equal(newark.length,11);
assert.equal(new Set(newark.map(f=>f.properties.name)).size,11);

// Source inventories are retained while Floridian / Silver Star share lanes.
assert(actualNetwork.features.some(f=>f.properties.name==='Silver Star'));
assert(actualNetwork.features.some(f=>f.properties.name==='Capitol Limited'));
const groupedEdges=new Map();
for(const f of actualNetwork.features.filter(f=>['Floridian','Silver Star'].includes(f.properties.name))) {
 const p=f.geometry.coordinates;
 for(let i=1;i<p.length;i++) {
  const a=p[i-1].join(','),b=p[i].join(','),key=a<b?a+'|'+b:b+'|'+a,lane=f.properties.lane*(a<b?1:-1);
  if(!groupedEdges.has(key))groupedEdges.set(key,[]);groupedEdges.get(key).push({name:f.properties.name,lane});
 }
}
const sharedGroupEdges=[...groupedEdges.values()].filter(e=>new Set(e.map(v=>v.name)).size===2);
assert(sharedGroupEdges.length>10);
for(const entries of sharedGroupEdges)assert(entries.every(e=>e.lane===entries[0].lane));
assert(routeDrawingStyle(actualNetwork,16).spacing>routeDrawingStyle(actualNetwork,12).spacing);
// Subpixel overview simplification retains common vertices for every service
// and leaves the detailed display untouched at closer zooms.
const wiggle=[[-.01,0],[-.005,.0001],[0,-.0001],[.005,.0001],[.01,0]];
const sharedWiggle={type:'FeatureCollection',features:['A','B'].map(name=>({type:'Feature',properties:{name,lane:0},geometry:{type:'LineString',coordinates:wiggle}}))};
const overview=simplifyDisplayGeometry(sharedWiggle,6);
assert.equal(overview.features[0].geometry.coordinates.length,2);
assert.deepEqual(overview.features[0].geometry.coordinates,overview.features[1].geometry.coordinates);
assert.equal(simplifyDisplayGeometry(sharedWiggle,13),sharedWiggle);
assert.equal(simplifyDisplayGeometry(actualNetwork,13),actualNetwork);
// Country-level generalization must preserve station anchors, including a
// station projected between two original source vertices on a shared edge.
const anchorTracks={type:'FeatureCollection',features:['A','B'].map(name=>({type:'Feature',properties:{name,lane:0},geometry:{type:'LineString',coordinates:[[-1,0],[1,0]]}}))};
const anchorStops={type:'FeatureCollection',features:[{type:'Feature',properties:{Code:'ANCHOR',routeNames:['A','B']},geometry:{type:'Point',coordinates:[.2,0]}}]};
const anchored=anchorStationGeometry(anchorTracks,anchorStops),country=simplifyDisplayGeometry(anchored,4);
for(const f of country.features)assert(f.geometry.coordinates.some(p=>p[0]===.2&&p[1]===0));
assert.deepEqual(country.features[0].geometry.coordinates,country.features[1].geometry.coordinates);

const stopsByTrip=new Map();
for(const stop of evidence['stop_times.txt']){if(!stopsByTrip.has(stop.trip_id))stopsByTrip.set(stop.trip_id,new Map());stopsByTrip.get(stop.trip_id).set(stop.stop_id,stop);}
const parse=t=>{const [h,m,s]=t.split(':').map(Number);return h*60+m+s/60;};
for(const r of comparisons){
 const source=stopsByTrip.get(r.tripId);
 assert(source,`Missing evidence for trip ${r.tripId}`);
 assert.equal(r.railMinutes,parse(source.get(r.destination).arrival_time)-parse(source.get(r.origin).departure_time));
 assert.notEqual(source.get(r.origin).pickup_type,'1');assert.notEqual(source.get(r.destination).drop_off_type,'1');
 assert(r.flightMinutes>0 && r.flightSamples>0);
 assert(r.airportDistanceKm.every(d=>d<=manifest.airportRadiusKm));assert.notEqual(r.airports[0],r.airports[1]);
 assert(r.serviceDates.length && r.serviceDates.every(d=>d>=manifest.railStart&&d<=manifest.railEnd));
 if(r.shapeRange){const [a,b]=r.shapeRange;assert(a>=0&&b>a&&b<geometry[r.shapeId].length);}
}
for(const f of stationData.features){assert.equal(f.properties.StnType,'TRAIN');assert.notEqual(f.properties.StaType,'Curbside Bus Stop only (no shelter)');}
assert.equal(comparisons.length,manifest.matchedPairs);
assert.equal(comparisons.filter(r=>!r.shapeRange).length,manifest.geometryMissing);
assert.equal(stationData.features.length,manifest.stationCount);
assert(stationData.features.every(f=>Array.isArray(f.properties.routeNames)&&new Set(f.properties.routeNames).size===f.properties.routeNames.length));
const actualStyle=routeDrawingStyle(actualNetwork,12);
const actualSymbols=stationSymbols(stationData,actualNetwork,offsetNetwork(actualNetwork,12,actualStyle),12,actualStyle);
for(const code of ['PHL','NYP','RVR'])assert(actualSymbols.dots.features.some(f=>f.properties.Code===code));
assert(actualSymbols.dots.features.some(f=>f.properties.Code==='DOW'));
for(const f of actualSymbols.dots.features) {
 assert(f.properties.symbolRoutes.length);
 assert(f.properties.symbolRoutes.every(name=>f.properties.routeNames.includes(name)),`${f.properties.Code}: marker on a passing route`);
}
// Required behavior: every scheduled station/service pair remains visible at
// every zoom. No marker thinning, clustering, or overview aggregation.
const expectedStops=new Set(stationData.features.flatMap(f=>f.properties.routeNames.map(name=>f.properties.Code+'|'+name)));
for(const zoom of [3,4,6,7.9,10,13,16]) {
 const style=routeDrawingStyle(actualNetwork,zoom),symbols=stationSymbols(stationData,actualNetwork,offsetNetwork(actualNetwork,zoom,style,stationData),zoom,style);
 const shown=symbols.dots.features.map(f=>f.properties.Code+'|'+f.properties.symbolRoutes[0]);
 assert.equal(shown.length,expectedStops.size);
 assert.deepEqual(new Set(shown),expectedStops,`Scheduled station markers omitted at zoom ${zoom}`);
 assert(symbols.dots.features.every(f=>f.properties.radius>=2));
}
assert.equal(manifest.routeColors['Silver Star'],manifest.routeColors.Floridian);
for(const name of new Set(actualNetwork.features.map(f=>f.properties.name)))assert(/^#[0-9a-f]{6}$/.test(manifest.routeColors[name]));
const lancaster=stationData.features.find(f=>f.properties.Code==='LNC');
assert.deepEqual(lancaster.properties.routeNames,['Keystone Service','Pennsylvanian']);
for(const zoom of [6,7,8,10,12,15]) {
 const style=routeDrawingStyle(actualNetwork,zoom),symbols=stationSymbols({type:'FeatureCollection',features:[lancaster]},actualNetwork,offsetNetwork(actualNetwork,zoom,style),zoom,style);
 assert.deepEqual(symbols.dots.features.filter(f=>f.properties.Code==='LNC').flatMap(f=>f.properties.symbolRoutes).sort(),['Keystone Service','Pennsylvanian']);
}
const aberdeen=stationData.features.find(f=>f.properties.Code==='ABE');
assert.deepEqual(aberdeen.properties.routeNames,['Northeast Regional']);
const aberdeenSymbols=stationSymbols({type:'FeatureCollection',features:[aberdeen]},actualNetwork,offsetNetwork(actualNetwork,12,actualStyle),12,actualStyle);

assert.equal(aberdeenSymbols.dots.features.length,1);
assert.deepEqual(aberdeenSymbols.dots.features[0].properties.symbolRoutes,['Northeast Regional']);
const actualKnown=new Set(stationData.features.flatMap(f=>f.properties.routeNames));
for(const f of actualSymbols.passes.features) {
 assert(f.properties.symbolRoutes.every(name=>actualKnown.has(name)&&!f.properties.routeNames.includes(name)));
}

// Miami's terminal branches are not all in the 75m through-track corridor.
// Both actual stopping services must remain marked; the NTAD-only Silver Star
// must not receive a station marker from the retained timetable.
const miami=stationData.features.find(f=>f.properties.Code==='MIA');
assert.deepEqual(miami.properties.routeNames,['Floridian','Silver Meteor']);
for(const zoom of [5,7,10,12,15]) {
 const style=routeDrawingStyle(actualNetwork,zoom),symbols=stationSymbols({type:'FeatureCollection',features:[miami]},actualNetwork,offsetNetwork(actualNetwork,zoom,style),zoom,style);
 const marked=new Set(symbols.dots.features.flatMap(f=>f.properties.symbolRoutes));
 assert.deepEqual([...marked].sort(),['Floridian','Silver Meteor'],`Miami missing a stopping route at zoom ${zoom}`);
}
// Curved displayed lanes may cross the station's perpendicular at a different
// heading than the source tangent; they must still contribute to the bar.
for(const zoom of [6,7,7.5,8,10,12]) {
 const style=routeDrawingStyle(actualNetwork,zoom);
 const station=stationData.features.find(f=>f.properties.Code==='WIL');
 const symbols=stationSymbols({type:'FeatureCollection',features:[station]},actualNetwork,offsetNetwork(actualNetwork,zoom,style),zoom,style);
 assert(symbols.dots.features.some(f=>f.properties.Code==='WIL'&&f.properties.symbolRoutes.includes('Silver Meteor')),`Wilmington stopping route missing at zoom ${zoom}`);
}


console.log(`Verified ${comparisons.length} comparisons against retained GTFS evidence, station filters, geometry bounds, threshold boundaries, and opposite-direction offsets.`);
