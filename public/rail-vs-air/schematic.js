import {stationRouteName} from './model.js?v=station-schematic-3';
const collection=features=>({type:'FeatureCollection',features});
const north=['Adirondack','Borealis','Empire Service','Ethan Allen Express','Lake Shore Limited','Maple Leaf','Pennsylvanian','Keystone Service','Cardinal'];
const south=['Northeast Regional','Vermonter','Acela'];
const rank=n=>north.includes(n)?north.indexOf(n):south.includes(n)?1000+south.indexOf(n):100;
export function schematicDrawingStyle(zoom){const t=Math.max(0,Math.min(1,(zoom-4)/6));return {baseWidth:1.1+1.4*t,highlightWidth:1.8+1.7*t,hoverWidth:2.9+1.4*t};}
export function createSchematicEngine(routes,stations) {
 const nodes=new Map(),groups=new Map(),graphs=new Map(),pathCache=new Map();
 routes.features.forEach((f,i)=>{
  const name=stationRouteName(f.properties.symbologyName||f.properties.name);f.properties.edgeId=i;
  const {from,to}=f.properties,p=f.geometry.coordinates,k=[from,to].sort().join('|');
  if(!groups.has(k))groups.set(k,new Set());groups.get(k).add(name);
  for(const [id,coordinate,other] of [[from,p[0],to],[to,p[1],from]]){
   if(!nodes.has(id))nodes.set(id,{coordinate,names:new Set(),edges:[]});
   const node=nodes.get(id);node.names.add(name);node.edges.push({other,key:k});
  }
  if(!graphs.has(name))graphs.set(name,new Map());const graph=graphs.get(name);
  for(const [a,b] of [[from,to],[to,from]]){if(!graph.has(a))graph.set(a,[]);graph.get(a).push({node:b,id:i,cost:f.properties.distanceKm});}
 });
 for(const node of nodes.values())node.order=[...node.names].sort((a,b)=>rank(a)-rank(b)||a.localeCompare(b));
 // Station rows use one diagonal screen direction throughout the schematic.
 // Their route order therefore cannot reverse as a corridor bends. A fixed
 // frame also avoids enlarging low-zoom rows into crossed local tangent planes.
 for(const node of nodes.values())node.normal=[Math.SQRT1_2,Math.SQRT1_2];
 function journey(record){
  const name=stationRouteName(record.ntadName||record.route),key=name+'|'+record.origin+'|'+record.destination;
  if(pathCache.has(key))return pathCache.get(key);
  const graph=graphs.get(name),cost=new Map([[record.origin,0]]),prev=new Map(),queue=new Set([record.origin]);
  while(queue.size){let a;for(const id of queue)if(a===undefined||cost.get(id)<cost.get(a))a=id;queue.delete(a);if(a===record.destination)break;
   for(const e of graph?.get(a)||[]){const d=cost.get(a)+e.cost;if(d<(cost.get(e.node)??Infinity)){cost.set(e.node,d);prev.set(e.node,{node:a,id:e.id});queue.add(e.node);}}
  }
  const ids=[];let node=record.destination;while(prev.has(node)){const e=prev.get(node);ids.push(e.id);node=e.node;}
  const result=node===record.origin?ids.reverse():[];pathCache.set(key,result);return result;
 }
 return {journey,render(job){
  const started=performance.now(),world=512*2**job.zoom;
  const project=p=>[(p[0]+180)/360*world,(1-Math.log(Math.tan(Math.PI/4+p[1]*Math.PI/360))/Math.PI)/2*world];
  const unproject=p=>[p[0]/world*360-180,Math.atan(Math.sinh(Math.PI*(1-2*p[1]/world)))*180/Math.PI];
  const spacing=Math.min(13,6+Math.max(0,job.zoom-4)*.65),positions=new Map();
  for(const [id,node] of nodes){
   const p=project(node.coordinate);
   node.order.forEach((name,i)=>{const offset=(i-(node.order.length-1)/2)*spacing;positions.set(id+'|'+name,unproject([p[0]+node.normal[0]*offset,p[1]+node.normal[1]*offset]));});
  }
  const displayed=collection(routes.features.map(f=>{const name=stationRouteName(f.properties.symbologyName||f.properties.name);return {...f,properties:{...f.properties,stationPositions:[f.properties.from,f.properties.to].filter(id=>!id.startsWith('junction:')).map(Code=>({Code,name,coordinates:positions.get(Code+'|'+name)}))},geometry:{type:'LineString',coordinates:[positions.get(f.properties.from+'|'+name),positions.get(f.properties.to+'|'+name)]}};}));
  displayed.connectivityAudit={brokenJunctions:[]};
  const colors=new Map(routes.features.map(f=>[stationRouteName(f.properties.symbologyName||f.properties.name),f.properties.color]));
  const dots=collection(stations.features.flatMap(s=>(s.properties.routeNames||[]).map(name=>({type:'Feature',properties:{...s.properties,symbolRoutes:[name],stopStatus:'stop',color:colors.get(name)||'#fff',radius:Math.min(5,1.6+Math.max(0,job.zoom-4)*.3,spacing/2-1),ringWidth:Math.min(1.2,.8+Math.max(0,job.zoom-4)*.05)},geometry:{type:'Point',coordinates:positions.get(s.properties.Code+'|'+name)||s.geometry.coordinates}}))));
  const ids=new Set((job.records||[]).flatMap(journey)),qualifying=collection(displayed.features.filter(f=>ids.has(f.properties.edgeId)));
  return {id:job.id,key:'schematic|'+job.zoom,zoom:job.zoom,style:{spacing,...schematicDrawingStyle(job.zoom)},displayed,dots,qualifying,layoutMilliseconds:Math.round(performance.now()-started)};
 }};
}
