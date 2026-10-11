import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {delta,qualifies,prepareLanes,mergedHighlights} from '../public/rail-vs-air/model.js';
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
