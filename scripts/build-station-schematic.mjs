import fs from 'node:fs';
import {anchorStationGeometry,continuousRoutePaths,stationRouteName} from '../public/rail-vs-air/model.js';
const load=n=>JSON.parse(fs.readFileSync('public/rail-vs-air/data/'+n,'utf8'));
const routes=load('routes.geojson'),stations=load('stations.geojson');
const names=[...new Set(routes.features.map(f=>stationRouteName(f.properties.symbologyName||f.properties.name)))];
// Consider every station along each physical route, including pass-throughs.
const allStations={...stations,features:stations.features.map(f=>({...f,properties:{...f.properties,routeNames:names}}))};
const anchored=anchorStationGeometry(routes,allStations),key=p=>p.map(v=>v.toFixed(7)).join(',');
const codes=new Map();for(const a of anchored.stationAnchorAssociations)codes.set(a.name+'|'+a.key,a.Code);
const inventory=new Map(stations.features.map(f=>[f.properties.Code,f]));
const neighbors=new Map();
for(const f of anchored.features){const p=f.geometry.coordinates;for(let i=1;i<p.length;i++)for(const [a,b] of [[p[i-1],p[i]],[p[i],p[i-1]]]){const k=key(a);if(!neighbors.has(k))neighbors.set(k,new Set());neighbors.get(k).add(key(b));}}
const features=[],seen=new Set();
const km=(a,b)=>Math.hypot((a[0]-b[0])*Math.cos((a[1]+b[1])*Math.PI/360),a[1]-b[1])*111.32;
for(const f of continuousRoutePaths(anchored).features){
 const name=stationRouteName(f.properties.symbologyName||f.properties.name),p=f.geometry.coordinates,nodes=[];let distance=0;
 for(let i=0;i<p.length;i++){
  if(i)distance+=km(p[i-1],p[i]);
  const k=key(p[i]),code=codes.get(name+'|'+k),junction=(neighbors.get(k)?.size||0)!==2;
  if(!code&&!junction&&i!==0&&i!==p.length-1)continue;
  let station=code;
  // Station approaches can branch just outside the platforms (e.g. PHL).
  // Attach that junction to the station node, preserving the branch topology.
  if(!station&&junction){let best=3;for(const s of stations.features){const d=km(p[i],s.geometry.coordinates);if(d<best){best=d;station=s.properties.Code;}}}
  const id=station||'junction:'+k,coordinate=station?inventory.get(station).geometry.coordinates:p[i];
  if(nodes.at(-1)?.id===id)continue;
  nodes.push({id,coordinate,distance});
 }
 for(let i=1;i<nodes.length;i++){
  const a=nodes[i-1],b=nodes[i],signature=f.properties.name+'|'+[a.id,b.id].sort().join('|');if(seen.has(signature))continue;seen.add(signature);
  features.push({type:'Feature',properties:{name:f.properties.name,symbologyName:name,from:a.id,to:b.id,distanceKm:Math.max(.001,b.distance-a.distance)},geometry:{type:'LineString',coordinates:[a.coordinate,b.coordinate]}});
 }
}
// A few inventory stops lie beyond the source-line projection tolerance.
// They remain mandatory nodes for services whose timetable lists a stop.
for(const station of stations.features)for(const name of station.properties.routeNames||[]){
 if(features.some(f=>f.properties.symbologyName===name&&(f.properties.from===station.properties.Code||f.properties.to===station.properties.Code)))continue;
 let best=null,bestDistance=Infinity;const p=station.geometry.coordinates,cos=Math.cos(p[1]*Math.PI/180);
 for(const f of features){if(f.properties.symbologyName!==name)continue;const [a,b]=f.geometry.coordinates,dx=(b[0]-a[0])*cos,dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*cos*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1))),d=Math.hypot((p[0]-a[0])*cos-t*dx,p[1]-a[1]-t*dy);if(d<bestDistance){bestDistance=d;best=f;}}
 if(!best)throw Error('No source route for scheduled stop '+station.properties.Code+' '+name);
 const id=station.properties.Code,{from,to}=best.properties;
 // Split the whole physical corridor, not just the services that stop here.
 // Airport inventory points in particular can lie beyond the track tolerance.
 const corridor=features.filter(f=>[f.properties.from,f.properties.to].sort().join('|')===[from,to].sort().join('|'));
 for(const f of corridor){const [a,b]=f.geometry.coordinates;
 features.splice(features.indexOf(f),1,{...f,properties:{...f.properties,to:id,distanceKm:km(a,p)},geometry:{type:'LineString',coordinates:[a,p]}},{...f,properties:{...f.properties,from:id,distanceKm:km(p,b)},geometry:{type:'LineString',coordinates:[p,b]}});}
}
// Traverse physical junctions to the next station. They establish connectivity
// but do not become additional vertices in the station schematic.
const stationEdges=[],routeGroups=Map.groupBy(features,f=>f.properties.name);
for(const [name,edges] of routeGroups){
 const graph=new Map();for(const f of edges)for(const [a,b] of [[f.properties.from,f.properties.to],[f.properties.to,f.properties.from]]){if(!graph.has(a))graph.set(a,[]);graph.get(a).push({node:b,cost:f.properties.distanceKm});}
 const seenPairs=new Set();
 for(const start of graph.keys()){
  if(start.startsWith('junction:'))continue;
  const queue=new Set([start]),cost=new Map([[start,0]]),visited=new Set();
  while(queue.size){let a;for(const id of queue)if(a===undefined||cost.get(id)<cost.get(a))a=id;queue.delete(a);if(visited.has(a))continue;visited.add(a);
   if(a!==start&&!a.startsWith('junction:')){
    const pair=[start,a].sort().join('|');if(!seenPairs.has(pair)){seenPairs.add(pair);stationEdges.push({type:'Feature',properties:{name,symbologyName:edges[0].properties.symbologyName,from:start,to:a,distanceKm:cost.get(a)},geometry:{type:'LineString',coordinates:[inventory.get(start).geometry.coordinates,inventory.get(a).geometry.coordinates]}});}continue;
   }
   for(const e of graph.get(a)||[]){const d=cost.get(a)+e.cost;if(d<(cost.get(e.node)??Infinity)){cost.set(e.node,d);queue.add(e.node);}}
  }
 }
}
// Prefer the path through intervening stations over a nearly equivalent source
// bypass. Parallel physical track/junctions can otherwise become triangles.
for(const name of routeGroups.keys()){
 const edges=stationEdges.filter(f=>f.properties.name===name).sort((a,b)=>b.properties.distanceKm-a.properties.distanceKm);
 for(const edge of edges){
  if(!stationEdges.includes(edge))continue;
  const graph=new Map();for(const f of stationEdges){if(f===edge||f.properties.name!==name)continue;for(const [a,b] of [[f.properties.from,f.properties.to],[f.properties.to,f.properties.from]]){if(!graph.has(a))graph.set(a,[]);graph.get(a).push({node:b,cost:f.properties.distanceKm});}}
  const start=edge.properties.from,end=edge.properties.to,queue=new Set([start]),cost=new Map([[start,0]]),limit=edge.properties.distanceKm*1.2;
  while(queue.size){let a;for(const id of queue)if(a===undefined||cost.get(id)<cost.get(a))a=id;queue.delete(a);if(a===end)break;
   for(const e of graph.get(a)||[]){const d=cost.get(a)+e.cost;if(d<=limit&&d<(cost.get(e.node)??Infinity)){cost.set(e.node,d);queue.add(e.node);}}
  }
  if(cost.has(end))stationEdges.splice(stationEdges.indexOf(edge),1);
 }
}
// If a source component ends before a scheduled terminal, connect station
// nodes only when an actual retained GTFS trip establishes their adjacency.
const evidence=load('gtfs-evidence.json'),routeById=new Map(evidence['routes.txt'].map(r=>[r.route_id,r.route_long_name])),tripById=new Map(evidence['trips.txt'].map(t=>[t.trip_id,t])),times=Map.groupBy(evidence['stop_times.txt'],t=>t.trip_id);
for(const [name,sourceEdges] of routeGroups){
 const parents=new Map();const find=id=>{if(!parents.has(id))parents.set(id,id);if(parents.get(id)!==id)parents.set(id,find(parents.get(id)));return parents.get(id);},join=(a,b)=>parents.set(find(a),find(b));
 for(const f of stationEdges.filter(f=>f.properties.name===name))join(f.properties.from,f.properties.to);
 for(const [tripId,stops] of times){
  const trip=tripById.get(tripId);if((routeById.get(trip?.route_id)||'').toLowerCase()!==name.toLowerCase())continue;
  const sequence=[...stops].sort((a,b)=>Number(a.stop_sequence)-Number(b.stop_sequence)).filter(s=>inventory.has(s.stop_id));
  for(let i=1;i<sequence.length;i++){const a=sequence[i-1].stop_id,b=sequence[i].stop_id;if(a===b||find(a)===find(b))continue;
   let from=a,to=b;
   const routeEdges=stationEdges.filter(f=>f.properties.name===name),degree=new Map();for(const f of routeEdges)for(const id of [f.properties.from,f.properties.to])degree.set(id,(degree.get(id)||0)+1);
   // A timetable stop-to-stop link must not bypass the pass-through stations
   // already represented on either side of a source gap.
   if(degree.has(a)&&degree.has(b)){
    const left=[...degree.keys()].filter(id=>find(id)===find(a)),right=[...degree.keys()].filter(id=>find(id)===find(b));
    let best=Infinity;for(const x of left)for(const y of right){const distance=km(inventory.get(x).geometry.coordinates,inventory.get(y).geometry.coordinates);if(distance<best){best=distance;from=x;to=y;}}
   }
   stationEdges.push({type:'Feature',properties:{name,symbologyName:sourceEdges[0].properties.symbologyName,from,to,distanceKm:km(inventory.get(from).geometry.coordinates,inventory.get(to).geometry.coordinates),connectionEvidence:'GTFS trip '+tripId},geometry:{type:'LineString',coordinates:[inventory.get(from).geometry.coordinates,inventory.get(to).geometry.coordinates]}});join(a,b);
  }
 }
}
// Retain inventory terminal nodes even for historical source services with no
// retained GTFS trips. This is a schematic link, not a physical track repair.
for(const station of stations.features)for(const name of station.properties.routeNames||[]){
 if(stationEdges.some(f=>f.properties.symbologyName===name&&[f.properties.from,f.properties.to].includes(station.properties.Code)))continue;
 const candidates=new Set(stationEdges.filter(f=>f.properties.symbologyName===name).flatMap(f=>[f.properties.from,f.properties.to]));
 const other=[...candidates].sort((a,b)=>km(station.geometry.coordinates,inventory.get(a).geometry.coordinates)-km(station.geometry.coordinates,inventory.get(b).geometry.coordinates))[0];
 if(!other)throw Error('No station graph for '+station.properties.Code+' '+name);
 stationEdges.push({type:'Feature',properties:{name,symbologyName:name,from:station.properties.Code,to:other,distanceKm:km(station.geometry.coordinates,inventory.get(other).geometry.coordinates),connectionEvidence:'Source station inventory schematic link'},geometry:{type:'LineString',coordinates:[station.geometry.coordinates,inventory.get(other).geometry.coordinates]}});
}
// Junction contraction can produce a clique between three branch stations.
// Keep the connections used by actual timetable sequences; remove only unused
// cycle edges, so no station or connected component can disappear.
const removedBranchLinks=[];
for(const name of routeGroups.keys()){
 const edges=stationEdges.filter(f=>f.properties.name===name),graph=new Map(),used=new Set();let tripCount=0;
 for(const f of edges)for(const [a,b] of [[f.properties.from,f.properties.to],[f.properties.to,f.properties.from]]){if(!graph.has(a))graph.set(a,[]);graph.get(a).push({node:b,cost:f.properties.distanceKm,edge:f});}
 for(const [tripId,stops] of times){const trip=tripById.get(tripId);if((routeById.get(trip?.route_id)||'').toLowerCase()!==name.toLowerCase())continue;tripCount++;
  const sequence=[...stops].sort((a,b)=>Number(a.stop_sequence)-Number(b.stop_sequence)).filter(s=>inventory.has(s.stop_id));
  for(let i=1;i<sequence.length;i++){
   const start=sequence[i-1].stop_id,end=sequence[i].stop_id,cost=new Map([[start,0]]),prev=new Map(),queue=new Set([start]);
   while(queue.size){let a;for(const id of queue)if(a===undefined||cost.get(id)<cost.get(a))a=id;queue.delete(a);if(a===end)break;for(const e of graph.get(a)||[]){const d=cost.get(a)+e.cost;if(d<(cost.get(e.node)??Infinity)){cost.set(e.node,d);prev.set(e.node,{node:a,edge:e.edge});queue.add(e.node);}}}
   let node=end;while(prev.has(node)){const e=prev.get(node);used.add(e.edge);node=e.node;}
  }
 }
 if(!tripCount)continue;
 for(const edge of edges){if(used.has(edge))continue;const start=edge.properties.from,end=edge.properties.to,visited=new Set(),queue=[start];
  while(queue.length){const id=queue.pop();if(visited.has(id))continue;visited.add(id);for(const e of graph.get(id)||[])if(e.edge!==edge&&stationEdges.includes(e.edge))queue.push(e.node);}
  if(visited.has(end)){stationEdges.splice(stationEdges.indexOf(edge),1);removedBranchLinks.push({name,from:start,to:end});}
 }
}
const sourceStationPasses=[...new Set(anchored.stationAnchorAssociations.map(a=>a.Code+'|'+a.name))];
const output={type:'FeatureCollection',schematic:true,sourceStationPasses,removedBranchLinks,features:stationEdges};
fs.writeFileSync('public/rail-vs-air/data/station-schematic.geojson',JSON.stringify(output));
console.log(JSON.stringify({segments:stationEdges.length,bytes:JSON.stringify(output).length,passThroughAssociations:sourceStationPasses.length,removedBranchLinks}));
