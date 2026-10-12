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
 const id=station.properties.Code,{from,to}=best.properties,[a,b]=best.geometry.coordinates;
 features.splice(features.indexOf(best),1,{...best,properties:{...best.properties,to:id,distanceKm:km(a,p)},geometry:{type:'LineString',coordinates:[a,p]}},{...best,properties:{...best.properties,from:id,distanceKm:km(p,b)},geometry:{type:'LineString',coordinates:[p,b]}});
}
const output={type:'FeatureCollection',schematic:true,features};
fs.writeFileSync('public/rail-vs-air/data/station-schematic.geojson',JSON.stringify(output));
console.log(JSON.stringify({segments:features.length,bytes:JSON.stringify(output).length,passThroughAssociations:anchored.stationAnchorAssociations.length}));
