import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {delta,qualifies,prepareLanes,mergedHighlights,networkHighlights,offsetNetwork} from '../public/rail-vs-air/model.js';
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
  assert(Math.min(...source.map(q=>Math.hypot(p[0]-q[0],p[1]-q[1])))<=42.00001);
 }
}
// Adjacent source sections of the same service must remain connected after a lane change.
const sections={type:'FeatureCollection',features:[
 {type:'Feature',properties:{name:'A',lane:-1},geometry:{type:'LineString',coordinates:[[-.01,0],[0,0]]}},
 {type:'Feature',properties:{name:'A',lane:1},geometry:{type:'LineString',coordinates:[[0,0],[.01,0]]}},
 {type:'Feature',properties:{name:'B',lane:2},geometry:{type:'LineString',coordinates:[[0,0],[0,.01]]}}
]};
const joined=offsetNetwork(sections,12),connectors=joined.features.filter(f=>f.properties.displayJoin);
assert.equal(connectors.length,1);assert.equal(connectors[0].properties.name,'A');
const near=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<1e-10;
assert(near(connectors[0].geometry.coordinates[0],joined.features[0].geometry.coordinates.at(-1)));
assert(near(connectors[0].geometry.coordinates.at(-1),joined.features[1].geometry.coordinates[0]));
const root=new URL('../public/rail-vs-air/data/',import.meta.url);
const load=async name=>JSON.parse(await readFile(new URL(name,root),'utf8'));
const [comparisons,geometry,manifest,evidence,stationData]=await Promise.all(['comparisons.json','shapes.json','manifest.json','gtfs-evidence.json','stations.geojson'].map(load));
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
console.log(`Verified ${comparisons.length} comparisons against retained GTFS evidence, station filters, geometry bounds, threshold boundaries, and opposite-direction offsets.`);
