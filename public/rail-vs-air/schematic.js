import {parallelCorridors} from './parallel-corridors.js?v=station-schematic-21';
import {stationRouteName} from './model.js?v=station-schematic-21';
const collection=features=>({type:'FeatureCollection',features});
const north=['Adirondack','Borealis','Empire Service','Ethan Allen Express','Lake Shore Limited','Maple Leaf','Pennsylvanian','Keystone Service','Cardinal'];
const south=['Acela','Vermonter','Northeast Regional'];
export const chicagoUnionOrder=['Borealis','Empire Builder','Hiawatha Service','California Zephyr','Southwest Chief','Carl Sandburg','Illinois Zephyr','Lincoln Service','Lincoln Service Missouri River Runner','Texas Eagle','City Of New Orleans','Illini','Saluki','Cardinal','Capitol Limited','Floridian','Lake Shore Limited','Wolverine','Blue Water','Pere Marquette'];
const rank=n=>north.includes(n)?north.indexOf(n):south.includes(n)?1000+south.indexOf(n):100;
export function schematicDrawingStyle(zoom){const t=Math.max(0,Math.min(1,(zoom-4)/6)),baseWidth=3.2+3.8*t;return {baseWidth,highlightWidth:baseWidth,hoverWidth:baseWidth+1.5,laneSpacing:baseWidth+.7};}
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
 // Carry Chicago's pairwise order along shared station segments until the
 // routes split, keeping incoming lanes consistent without changing distant
 // corridors where the same services approach from separate directions.
 const preferences=new Map();
 function carryOrder(order,seeds){
 for(let i=0;i<order.length;i++)for(let j=i+1;j<order.length;j++){
  const a=order[i],b=order[j],shared=new Map();
  for(const [key,names] of groups){if(!names.has(a)||!names.has(b))continue;const [u,v]=key.split('|');for(const [from,to] of [[u,v],[v,u]]){if(!shared.has(from))shared.set(from,new Set());shared.get(from).add(to);}}
  const queue=[...seeds],visited=new Set();while(queue.length){const id=queue.pop();if(visited.has(id))continue;visited.add(id);
   if(nodes.get(id)?.names.has(a)&&nodes.get(id)?.names.has(b)){if(!preferences.has(id))preferences.set(id,[]);preferences.get(id).push([a,b]);}
   for(const other of shared.get(id)||[])queue.push(other);
  }
 }
 }
 carryOrder(chicagoUnionOrder,['CHI']);
 const losAngelesOrder=['Pacific Surfliner','Southwest Chief','Texas Eagle','Sunset Limited','Coast Starlight'];
 carryOrder(losAngelesOrder,['LAX']);
 carryOrder(['Floridian','Piedmont','Carolinian','Crescent'],['CLT','GRO','RGH']);
 const defaultOrder=(a,b)=>rank(b)-rank(a)||b.localeCompare(a);
 for(const [id,node] of nodes){
  const incoming=new Map([...node.names].map(n=>[n,0])),outgoing=new Map([...node.names].map(n=>[n,new Set()]));
  for(const [a,b] of preferences.get(id)||[]){if(outgoing.get(a).has(b))continue;outgoing.get(a).add(b);incoming.set(b,incoming.get(b)+1);}
  const available=[...node.names].filter(n=>incoming.get(n)===0),order=[];
  while(available.length){available.sort(defaultOrder);const name=available.shift();order.push(name);for(const next of outgoing.get(name)){incoming.set(next,incoming.get(next)-1);if(incoming.get(next)===0)available.push(next);}}
  node.order=order;
 }

 // The first two station steps from Union Station retain the complete local
 // Chicago order, including services that branch toward different next stops.
 const chicagoSteps=new Map([['CHI',0]]),stationLinks=new Map();
 for(const key of groups.keys()){const [a,b]=key.split('|');for(const [from,to] of [[a,b],[b,a]]){if(!stationLinks.has(from))stationLinks.set(from,new Set());stationLinks.get(from).add(to);}}
 const chicagoQueue=['CHI'];while(chicagoQueue.length){const id=chicagoQueue.shift(),step=chicagoSteps.get(id);if(step>=2)continue;for(const other of stationLinks.get(id)||[]){if(chicagoSteps.has(other))continue;chicagoSteps.set(other,step+1);chicagoQueue.push(other);}}
 for(const id of chicagoSteps.keys()){const node=nodes.get(id);if(!node)continue;node.order=[...node.names].sort((a,b)=>{const ai=chicagoUnionOrder.indexOf(a),bi=chicagoUnionOrder.indexOf(b);return (ai<0?100:ai)-(bi<0?100:bi)||defaultOrder(a,b);});}

 // Align a station row across the dominant local bundle, rather than giving
 // east/west tracks a diagonal row that staggers their stop circles.
 const frameProject=p=>[(p[0]+180)/360,(1-Math.log(Math.tan(Math.PI/4+p[1]*Math.PI/360))/Math.PI)/2];
 for(const [id,node] of nodes){
  const p=frameProject(node.coordinate);let xx=0,xy=0,yy=0;const seen=new Set();
  for(const edge of node.edges){if(seen.has(edge.key))continue;seen.add(edge.key);const q=frameProject(nodes.get(edge.other).coordinate),dx=q[0]-p[0],dy=q[1]-p[1],length=Math.hypot(dx,dy);if(!length)continue;const weight=groups.get(edge.key).size**2;xx+=weight*dx*dx/(length*length);xy+=weight*dx*dy/(length*length);yy+=weight*dy*dy/(length*length);}
  const angle=.5*Math.atan2(2*xy,xx-yy);let normal=[-Math.sin(angle),Math.cos(angle)];if(normal[1]>0||(Math.abs(normal[1])<1e-8&&normal[0]<0))normal=normal.map(v=>-v);
  node.normal=chicagoSteps.has(id)?[Math.SQRT1_2,-Math.SQRT1_2]:normal;
 }
 // Union Station's northwest-to-southeast row matches its separate northern,
 // western and southern arrivals. Carry that frame along shared west-side
 // approaches; keep the eastern Hammond-Whiting family in its existing frame.
 const chicagoWestRows=new Set(['CHI']),westOrder=chicagoUnionOrder.slice(0,chicagoUnionOrder.indexOf('Cardinal'));
 for(let i=0;i<westOrder.length;i++)for(let j=i+1;j<westOrder.length;j++){
  const links=new Map();for(const [key,names] of groups){if(!names.has(westOrder[i])||!names.has(westOrder[j]))continue;const [a,b]=key.split('|');for(const [from,to] of [[a,b],[b,a]]){if(!links.has(from))links.set(from,new Set());links.get(from).add(to);}}
  const queue=['CHI'],seen=new Set();while(queue.length){const id=queue.pop();if(seen.has(id))continue;seen.add(id);chicagoWestRows.add(id);for(const other of links.get(id)||[])queue.push(other);}
 }
 for(const id of chicagoWestRows)if(nodes.has(id))nodes.get(id).normal=[Math.SQRT1_2,Math.SQRT1_2];
 // Row directions are resolved once from track topology, not from zoom.
 const fixedNormal=[Math.SQRT1_2,-Math.SQRT1_2],fixedRows=new Set(chicagoWestRows);
 for(let iteration=0;iteration<=nodes.size;iteration++){
  const bad=new Map();for(const [key,names] of groups){
   if(names.size<2)continue;
   const [from,to]=key.split('|'),a=nodes.get(from),b=nodes.get(to),p=frameProject(a.coordinate),q=frameProject(b.coordinate),dx=q[0]-p[0],dy=q[1]-p[1];
   const left=-dy*a.normal[0]+dx*a.normal[1],right=-dy*b.normal[0]+dx*b.normal[1];
   if(left*right<0){
    if(chicagoWestRows.has(from)||chicagoWestRows.has(to)){for(const id of [from,to])if(!chicagoWestRows.has(id))bad.set(id,true);}
    else{if(!fixedRows.has(from)&&!bad.has(from))bad.set(from,false);if(!fixedRows.has(to)&&!bad.has(to))bad.set(to,false);}
   }
  }
  if(!bad.size)break;for(const [id,west] of bad){fixedRows.add(id);if(west)chicagoWestRows.add(id);nodes.get(id).normal=west?[Math.SQRT1_2,Math.SQRT1_2]:fixedNormal;}
 }
 // Keep the northern Chicago approach visibly separated. Its previous
 // diagonal row ran almost along the corridor instead of across it.
 if(nodes.has('GLN')&&nodes.has('CHI')){
  const a=frameProject(nodes.get('GLN').coordinate),b=frameProject(nodes.get('CHI').coordinate),dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
  nodes.get('GLN').normal=[dy/length,-dx/length];
 }
 // Northeast Regional occupies the south/east edge at every shared stop.
 for(const node of nodes.values())if(node.names.has('Northeast Regional')){
  node.normal=[Math.SQRT1_2,Math.SQRT1_2];
  node.order=node.order.filter(name=>name!=='Northeast Regional').reverse();node.order.push('Northeast Regional');
 }
 for(const node of nodes.values())if(node.names.has('Texas Eagle')&&node.names.has('Sunset Limited')){
  node.normal=[Math.SQRT1_2,Math.SQRT1_2];const texas=node.order.indexOf('Texas Eagle'),sunset=node.order.indexOf('Sunset Limited');if(texas>sunset){node.order[texas]='Sunset Limited';node.order[sunset]='Texas Eagle';}
 }
 if(nodes.has('LAX')){const node=nodes.get('LAX');node.normal=[Math.SQRT1_2,Math.SQRT1_2];node.order=[...node.names].sort((a,b)=>losAngelesOrder.indexOf(a)-losAngelesOrder.indexOf(b));}
 for(const id of ['ARD','YNY'])if(nodes.has(id)){const node=nodes.get(id);if(node.normal[1]<0)node.order.reverse();node.normal=[Math.SQRT1_2,Math.SQRT1_2];}
 if(nodes.has('FUL'))nodes.get('FUL').normal=[Math.SQRT1_2,Math.SQRT1_2];
 // Preserve north/south ordering while giving ordinary rows a common frame.
 for(const [id,node] of nodes){if(['CHI','GLN','HMI','NBU','SOB'].includes(id))continue;if(node.normal[1]<0)node.order.reverse();node.normal=[Math.SQRT1_2,Math.SQRT1_2];}
 for(const node of nodes.values())if(node.coordinate[0]<-116&&['Coast Starlight','Amtrak Cascades','Empire Builder'].some(name=>node.names.has(name))){
  const west=['Coast Starlight','Amtrak Cascades','Empire Builder'];node.order=[...west.filter(name=>node.names.has(name)),...node.order.filter(name=>!west.includes(name))];
 }
 for(const id of ['POS','ONA'])if(nodes.has(id))nodes.get(id).normal=[0,1];
 for(const node of nodes.values()){
  const family=['Lincoln Service','Lincoln Service Missouri River Runner','Texas Eagle','Missouri River Runner'].filter(name=>node.names.has(name));if(family.length<2)continue;
  const slots=node.order.map((name,i)=>family.includes(name)?i:-1).filter(i=>i>=0);family.forEach((name,i)=>node.order[slots[i]]=name);
 }
 for(const node of nodes.values())if(node.names.has('Vermonter')&&node.names.has('Acela')){const v=node.order.indexOf('Vermonter'),a=node.order.indexOf('Acela');if(v>a){node.order[v]='Acela';node.order[a]='Vermonter';}}
 for(const node of nodes.values())for(const [west,east] of [['Pacific Surfliner','Southwest Chief'],['Coast Starlight','Pacific Surfliner'],['Missouri River Runner','Texas Eagle'],['Lincoln Service Missouri River Runner','Texas Eagle']])if(node.names.has(west)&&node.names.has(east)){const w=node.order.indexOf(west),e=node.order.indexOf(east);if(node.normal[0]>=0?w>e:w<e){node.order[w]=east;node.order[e]=west;}}
 for(const node of nodes.values())if(node.names.has('Maple Leaf')){node.order=node.order.filter(name=>name!=='Maple Leaf');node.order.unshift('Maple Leaf');}
 for(const [id,node] of nodes)if(id!=='CHI'&&node.names.has('Pere Marquette')){node.order=node.order.filter(name=>name!=='Pere Marquette');if(node.normal[1]>=0)node.order.unshift('Pere Marquette');else node.order.push('Pere Marquette');}
 for(const [id,node] of nodes)if(id!=='CHI'){
  for(const [below,above] of [['Capitol Limited','Floridian'],['Borealis','Empire Builder']])if(node.names.has(below)&&node.names.has(above)){
   const b=node.order.indexOf(below),a=node.order.indexOf(above);if(node.normal[1]>=0?b<a:b>a){node.order[b]=above;node.order[a]=below;}
  }
 }
 for(const [id,node] of nodes){const pairs=[...(id==='PGH'?[['Pennsylvanian','Floridian']]:[]),...(id==='SOB'?[['Lake Shore Limited','Floridian']]:[])];for(const [north,south] of pairs)if(node.names.has(north)&&node.names.has(south)){const n=node.order.indexOf(north),s=node.order.indexOf(south);if(node.normal[1]>=0?n>s:n<s){node.order[n]=south;node.order[s]=north;}}}
 if(nodes.has('SOB')){const node=nodes.get('SOB'),family=['Lake Shore Limited','Floridian','Capitol Limited'].filter(n=>node.order.includes(n)),slots=node.order.map((n,i)=>family.includes(n)?i:-1).filter(i=>i>=0);if(node.normal[1]<0)family.reverse();family.forEach((n,i)=>node.order[slots[i]]=n);}
 for(const [id,node] of nodes)if(id!=='LAX'&&node.names.has('Coast Starlight')&&node.names.has('Pacific Surfliner')){node.normal=[Math.SQRT1_2,-Math.SQRT1_2];const c=node.order.indexOf('Coast Starlight'),p=node.order.indexOf('Pacific Surfliner');if(c>p){node.order[c]='Pacific Surfliner';node.order[p]='Coast Starlight';}}
 for(const node of nodes.values()){
  const p=frameProject(node.coordinate);let nearest=Infinity;for(const edge of node.edges){const q=frameProject(nodes.get(edge.other).coordinate),d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(d>1e-12)nearest=Math.min(nearest,d);}
  node.maxRowSpacing=nearest*.5/Math.max(1,node.order.length-1);
 }
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
  const drawingStyle=schematicDrawingStyle(job.zoom),radius=Math.min(1.8,.85+Math.max(0,job.zoom-4)*.16),ringWidth=0;
  const rowSpacing=drawingStyle.laneSpacing,screen=new Map();
  for(const [id,node] of nodes){
   const p=project(node.coordinate),stationSpacing=id==='CHI'?Math.min(spacing,rowSpacing*.88,node.maxRowSpacing*world):rowSpacing;
   node.order.forEach((name,i)=>{const offset=(i-(node.order.length-1)/2)*stationSpacing;
    if(id==='CHI'&&i>13){const start=(13-(node.order.length-1)/2)*stationSpacing,step=(i-13)*stationSpacing;screen.set(id+'|'+name,[p[0]+Math.SQRT1_2*(start+step),p[1]+Math.SQRT1_2*(start-step)]);}
    else screen.set(id+'|'+name,[p[0]+node.normal[0]*offset,p[1]+node.normal[1]*offset]);
   });
  }
  const parallel=parallelCorridors(routes,nodes,screen,project,rowSpacing);
  for(const [key,p] of parallel.positions)positions.set(key,unproject(p));
  const displayed=collection(parallel.features.map(({feature:f,points,body,normal,laneOffset})=>{const name=stationRouteName(f.properties.symbologyName||f.properties.name);return {...f,properties:{...f.properties,parallelBody:body.map(unproject),perpendicularOffset:laneOffset,stationPositions:[f.properties.from,f.properties.to].map(Code=>({Code,name,coordinates:positions.get(Code+'|'+name)}))},geometry:{type:'LineString',coordinates:points.map(unproject)}};}));
  displayed.connectivityAudit={brokenJunctions:[]};
  const colors=new Map(routes.features.map(f=>[stationRouteName(f.properties.symbologyName||f.properties.name),f.properties.color]));
  const dots=collection(stations.features.flatMap(s=>(s.properties.routeNames||[]).map(name=>({type:'Feature',properties:{...s.properties,symbolRoutes:[name],stopStatus:'stop',color:colors.get(name)||'#fff',radius,ringWidth},geometry:{type:'Point',coordinates:positions.get(s.properties.Code+'|'+name)||s.geometry.coordinates}}))));
  const ids=new Set((job.records||[]).flatMap(journey)),qualifying=collection(displayed.features.filter(f=>ids.has(f.properties.edgeId)));
  return {id:job.id,key:'schematic|'+job.zoom,zoom:job.zoom,style:{spacing,...schematicDrawingStyle(job.zoom)},displayed,dots,qualifying,layoutMilliseconds:Math.round(performance.now()-started)};
 }};
}
