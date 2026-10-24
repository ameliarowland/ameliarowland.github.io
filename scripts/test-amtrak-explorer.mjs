import assert from 'node:assert/strict';import fs from 'node:fs';
import {createTimetable,duration,singleNetwork,createRoutePaths} from '../public/amtrak-direct-route-explorer/model.js';
const trip=(id,route,stops,arrival,departure=arrival,extra={})=>({id,route,stops,arrival,departure,dates:['2026-10-12'],...extra});
const synthetic=createTimetable({trips:[trip('a','Through',['X','A','I','B','Y'],[0,10,30,60,80]),trip('b','Branch',['A','J','C'],[0,20,40]),trip('c','Branch',['C','B'],[60,90]),trip('d','Restricted',['A','K','B'],[0,10,20],undefined,{noPickup:[0]}),trip('e','Overnight',['N','Z'],[1430,1530])]});
assert.equal(synthetic.options('A','B').length,1,'A transfer between same-named services is not direct');assert.equal(synthetic.options('A','B')[0].minutes,50);assert.deepEqual([...synthetic.reachable('A','B')].sort(),['A','B','I']);assert(!synthetic.reachable('A',null).has('K'));assert(synthetic.reachable(null,'B').has('I'));assert.equal(synthetic.options('B','A').length,0);assert.equal(synthetic.options('N','Z')[0].minutes,100);assert.equal(duration(100),'1h 40m');
const load=name=>JSON.parse(fs.readFileSync('public/amtrak-direct-route-explorer/data/'+name)),data=load('timetable.json'),routes=load('routes.geojson'),stations=load('stations.geojson'),model=createTimetable(data);
assert(model.options('DEN','OMA')[0].minutes>0);assert(model.options('BOS','NFK').length>0,'Train-only pairs remain available without flight comparisons');assert(!data.trips.some(t=>/Commuter|MARC|Shore Line East/.test(t.route)));
for(const t of data.trips){assert.equal(t.stops.length,t.arrival.length);assert.equal(t.stops.length,t.departure.length);assert(t.dates.length>0);for(let i=0;i<t.stops.length;i++)assert(t.departure[i]>=t.arrival[i]);}
assert(singleNetwork(routes).features.length<routes.features.length);
const findPath=createRoutePaths(routes);for(const [route,origin,destination]of [['California Zephyr','DEN','OMA'],['Hiawatha Service','CHI','GLN'],['Northeast Regional','NWK','WAS']]){const ids=findPath({route,origin,destination});assert(ids.length>0);assert(ids.every(id=>routes.features[id]));}
const html=fs.readFileSync('src/pages/amtrak-direct-route-explorer/index.astro','utf8');assert(!html.includes('<select'));assert.equal((html.match(/data-mode=/g)||[]).length,0);assert(!html.includes('toggle-airports'));assert(!html.includes('toggle-bars'));
for(const file of ['app.js','model.js'])assert(!/rail-vs-air|airports|flightMinutes|AIRPORT_OVERHEAD/.test(fs.readFileSync('public/amtrak-direct-route-explorer/'+file,'utf8')),'Runtime is independent of the comparison app');
assert(!fs.readFileSync('public/amtrak-direct-route-explorer/app.js','utf8').includes('new Worker'));
assert(!fs.existsSync('public/amtrak-direct-route-explorer/layout-worker.js'));
console.log(`${data.trips.length} train trips; ${stations.features.length} stations; direct-only timing, overnight trips, single network and route paths pass.`);

assert(synthetic.connections('A',null).some(p=>p.route==='Through'&&p.destination==='Y'));assert(!synthetic.connections('A',null).some(p=>p.route==='Restricted'),'No boarding means no outgoing highlight');assert(!synthetic.connections('A',null).some(p=>p.route==='Branch'&&p.destination==='B'),'Same-named connecting trips are not direct highlights');assert(synthetic.connections(null,'B').some(p=>p.route==='Through'&&p.origin==='X'));
