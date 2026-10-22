export function terminalBoxDimensions(zoom){const scale=2**Math.min(0,zoom-8.6);return {halfWidth:56*scale,halfHeight:40*scale,radius:6.4*scale};}
// Offset each shared station-to-station segment perpendicular to its own track.
// Adjacent unchanged bundles meet at their offset-line intersection (miter).
export function parallelCorridors(routes,nodes,preferred,project,spacing,{circleStations=false,zoom=12,stationScale=1,chicagoPorts,pennPositions}={}){
 // Assign ports by approach family so shrinking the rectangle cannot
 // send a northern route into the western approach's attachment row.
 if(chicagoPorts&&!chicagoPorts.size){const ports=[
  ['Empire Builder',-44,-40],['Borealis',-32,-40],['Hiawatha Service',-20,-40],
  ['California Zephyr',-56,-22],['Southwest Chief',-56,-10],['Carl Sandburg',-56,2],['Illinois Zephyr',-56,14],
  ['Lincoln Service Missouri River Runner',-56,24],['Lincoln Service',-56,32],['Texas Eagle',-44,40],
  ['City Of New Orleans',-33,40],['Illini',-22,40],['Saluki',-11,40],['Cardinal',0,40],
  ['Pere Marquette',56,-24],['Blue Water',44,40],['Wolverine',33,40],['Lake Shore Limited',22,40],['Floridian',11,40],['Capitol Limited',56,26]
 ];for(const [name,x,y] of ports)chicagoPorts.set(name,[x/8,y/8]);}
 const bundles=new Map(),incident=new Map(),keyFor=f=>[f.properties.from,f.properties.to].sort().join('|');
 for(const f of routes.features){const key=keyFor(f);if(!bundles.has(key))bundles.set(key,{names:new Set(),features:[]});const b=bundles.get(key);b.names.add(f.properties.symbologyName||f.properties.name);b.features.push(f);}
 for(const [key,bundle] of bundles){
  const [from,to]=key.split('|'),a=project(nodes.get(from).coordinate),b=project(nodes.get(to).coordinate),dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1;
  let normal=[-dy/length,dx/length];
  const names=[...bundle.names],west=names.some(n=>['Coast Starlight','Amtrak Cascades','Empire Builder'].includes(n))&&nodes.get(from).coordinate[0]<-116;
  if(west?normal[0]<0:(names.includes('Texas Eagle')&&names.includes('Sunset Limited')?normal[1]<0:normal[0]+normal[1]<0))normal=normal.map(v=>-v);
  if(names.includes('Borealis')&&names.includes('Empire Builder')&&normal[0]-normal[1]<0)normal=normal.map(v=>-v);
  if(names.includes('Coast Starlight')&&names.includes('Pacific Surfliner')&&normal[0]-normal[1]<0)normal=normal.map(v=>-v);
  const order=nodes.get(from).order.filter(n=>bundle.names.has(n));
  if(order.includes('Vermonter')&&order.includes('Acela')){const v=order.indexOf('Vermonter'),a=order.indexOf('Acela');if(normal[0]>=0?v>a:v<a){order[v]='Acela';order[a]='Vermonter';}}
  for(const [west,east] of [['Northeast Regional','Acela'],['Floridian','Silver Meteor'],...([from,to].every(id=>nodes.get(id).coordinate[1]>37)?[['Floridian','Carolinian']]:[]),['Pacific Surfliner','Southwest Chief'],['Coast Starlight','Pacific Surfliner'],['Capitol Corridor','California Zephyr'],['Missouri River Runner','Texas Eagle'],['Lincoln Service Missouri River Runner','Texas Eagle'],['Lincoln Service Missouri River Runner','Lincoln Service']])if(order.includes(west)&&order.includes(east)){const w=order.indexOf(west),e=order.indexOf(east);if(normal[0]>=0?w>e:w<e){order[w]=east;order[e]=west;}}
  if(order.includes('Maple Leaf')){const index=order.indexOf('Maple Leaf');order.splice(index,1);if(normal[0]-normal[1]>=0)order.push('Maple Leaf');else order.unshift('Maple Leaf');}
  if(order.includes('Pere Marquette')){const index=order.indexOf('Pere Marquette');order.splice(index,1);if(normal[1]>=0)order.unshift('Pere Marquette');else order.push('Pere Marquette');}
  for(const [below,above] of [['Capitol Limited','Floridian']])if(order.includes(below)&&order.includes(above)){
   const b=order.indexOf(below),a=order.indexOf(above);if(normal[1]>=0?b<a:b>a){order[b]=above;order[a]=below;}
  }
  const northPairs=[['Piedmont','Carolinian'],['Carl Sandburg','Illinois Zephyr'],['Floridian','Carolinian'],['Blue Water','Wolverine'],['Floridian','Capitol Limited'],['Crescent','Carolinian'],['Lincoln Service Missouri River Runner','Lincoln Service'],['Pennsylvanian','Floridian'],...([from,to].includes('SOB')?[['Lake Shore Limited','Floridian']]:[])];
  for(const [north,south] of northPairs)if(order.includes(north)&&order.includes(south)){const n=order.indexOf(north),s=order.indexOf(south);if(normal[1]>=0?n>s:n<s){order[n]=south;order[s]=north;}}
  if([from,to].includes('SOB')){const family=['Lake Shore Limited','Floridian','Capitol Limited'].filter(n=>order.includes(n)),slots=order.map((n,i)=>family.includes(n)?i:-1).filter(i=>i>=0);if(normal[1]<0)family.reverse();family.forEach((n,i)=>order[slots[i]]=n);}
  if(order.includes('Borealis')&&order.includes('Empire Builder')){const b=order.indexOf('Borealis'),e=order.indexOf('Empire Builder');if(normal[0]-normal[1]>=0?b<e:b>e){order[b]='Empire Builder';order[e]='Borealis';}}
  if(order.includes('Amtrak Cascades')){order.splice(order.indexOf('Amtrak Cascades'),1);if(normal[0]>=0)order.unshift('Amtrak Cascades');else order.push('Amtrak Cascades');}
  if(order.includes('Pacific Surfliner')&&!order.includes('Coast Starlight')){order.splice(order.indexOf('Pacific Surfliner'),1);if(normal[0]>=0)order.unshift('Pacific Surfliner');else order.push('Pacific Surfliner');}
  if(order.includes('Gold Runner')||order.includes('Capitol Corridor')&&order.includes('California Zephyr')){
   const bayOrder=['Coast Starlight','Capitol Corridor','California Zephyr','Gold Runner'];
   order.sort((a,b)=>bayOrder.indexOf(a)-bayOrder.indexOf(b));
   if(normal[0]<0)order.reverse();
  }
  if(order.includes('Coast Starlight')&&order.includes('Pacific Surfliner')){const c=order.indexOf('Coast Starlight'),p=order.indexOf('Pacific Surfliner');if(c>p){order[c]='Pacific Surfliner';order[p]='Coast Starlight';}}
  // Northeast trunk lanes and station rows must share the same order,
  // including where Pennsylvania services join at Philadelphia.
  if(names.includes('Floridian')&&names.includes('Northeast Regional')&&[from,to].every(id=>nodes.get(id).coordinate[1]>=38.85)){
   const trunkOrder=['Pennsylvanian','Keystone Service','Cardinal','Crescent','Floridian','Carolinian','Palmetto','Silver Meteor','Vermonter','Northeast Regional','Acela'];
   order.sort((a,b)=>trunkOrder.indexOf(a)-trunkOrder.indexOf(b));
   if(normal[0]+normal[1]<0)order.reverse();
  }
  const hudsonOrder=['Lake Shore Limited','Empire Service','Maple Leaf','Adirondack','Ethan Allen Express'];
  if(names.includes('Empire Service')&&names.every(name=>hudsonOrder.includes(name))){
   order.sort((a,b)=>hudsonOrder.indexOf(a)-hudsonOrder.indexOf(b));
   if(normal[0]-normal[1]<0)order.reverse();
  }
  if(order.includes('Crescent')&&order.includes('Floridian')){const c=order.indexOf('Crescent'),f=order.indexOf('Floridian');if(normal[0]>=0?c>f:c<f){order[c]='Floridian';order[f]='Crescent';}}
  const lanes=new Map(order.map((n,i)=>[n,(i-(order.length-1)/2)*spacing]));
  Object.assign(bundle,{from,to,a,b,normal,lanes});
  for(const id of [from,to]){if(!incident.has(id))incident.set(id,[]);incident.get(id).push(bundle);}
 }
 // Keep lane order in one frame through unchanged shared corridors. Small
 // bearing changes must not move a service from one edge of the bundle to
 // the other just because a compass component changes sign.
 const visited=new Set();
 for(const seed of bundles.values()){if(visited.has(seed)||seed.names.size<2)continue;const signature=[...seed.names].sort().join(';'),component=[],queue=[seed];
  while(queue.length){const b=queue.pop();if(visited.has(b))continue;visited.add(b);component.push(b);for(const id of [b.from,b.to])for(const other of incident.get(id)||[])if([...other.names].sort().join(';')===signature&&!visited.has(other))queue.push(other);}
  const reference=component.reduce((a,b)=>Math.hypot(b.b[0]-b.a[0],b.b[1]-b.a[1])>Math.hypot(a.b[0]-a.a[0],a.b[1]-a.a[1])?b:a),order=[...reference.lanes].sort((a,b)=>a[1]-b[1]).map(([name])=>name);
  for(const b of component){if(!(b.names.has('Coast Starlight')&&(b.names.has('Gold Runner')||b.names.has('Pacific Surfliner')))&&b.normal[0]*reference.normal[0]+b.normal[1]*reference.normal[1]<0)b.normal=b.normal.map(v=>-v);b.priorityNormal=reference.normal;order.forEach((name,i)=>b.lanes.set(name,(i-(order.length-1)/2)*spacing));}
 }
 const positions=new Map(preferred),joins=new Set();
 // Spread each Chicago approach across its own track direction. Preserve the
 // requested west/east group order. Keep singleton hub displacement local
 // to the approach edge; shared bundles retain their common lane origin.
 const assigned=new Set();let right=-Infinity;
 const chicago=nodes.get('CHI');
 if(chicago){const origin=project(chicago.coordinate),edges=[...(incident.get('CHI')||[])].sort((a,b)=>Math.min(...[...a.names].map(n=>chicago.order.indexOf(n)))-Math.min(...[...b.names].map(n=>chicago.order.indexOf(n))));
  for(const edge of edges){const names=chicago.order.filter(n=>edge.names.has(n));if(edge.normal[0]<0)names.reverse();names.forEach((name,i)=>edge.lanes.set(name,(i-(names.length-1)/2)*spacing));const points=names.map(n=>preferred.get('CHI|'+n)),center=[points.reduce((s,p)=>s+p[0],0)/points.length,points.reduce((s,p)=>s+p[1],0)/points.length],half=(names.length-1)*spacing/2;
   // The five eastern services share the real Hammond–Whiting approach.
   // Packing them after every western terminal slot displaced this whole
   // corridor eastward; only the box ports need that terminal separation.
   const easternApproach=edge.names.has('Wolverine')&&edge.names.has('Pere Marquette');
   const minimum=center[0]-Math.abs(edge.normal[0])*half;if(easternApproach){center[0]=origin[0];center[1]=origin[1];}else if(minimum<right+spacing*.12)center[0]+=right+spacing*.12-minimum;
   right=center[0]+Math.abs(edge.normal[0])*half;
   const base=(center[0]-origin[0])*edge.normal[0]+(center[1]-origin[1])*edge.normal[1];
   // Keep the western corridor centered on its source track. Its Chicago
   // terminal arrangement must not displace the entire Galesburg corridor.

   if(!(edge.names.has('California Zephyr')&&edge.names.has('Southwest Chief'))){
    const signature=[...edge.names].sort().join(';'),queue=[edge],intended=new Map(edge.lanes);
    while(queue.length){const b=queue.pop();if(assigned.has(b))continue;assigned.add(b);if(edge.names.size>1)for(const name of b.lanes.keys())b.lanes.set(name,intended.get(name)+base);
     if(edge.names.size>1)for(const id of [b.from,b.to])for(const other of incident.get(id)||[])if([...other.names].sort().join(';')===signature)queue.push(other);
    }
   }
   names.forEach((name,i)=>{const d=(i-(names.length-1)/2)*spacing;positions.set('CHI|'+name,[center[0]+edge.normal[0]*d,center[1]+edge.normal[1]*d]);joins.add('CHI|'+name);});
  }
 }


 for(const edge of incident.get('HMI')||[]){const other=edge.from==='HMI'?edge.to:edge.from;if(!['NBU','SOB'].includes(other))continue;const origin=(other==='NBU'?-1:1)*spacing*1.5*(edge.normal[1]>=0?1:-1);for(const [name,d] of edge.lanes)edge.lanes.set(name,d+origin);}

 // A station row follows the local shared track, not a global diagonal.
 for(const [id,edges] of incident){if(['CHI','HMI','NBU','SOB','LAX','POS','ONA'].includes(id))continue;const primary=edges.toSorted((a,b)=>b.names.size-a.names.size)[0],node=nodes.get(id);if(primary.names.size!==node.names.size||node.names.has('Coast Starlight')&&primary.normal[0]<0)continue;const p=project(node.coordinate);for(const name of node.names){const d=primary.lanes.get(name);positions.set(id+'|'+name,[p[0]+primary.normal[0]*d,p[1]+primary.normal[1]*d]);}}

 for(const [id,edges] of incident){
  const node=nodes.get(id),names=[...node.names];if(id==='CHI'||edges.length>2||edges.some(e=>e.names.size!==names.length||names.some(n=>!e.names.has(n))))continue;
  const n=edges[0].normal,m=edges[1]?.normal||n,det=n[0]*m[1]-n[1]*m[0],dot=n[0]*m[0]+n[1]*m[1];
  if(dot<-.5)continue;
  let vector;if(Math.abs(det)<1e-8)vector=n;else vector=[(m[1]-n[1])/det,(n[0]-m[0])/det];
  if(Math.hypot(...vector)>3)continue;
  if(names.includes('Coast Starlight')&&vector[0]<0)continue;
  if(edges.length===2&&names.some(name=>Math.abs(edges[0].lanes.get(name)-edges[1].lanes.get(name))>1e-8))continue;
  const p=project(node.coordinate);
  for(const name of names){const d=edges[0].lanes.get(name);positions.set(id+'|'+name,[p[0]+vector[0]*d,p[1]+vector[1]*d]);joins.add(id+'|'+name);}
 }
 // At Hammond–Whiting each route continues through one of two branches.
 // Intersect its incoming and outgoing offset lines instead of sending all
 // three bundles through the same diagonal station row.
 for(const name of nodes.get('HMI')?.names||[]){const edges=(incident.get('HMI')||[]).filter(e=>e.names.has(name));if(edges.length!==2)continue;const [a,b]=edges,n=a.normal,m=b.normal,det=n[0]*m[1]-n[1]*m[0];if(Math.abs(det)<1e-8)continue;const d=a.lanes.get(name),e=b.lanes.get(name),p=project(nodes.get('HMI').coordinate);positions.set('HMI|'+name,[p[0]+(d*m[1]-n[1]*e)/det,p[1]+(n[0]*e-d*m[0])/det]);joins.add('HMI|'+name);}
 // Join each through-service at the intersection of its two offset lines.
 // Terminal routes end on their one offset line, never detour to a hub row.

 const oldStationPositions=new Map(positions),oldStationJoins=new Set(joins);
 for(const [id,edges] of incident){if(id==='CHI')continue;const p=project(nodes.get(id).coordinate);for(const name of nodes.get(id).names){const own=edges.filter(e=>e.names.has(name));if(own.length===1){const a=own[0],d=a.lanes.get(name);const old=positions.get(id+'|'+name),correction=(old[0]-p[0])*a.normal[0]+(old[1]-p[1])*a.normal[1]-d;positions.set(id+'|'+name,[old[0]-a.normal[0]*correction,old[1]-a.normal[1]*correction]);joins.add(id+'|'+name);}else if(own.length===2){const [a,b]=own,n=a.normal,m=b.normal,det=n[0]*m[1]-n[1]*m[0];if(Math.abs(det)<1e-7)continue;const d=a.lanes.get(name),e=b.lanes.get(name),offset=[(d*m[1]-n[1]*e)/det,(n[0]*e-d*m[0])/det];if(Math.hypot(...offset)>spacing*Math.max(4,nodes.get(id).names.size)*2)continue;const point=[p[0]+offset[0],p[1]+offset[1]];if(Math.abs(det)<.35&&Math.abs(d-e)>1e-7)continue;positions.set(id+'|'+name,point);joins.add(id+'|'+name);}}}
 // Terminal markers have freedom along their own line. Use it to separate
 // markers from different approaches without adding connector vertices.
 for(const [id,edges] of incident){if(id==='CHI')continue;const node=nodes.get(id);for(const name of node.names){const own=edges.filter(e=>e.names.has(name));if(own.length!==1)continue;const edge=own[0],n=edge.normal,p=project(node.coordinate),old=positions.get(id+'|'+name),d=edge.lanes.get(name),correction=(old[0]-p[0])*n[0]+(old[1]-p[1])*n[1]-d,base=[old[0]-n[0]*correction,old[1]-n[1]*correction],t=[-n[1],n[0]];for(const step of [0,...Array.from({length:8},(_,i)=>[i+1,-i-1]).flat()]){const point=[base[0]+t[0]*step*spacing,base[1]+t[1]*step*spacing];if([...node.stopNames||[]].some(other=>other!==name&&positions.has(id+'|'+other)&&Math.hypot(point[0]-positions.get(id+'|'+other)[0],point[1]-positions.get(id+'|'+other)[1])<spacing*.65))continue;if(['Pacific Surfliner','Amtrak Cascades'].includes(name)&&[...node.names].some(other=>other!==name&&!(name==='Pacific Surfliner'&&other==='Coast Starlight')&&positions.get(id+'|'+other)[0]<point[0]-1e-7))continue;if(id==='PGH'&&name==='Pennsylvanian'&&node.names.has('Floridian')&&point[1]>=positions.get(id+'|Floridian')[1])continue;if(name==='Silver Meteor'&&node.names.has('Floridian')&&point[0]<=positions.get(id+'|Floridian')[0])continue;positions.set(id+'|'+name,point);joins.add(id+'|'+name);break;}}}
 // Validate dot separation and the established compass ordering independently
 // of whether a station uses intersections or a fallback row.
 function validStationRow(id,node){
  const names=[...node.names],stopNames=names.filter(n=>node.stopNames?.has(n)),point=name=>positions.get(id+'|'+name);
  for(let i=0;i<stopNames.length;i++)for(let j=i+1;j<stopNames.length;j++){
   const a=point(stopNames[i]),b=point(stopNames[j]);if(Math.hypot(a[0]-b[0],a[1]-b[1])<spacing*.65)return false;
  }
  for(const west of ['Pacific Surfliner','Amtrak Cascades'])if(names.includes(west)&&names.some(n=>!(west==='Pacific Surfliner'&&n==='Coast Starlight')&&point(n)[0]<point(west)[0]-1e-7))return false;
  if(names.includes('Lincoln Service Missouri River Runner')&&names.includes('Lincoln Service')&&point('Lincoln Service Missouri River Runner')[0]>=point('Lincoln Service')[0])return false;
  if(names.includes('Silver Meteor')&&names.includes('Floridian')&&point('Silver Meteor')[0]<=point('Floridian')[0])return false;
  const northPairs=[['Piedmont','Carolinian'],['Blue Water','Wolverine'],['Floridian','Capitol Limited'],['Crescent','Carolinian'],['Lincoln Service Missouri River Runner','Lincoln Service'],...(id==='PGH'?[['Pennsylvanian','Floridian']]:[]),...(id==='SOB'?[['Lake Shore Limited','Floridian'],['Floridian','Capitol Limited']]:[])];
  for(const [north,south] of northPairs)if(names.includes(north)&&names.includes(south)&&point(north)[1]>=point(south)[1])return false;
  if(names.includes('Northeast Regional')){const nr=point('Northeast Regional');if(names.some(n=>!['Northeast Regional','Acela'].includes(n)&&point(n)[0]+point(n)[1]>nr[0]+nr[1]+1e-7))return false;}
  if(names.includes('Texas Eagle')&&names.includes('Sunset Limited')&&point('Texas Eagle')[1]>=point('Sunset Limited')[1])return false;
  const coastal=['Amtrak Cascades','Coast Starlight','Empire Builder'].filter(n=>names.includes(n));
  if(node.coordinate[0]<-116)for(let i=1;i<coastal.length;i++)if(point(coastal[i-1])[0]>=point(coastal[i])[0])return false;
  if(id==='LAX'){
   const order=['Coast Starlight','Pacific Surfliner','Southwest Chief','Texas Eagle','Sunset Limited'].filter(n=>names.includes(n));
   for(let i=1;i<order.length;i++)if(point(order[i-1])[0]>=point(order[i])[0])return false;
  }
  return true;
 }
 // Keep separated hub rows if offset intersections would merge markers.
 for(const [id,node] of nodes){
  if(id==='CHI'||validStationRow(id,node))continue;
  for(const name of node.names){const key=id+'|'+name;positions.set(key,oldStationPositions.get(key));if(oldStationJoins.has(key))joins.add(key);else joins.delete(key);}
 }
 // A hub-row fallback must not pull terminal vertices off their only
 // incident line. Slide terminals along that line to keep dots separated.
 for(const [id,edges] of incident){
  if(id==='CHI')continue;
  const node=nodes.get(id),p=project(node.coordinate);
  for(const name of node.names){
   const own=edges.filter(e=>e.names.has(name));if(own.length!==1)continue;
   const edge=own[0],n=edge.normal,old=positions.get(id+'|'+name),d=edge.lanes.get(name);
   const correction=(old[0]-p[0])*n[0]+(old[1]-p[1])*n[1]-d;
   if(Math.abs(correction)<1e-7)continue;
   const base=[old[0]-n[0]*correction,old[1]-n[1]*correction],t=[-n[1],n[0]];
   for(const step of [0,...Array.from({length:24},(_,i)=>[i+1,-i-1]).flat()]){
    const point=[base[0]+t[0]*step*spacing,base[1]+t[1]*step*spacing];
    const otherId=edge.from===id?edge.to:edge.from,neighbor=positions.get(otherId+'|'+name);
    let crossing=false;
    const side=(a,b,q)=>(b[0]-a[0])*(q[1]-a[1])-(b[1]-a[1])*(q[0]-a[0]);
    for(const otherEdge of edges)for(const other of otherEdge.names){
     if(other===name)continue;
     const a=positions.get(id+'|'+other),b=positions.get((otherEdge.from===id?otherEdge.to:otherEdge.from)+'|'+other);
     if(side(point,neighbor,a)*side(point,neighbor,b)<-1e-8&&side(a,b,point)*side(a,b,neighbor)<-1e-8)crossing=true;
    }
    if(crossing)continue;
    positions.set(id+'|'+name,point);
    if(!validStationRow(id,node)){positions.set(id+'|'+name,old);continue;}
    positions.set(id+'|'+name,point);joins.add(id+'|'+name);break;
   }
  }
 }
 // All ordinary stations use one compact row. Keep the established
 // local frame and ordering, but remove independent marker displacement.
 for(const [id,node] of nodes){
  if(['CHI','HMI','NBU','SOB'].includes(id)||node.names.size<2)continue;
  const p=project(node.coordinate),old=[...node.names].map(name=>({name,point:positions.get(id+'|'+name)}));
  const center=[old.reduce((v,e)=>v+e.point[0],0)/old.length,old.reduce((v,e)=>v+e.point[1],0)/old.length];
  let xx=0,xy=0,yy=0;
  for(const {point:q} of old){const dx=q[0]-center[0],dy=q[1]-center[1];xx+=dx*dx;xy+=dx*dy;yy+=dy*dy;}
  const angle=.5*Math.atan2(2*xy,xx-yy);let axis=[Math.cos(angle),Math.sin(angle)];
  if(axis[0]*node.normal[0]+axis[1]*node.normal[1]<0)axis=axis.map(v=>-v);
  old.sort((a,b)=>(a.point[0]-b.point[0])*axis[0]+(a.point[1]-b.point[1])*axis[1]);
  old.forEach(({name},i)=>{const offset=(i-(old.length-1)/2)*spacing;positions.set(id+'|'+name,[p[0]+axis[0]*offset,p[1]+axis[1]*offset]);joins.delete(id+'|'+name);});
  if(!validStationRow(id,node))node.order.forEach((name,i)=>{const offset=(i-(node.order.length-1)/2)*spacing;positions.set(id+'|'+name,[p[0]+node.normal[0]*offset,p[1]+node.normal[1]*offset]);});
 }
 // Compact transverse rows through the Bay Area, with a stable slot
 // fallback only when short interstation geometry would otherwise reverse.
 const fixedRows=new Map(),bayManaged=new Set();
 const bayOrder=['Coast Starlight','Capitol Corridor','California Zephyr','Gold Runner'];
 const southBayRows=new Set(['GAC','SCC','SJC']);
 const santaClara=nodes.get('SCC'),sanJose=nodes.get('SJC');
 let southBayNormal=[1,0];
 if(santaClara&&sanJose){
  const a=project(santaClara.coordinate),b=project(sanJose.coordinate),dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
  if(length>1e-7)southBayNormal=[dy/length,-dx/length];
 }
 for(const [id,node] of nodes){
  const [lon,lat]=node.coordinate;if(lon>=-120||lat<36.8||lat>39)continue;
  if([...node.names].some(name=>!bayOrder.includes(name)))continue;
  const p=project(node.coordinate);
  bayManaged.add(id);
  const local=(incident.get(id)||[]).toSorted((a,b)=>b.names.size-a.names.size)[0].normal;
  const bayAxis=southBayRows.has(id)?southBayNormal:zoom<5||!['RIC','MTZ','EMY','DAV','SAC','BKY','OKJ','OAC','FFV','SUI'].includes(id)?[1,0]:local.map(v=>local[0]<0?-v:v);
  fixedRows.set(id,new Map([...node.names].map(name=>{const offset=(bayOrder.indexOf(name)-1.5)*spacing;return [name,[p[0]+bayAxis[0]*offset,p[1]+bayAxis[1]*offset]];})));
  const order=bayOrder.filter(name=>node.names.has(name));
  for(const name of order){const offset=(order.indexOf(name)-(order.length-1)/2)*spacing,axis=bayAxis;positions.set(id+'|'+name,[p[0]+axis[0]*offset,p[1]+axis[1]*offset]);joins.delete(id+'|'+name);}
 }
 // Pack only the services present into each Northeast station row,
 // including terminal and branch routes. Reserve the full order only for
 // the low-zoom New York fallback checked below.
 const northeastOrder=['Lake Shore Limited','Empire Service','Maple Leaf','Adirondack','Ethan Allen Express','Pennsylvanian','Keystone Service','Cardinal','Crescent','Floridian','Capitol Limited','Carolinian','Palmetto','Silver Meteor','Amtrak Hartford Line','Valley Flyer','Vermonter','Northeast Regional','Acela'];
 for(const [id,node] of nodes){
  const [lon,lat]=node.coordinate;if(lon<-78||lon>-70||lat<38.5||lat>43)continue;
  if([...node.names].some(name=>!northeastOrder.includes(name)))continue;
  const p=project(node.coordinate),order=northeastOrder.filter(name=>node.names.has(name));
  fixedRows.set(id,new Map(order.map((name,i)=>{const offset=(i-(order.length-1)/2)*spacing;return [name,[p[0]+Math.SQRT1_2*offset,p[1]+Math.SQRT1_2*offset]];})));
  if(id==='WAS'&&order.includes('Capitol Limited')){order.splice(order.indexOf('Capitol Limited'),1);order.unshift('Capitol Limited');}
  for(const name of order){
   const offset=(order.indexOf(name)-(order.length-1)/2)*spacing;
   positions.set(id+'|'+name,[p[0]+Math.SQRT1_2*offset,p[1]+Math.SQRT1_2*offset]);joins.delete(id+'|'+name);
  }
 }
 // Keep the requested hub order in one stable station row.
 for(const [id,order,axis] of [
  ['KCY',['Southwest Chief','Lincoln Service Missouri River Runner','Missouri River Runner'],[0,1]],
  ['STL',['Lincoln Service Missouri River Runner','Missouri River Runner','Lincoln Service','Texas Eagle'],bundles.get('ALN|STL')?.normal||[Math.SQRT1_2,Math.SQRT1_2]],
  ['PGH',['Pennsylvanian','Floridian','Capitol Limited'],[-Math.SQRT1_2,Math.SQRT1_2]]
 ]){
  const node=nodes.get(id);if(!node)continue;const p=project(node.coordinate),names=order.filter(name=>node.names.has(name));
  names.forEach((name,i)=>{const offset=(i-(names.length-1)/2)*spacing;positions.set(id+'|'+name,[p[0]+axis[0]*offset,p[1]+axis[1]*offset]);joins.delete(id+'|'+name);});
 }
 // Compact rows by default. At scales where a dense hub exceeds the
 // available interstation distance, retain its stable corridor slots rather
 // than reversing a short segment or crossing a neighboring approach.
 const newYorkManaged=new Set(['NYP','YNY','NRO','NWK','EWR']);
 const rowRestored=new Set(),rowEdges=routes.features.map(f=>({ids:[f.properties.from,f.properties.to],name:f.properties.symbologyName||f.properties.name}));
 const rowSide=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
 const rowCross=(a,b,c,d)=>rowSide(a,b,c)*rowSide(a,b,d)<-1e-8&&rowSide(c,d,a)*rowSide(c,d,b)<-1e-8;
 const rowAt=e=>e.ids.map(id=>positions.get(id+'|'+e.name));
 const rowIncident=new Map();
 for(const e of rowEdges)for(const id of e.ids){if(!rowIncident.has(id))rowIncident.set(id,[]);rowIncident.get(id).push(e);}
 for(let iteration=0;iteration<=fixedRows.size;iteration++){
  const restore=new Set();
  const flag=edges=>edges.forEach(e=>e.ids.forEach(id=>{if(fixedRows.has(id)&&!rowRestored.has(id))restore.add(id);}));
  for(const e of rowEdges){
   if(!e.ids.every(id=>fixedRows.has(id))||!e.ids.some(id=>bayManaged.has(id)||newYorkManaged.has(id)))continue;
   const [a,b]=e.ids.map(id=>project(nodes.get(id).coordinate)),[u,v]=rowAt(e),dx=b[0]-a[0],dy=b[1]-a[1];
   if(Math.hypot(dx,dy)>1e-7&&(v[0]-u[0])*dx+(v[1]-u[1])*dy<=0)flag([e]);
  }
  for(const [id,edges] of rowIncident){
   if(!fixedRows.has(id)||!bayManaged.has(id)&&!newYorkManaged.has(id))continue;
   for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){
    const [a,b]=rowAt(edges[i]),[c,d]=rowAt(edges[j]);
    if(rowCross(a,b,c,d))flag([edges[i],edges[j]]);
   }
  }
  if(!restore.size)break;
  for(const id of restore){rowRestored.add(id);for(const [name,p] of fixedRows.get(id))positions.set(id+'|'+name,p);}
 }
 // Preserve perpendicular spacing where two services share both approaches.
 // Intersect their offset tracks so diagonal station rows cannot compress
 // the lane gap or make their wide strokes overlap.
 for(const [id,node] of nodes){
  const names=[...node.names];if(names.length!==2||!(['Pennsylvanian','Keystone Service'].every(name=>names.includes(name))||['Floridian','Capitol Limited'].every(name=>names.includes(name))||['Floridian','Silver Meteor'].every(name=>names.includes(name))||['Coast Starlight','Pacific Surfliner'].every(name=>names.includes(name))))continue;
  const edges=(incident.get(id)||[]).filter(e=>id==='junction:auburndale'?names.every(name=>e.names.has(name)):true);
  if(!edges.length||edges.length>2||edges.some(e=>names.some(name=>!e.names.has(name))))continue;
  const [a,b=a]=edges,n=a.normal,m=b.normal,det=n[0]*m[1]-n[1]*m[0];
  if(names.includes('Pacific Surfliner')&&n[0]*m[0]+n[1]*m[1]<0&&edges.some(e=>Math.hypot(e.b[0]-e.a[0],e.b[1]-e.a[1])<spacing*3))continue;
  if(id!=='junction:auburndale'&&!names.includes('Pacific Surfliner')&&n[0]*m[0]+n[1]*m[1]<0)continue;
  const p=project(node.coordinate);
  for(const name of names){
   const d=a.lanes.get(name),e=b.lanes.get(name);
   const offset=Math.abs(det)<1e-7?[n[0]*d,n[1]*d]:[(d*m[1]-n[1]*e)/det,(n[0]*e-d*m[0])/det];
   positions.set(id+'|'+name,[p[0]+offset[0],p[1]+offset[1]]);joins.add(id+'|'+name);
  }
 }
 // The through Surfliner joins its two real offset approaches at Los
 // Angeles; a diagonal hub row otherwise creates a short sideways jog.
 if(nodes.has('LAX')){
  const name='Pacific Surfliner',edges=(incident.get('LAX')||[]).filter(e=>e.names.has(name));
  if(edges.length===2){const [a,b]=edges,n=a.normal,m=b.normal,det=n[0]*m[1]-n[1]*m[0];if(Math.abs(det)>1e-7){const p=project(nodes.get('LAX').coordinate),d=a.lanes.get(name),e=b.lanes.get(name);positions.set('LAX|'+name,[p[0]+(d*m[1]-n[1]*e)/det,p[1]+(n[0]*e-d*m[0])/det]);joins.add('LAX|'+name);}}
  const center=project(nodes.get('LAX').coordinate),through=positions.get('LAX|'+name),order=['Coast Starlight','Pacific Surfliner','Southwest Chief','Texas Eagle','Sunset Limited'];
  for(let i=0;i<order.length;i++){const service=order[i];if(service===name)continue;const own=(incident.get('LAX')||[]).filter(e=>e.names.has(service));if(own.length!==1)continue;const edge=own[0],n=edge.normal;if(Math.abs(n[1])<1e-4)continue;const x=through[0]+spacing*(i-order.indexOf(name));positions.set('LAX|'+service,[x,center[1]+(edge.lanes.get(service)-n[0]*(x-center[0]))/n[1]]);joins.add('LAX|'+service);}
 }
 // Preserve the real offset tracks at the crowded multi-direction hubs.
 // Their station enclosure handles the local junction, not a diagonal row.
 const organizedHubs=new Set(['PHL','SDY','ALB','AMS','UCA','SAV','MTZ','RIC','EMY','GBB','KEE','PTB','DAV','SAC','BKY','OKJ','OAC','FFV','SUI','WAS']);
 for(const [id,node] of nodes){
  const edges=incident.get(id)||[];
  if(zoom<5&&bayManaged.has(id))continue;
  if(!organizedHubs.has(id)||zoom<7.9&&!['WAS','PHL','GBB','KEE','AMS','UCA','SDY','ALB','PTB','RIC','MTZ','EMY','DAV','SAC','BKY','OKJ','OAC','FFV','SUI'].includes(id))continue;
  const center=project(node.coordinate);
  for(const name of node.names){let own=edges.filter(e=>e.names.has(name));if(id==='WAS'&&own.length>2)own=own.toSorted((a,b)=>b.names.size-a.names.size).slice(0,2);
   if(own.length===1){const e=own[0],old=positions.get(id+'|'+name),n=e.normal,correction=(old[0]-center[0])*n[0]+(old[1]-center[1])*n[1]-e.lanes.get(name);positions.set(id+'|'+name,[old[0]-n[0]*correction,old[1]-n[1]*correction]);joins.add(id+'|'+name);}
   if(own.length!==2)continue;
   const [a,b]=own,n=a.normal,m=b.normal,det=n[0]*m[1]-n[1]*m[0];if(Math.abs(det)<1e-5)continue;
   const d=a.lanes.get(name),e=b.lanes.get(name),offset=[(d*m[1]-n[1]*e)/det,(n[0]*e-d*m[0])/det];
   if(Math.hypot(...offset)>spacing*Math.max(5,node.names.size)*1.5)continue;
   positions.set(id+'|'+name,[center[0]+offset[0],center[1]+offset[1]]);joins.add(id+'|'+name);
  }
 }
 if(nodes.has('WAS')){const edge=(incident.get('WAS')||[]).find(e=>e.names.has('Capitol Limited')),old=positions.get('WAS|Capitol Limited'),center=project(nodes.get('WAS').coordinate);if(edge&&Math.abs(edge.normal[0])>1e-5){const n=edge.normal,d=edge.lanes.get('Capitol Limited');const flo=positions.get('WAS|Floridian'),x=Math.min(center[0]+(d-n[1]*(old[1]-center[1]))/n[0],flo[0]-spacing);positions.set('WAS|Capitol Limited',[x,Math.abs(n[1])>1e-5?center[1]+(d-n[0]*(x-center[0]))/n[1]:old[1]]);joins.add('WAS|Capitol Limited');}}
 // Penn Station may reuse a lane between a terminating service and a
 // service starting on another approach. Through services keep their slots.
 if(zoom>=8&&nodes.has('NYP')){const node=nodes.get('NYP'),edges=incident.get('NYP')||[],primary=edges.find(e=>[e.from,e.to].includes('NWK'))||edges.toSorted((a,b)=>b.names.size-a.names.size)[0],center=project(node.coordinate),axis=primary.normal;
  const other=primary.from==='NYP'?primary.to:primary.from,ordered=[...primary.names].sort((a,b)=>{const p=positions.get(other+'|'+a),q=positions.get(other+'|'+b);return (p[0]-q[0])*axis[0]+(p[1]-q[1])*axis[1];});
  ordered.forEach((name,i)=>{const d=(i-(ordered.length-1)/2)*spacing;positions.set('NYP|'+name,[center[0]+axis[0]*d,center[1]+axis[1]*d]);joins.add('NYP|'+name);});
  const endings=[...primary.names].filter(name=>edges.filter(e=>e.names.has(name)).length===1).sort((a,b)=>ordered.indexOf(a)-ordered.indexOf(b));
  for(const edge of edges.filter(e=>e!==primary)){const remote=edge.from==='NYP'?edge.to:edge.from,starting=[...edge.names].filter(name=>!primary.names.has(name)).sort((a,b)=>{const p=positions.get(remote+'|'+a),q=positions.get(remote+'|'+b);return (p[0]-q[0])*edge.normal[0]+(p[1]-q[1])*edge.normal[1];});starting.forEach((name,i)=>{const partner=endings[i],p=partner?positions.get('NYP|'+partner):center.map((v,j)=>v+axis[j]*((primary.names.size-1)/2+1+i-endings.length)*spacing);positions.set('NYP|'+name,[...p]);joins.add('NYP|'+name);});}
 }
 // Keep Penn's regional lane pairing in the same geographic frame at overview zooms.
 const pennNodes=new Set(['NYP','YNY','NRO','NWK','EWR']);
 if(zoom===8&&pennPositions){const world=512*2**zoom;for(const [key,p] of positions)if(pennNodes.has(key.split('|')[0]))pennPositions.set(key,[p[0]/world*360-180,Math.atan(Math.sinh(Math.PI*(1-2*p[1]/world)))*180/Math.PI]);}
 if(zoom<8&&pennPositions?.size)for(const [key,p] of pennPositions){positions.set(key,project(p));joins.add(key);}
 // At a two-service junction with separate approaches, give a terminating
 // stub its own transverse port. Longitudinal movement alone makes a bar
 // run along the terminating track and squeezes the two stop dots together.
 for(const [id,edges] of incident){const node=nodes.get(id);if(node.names.size!==2||edges.length!==3||edges.some(e=>e.names.size!==1))continue;
  const names=[...node.names],terminal=names.find(name=>edges.filter(e=>e.names.has(name)).length===1),through=names.find(name=>edges.filter(e=>e.names.has(name)).length===2);if(!terminal||!through)continue;
  const edge=edges.find(e=>e.names.has(terminal)),center=positions.get(id+'|'+through),normal=edge.normal,sign=id==='PGH'?(normal[1]>=0?-1:1):(normal[0]>=0?-1:1);
  positions.set(id+'|'+terminal,center.map((v,i)=>v+normal[i]*spacing*sign));joins.add(id+'|'+terminal);
 }
 // A diverging service joins the common bend row of the trunk services.
 // Preserve its incoming offset track; move only its branch connection.
 for(const [id,edges] of incident){if(edges.length!==3)continue;const sorted=edges.toSorted((a,b)=>b.names.size-a.names.size),primary=sorted[0],continuation=sorted[1],shared=[...primary.names].filter(name=>continuation.names.has(name));if(shared.length<2||shared.some(name=>!joins.has(id+'|'+name)))continue;
  const points=shared.map(name=>positions.get(id+'|'+name)),a=points[0],b=points.at(-1),axis=b.map((v,i)=>v-a[i]),length=Math.hypot(...axis);if(length<spacing||points.some(p=>Math.abs(axis[0]*(p[1]-a[1])-axis[1]*(p[0]-a[0]))/length>1e-5))continue;
  for(const name of primary.names){if(continuation.names.has(name)||edges.filter(e=>e.names.has(name)).length!==2||edges.find(e=>e!==primary&&e.names.has(name))?.names.size!==1)continue;const n=primary.normal,d=primary.lanes.get(name),center=project(nodes.get(id).coordinate),origin=center.map((v,i)=>v+n[i]*d),v=[-n[1],n[0]],delta=a.map((v,i)=>v-origin[i]),det=v[0]*axis[1]-v[1]*axis[0];if(Math.abs(det)<1e-8)continue;const t=(delta[0]*axis[1]-delta[1]*axis[0])/det,p=origin.map((x,i)=>x+t*v[i]);if(Math.hypot(p[0]-center[0],p[1]-center[1])>spacing*Math.max(5,primary.names.size)*2)continue;positions.set(id+'|'+name,p);joins.add(id+'|'+name);}
 }
 const features=routes.features.map(f=>{
  const bundle=bundles.get(keyFor(f)),name=f.properties.symbologyName||f.properties.name,d=bundle.lanes.get(name)||0,n=bundle.normal;
  const ids=[f.properties.from,f.properties.to],centers=ids.map(id=>project(nodes.get(id).coordinate)),anchors=ids.map(id=>positions.get(id+'|'+name));
  // Trim each parallel body at the displayed marker's longitudinal position.
  // The old center-based endpoint overshot that marker, then doubled back.
  const singleHubApproach=bundle.names.size===1&&ids.includes('CHI');
  const ends=centers.map((p,i)=>{if(singleHubApproach)return anchors[i];if(joins.has(ids[i]+'|'+name)&&!(ids[i]==='CHI'&&bundle.names.size>1)&&!(ids[i]==='junction:auburndale'&&bundle.names.size===1)&&!(ids[i]==='WAS'&&name==='Floridian'&&bundle.names.size===2))return anchors[i];const anchor=anchors[i],correction=(anchor[0]-p[0])*n[0]+(anchor[1]-p[1])*n[1]-d;return [anchor[0]-n[0]*correction,anchor[1]-n[1]*correction];});
  for(let i=0;i<2;i++)if(Math.hypot(anchors[i][0]-ends[i][0],anchors[i][1]-ends[i][1])<1e-7)ends[i]=anchors[i];
  const points=[anchors[0]];if(Math.hypot(anchors[0][0]-ends[0][0],anchors[0][1]-ends[0][1])>1e-7)points.push(ends[0]);
  points.push(ends[1]);if(Math.hypot(anchors[1][0]-ends[1][0],anchors[1][1]-ends[1][1])>1e-7)points.push(anchors[1]);
  const vector=[centers[1][0]-centers[0][0],centers[1][1]-centers[0][1]],magnitude=Math.hypot(...vector)||1,approachDirections=[[vector[0]/magnitude,vector[1]/magnitude],[-vector[0]/magnitude,-vector[1]/magnitude]];
  return {feature:f,points,body:ends,approachDirections,normal:n,priorityNormal:bundle.priorityNormal||n,laneOffset:d};
 });
 // Join directly to station vertices wherever a gradual lane transition
 // preserves route separation. Check the entire shared segment together.
 const renderedBundles=new Map();
 for(const feature of features){const key=keyFor(feature.feature);if(!renderedBundles.has(key))renderedBundles.set(key,[]);renderedBundles.get(key).push(feature);}
 const side=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
 for(const group of renderedBundles.values()){
  const anchors=group.map(({feature:f})=>[f.properties.from,f.properties.to].map(id=>positions.get(id+'|'+(f.properties.symbologyName||f.properties.name))));
  let crossing=false;
  for(let i=0;i<group.length;i++)for(let j=i+1;j<group.length;j++){
   const [a,b]=anchors[i],[c,d]=anchors[j];
   if(side(a,b,c)*side(a,b,d)<0&&side(c,d,a)*side(c,d,b)<0)crossing=true;
  }
  const pennsylvaniaPair=new Set(group.map(g=>g.feature.properties.symbologyName));
  const floridaPair=pennsylvaniaPair.size===2&&pennsylvaniaPair.has('Floridian')&&pennsylvaniaPair.has('Silver Meteor');
  const californiaPair=pennsylvaniaPair.size===2&&pennsylvaniaPair.has('Coast Starlight')&&pennsylvaniaPair.has('Pacific Surfliner')&&!group.some(g=>[g.feature.properties.from,g.feature.properties.to].includes('LAX'));
  const washingtonPair=pennsylvaniaPair.size===2&&pennsylvaniaPair.has('Floridian')&&pennsylvaniaPair.has('Capitol Limited')&&group.some(g=>[g.feature.properties.from,g.feature.properties.to].includes('WAS'));
  const organizedApproach=pennsylvaniaPair.size>1&&group.some(g=>[g.feature.properties.from,g.feature.properties.to].some(id=>organizedHubs.has(id)&&(zoom>=5||!['DAV','SAC','BKY','OKJ','OAC','FFV','SUI'].includes(id))));
  if(crossing||organizedApproach||floridaPair||californiaPair||washingtonPair||pennsylvaniaPair.size===2&&pennsylvaniaPair.has('Pennsylvanian')&&pennsylvaniaPair.has('Keystone Service'))continue;
  group.forEach((feature,i)=>{
   feature.stationTransition=(zoom<8&&pennPositions?.size&&[feature.feature.properties.from,feature.feature.properties.to].some(id=>pennNodes.has(id)))||[feature.feature.properties.from,feature.feature.properties.to].includes('NYP')||feature.points.length>2||Math.abs((anchors[i][1][0]-anchors[i][0][0])*feature.normal[0]+(anchors[i][1][1]-anchors[i][0][1])*feature.normal[1])>1e-7;
   feature.body=anchors[i];feature.points=anchors[i];
  });
 }
 // Compact enclosures consistently group the on-line stopping dots.
 // Their center is the actual station coordinate; no radius search or
 // marker displacement can enlarge them as the map zooms out.
 const circles=[],markers=new Map();
 for(const [id,node] of nodes){
  const stops=node.order.filter(name=>node.stopNames?.has(name));if(stops.length<1||node.names.size<2)continue;
  const stationCenter=project(node.coordinate),center=[...stationCenter],points=node.order.map(name=>positions.get(id+'|'+name)),margin=Math.max((zoom<8?1:2)*stationScale,spacing*(zoom<8?.1:.35)),edges=incident.get(id)||[];
  for(const f of features)for(const [i,code] of [f.feature.properties.from,f.feature.properties.to].entries())if(code===id&&node.names.has(f.feature.properties.symbologyName))points.push(f.body[i]);
  const sectors=[];for(const edge of edges){const q=project(nodes.get(edge.from===id?edge.to:edge.from).coordinate),dx=q[0]-center[0],dy=q[1]-center[1],length=Math.hypot(dx,dy);if(!length)continue;const v=[dx/length,dy/length];if(!sectors.some(u=>u[0]*v[0]+u[1]*v[1]>Math.cos(Math.PI/5)))sectors.push(v);}
  let xx=0,xy=0,yy=0;for(const p of points){const x=p[0]-center[0],y=p[1]-center[1];xx+=x*x;xy+=x*y;yy+=y*y;}
  const angle=.5*Math.atan2(2*xy,xx-yy);let axis=[Math.cos(angle),Math.sin(angle)],normal=[-axis[1],axis[0]];
  const extents=points.map(p=>{const x=p[0]-center[0],y=p[1]-center[1];return [x*axis[0]+y*axis[1],x*normal[0]+y*normal[1]];});
  let length=Math.max(...extents.map(p=>Math.abs(p[0]))),thickness=Math.max(...extents.map(p=>Math.abs(p[1])));
  const primary=edges.toSorted((a,b)=>b.names.size-a.names.size)[0],isBar=id!=='CHI';
  if(isBar){
   const corners=node.order.filter(name=>id!=='PTB'||name!=='Northeast Regional').map(name=>positions.get(id+'|'+name));center[0]=corners.reduce((sum,p)=>sum+p[0],0)/corners.length;center[1]=corners.reduce((sum,p)=>sum+p[1],0)/corners.length;
   let bx=0,bxy=0,by=0;for(const p of corners){const x=p[0]-center[0],y=p[1]-center[1];bx+=x*x;bxy+=x*y;by+=y*y;}
   const angle=.5*Math.atan2(2*bxy,bx-by);axis=corners.length>1?[Math.cos(angle),Math.sin(angle)]:[...primary.normal];
   // A bar crosses the dominant track. Only a failed fit may rotate it;
   // never align a station enclosure along a route to squeeze dots together.
   if(!['PTB','ALB','NYP'].includes(id)){
    const first=corners[0],last=corners.at(-1),row=last.map((v,i)=>v-first[i]),rowLength=Math.hypot(...row),aligned=rowLength>1e-7&&corners.every(p=>Math.abs(row[0]*(p[1]-first[1])-row[1]*(p[0]-first[0]))/rowLength<1e-5)&&Math.abs(axis[0]*primary.normal[0]+axis[1]*primary.normal[1])>=Math.cos(Math.PI/6);
    if(primary.names.size>1&&!aligned){const normals=edges.filter(e=>e.names.size===primary.names.size).map(e=>e.normal.map(v=>e.normal[0]*primary.normal[0]+e.normal[1]*primary.normal[1]<0?-v:v)),sum=normals.reduce((s,n)=>s.map((v,i)=>v+n[i]),[0,0]),size=Math.hypot(...sum);if(size>1e-7)axis=sum.map(v=>v/size);}
    else if(primary.names.size===1){let xx=0,xy=0,yy=0;for(const edge of edges){const n=edge.normal;xx+=n[0]*n[0];xy+=n[0]*n[1];yy+=n[1]*n[1];}const a=.5*Math.atan2(2*xy,xx-yy);axis=[Math.cos(a),Math.sin(a)];}
   }
   normal=[-axis[1],axis[0]];
   const local=features.filter(f=>[f.feature.properties.from,f.feature.properties.to].includes(id)),branchBar=edges.length>=3,approachCount=branchBar?new Set(local.map(f=>(f.feature.properties.symbologyName||f.feature.properties.name)+'|'+keyFor(f.feature))).size:node.names.size;
   const evaluate=(origin,direction)=>{const perpendicular=[-direction[1],direction[0]],hits=new Map();for(const f of local){const name=f.feature.properties.symbologyName||f.feature.properties.name,target=positions.get(id+'|'+name),hitKey=branchBar?name+'|'+keyFor(f.feature):name,evalPoints=edges.length>=3?f.body:f.points;for(let i=1;i<evalPoints.length;i++){const a=evalPoints[i-1],b=evalPoints[i],da=(a[0]-origin[0])*perpendicular[0]+(a[1]-origin[1])*perpendicular[1],db=(b[0]-origin[0])*perpendicular[0]+(b[1]-origin[1])*perpendicular[1];if(Math.abs(db-da)<Math.max(1e-8,Math.hypot(b[0]-a[0],b[1]-a[1])*(id==='NYP'?.2:.5)))continue;let t=-da/(db-da);if(t>=-1e-6&&t<=1+1e-6||(edges.length>=3||new Set(local.filter(g=>(g.feature.properties.symbologyName||g.feature.properties.name)===name).map(g=>keyFor(g.feature))).size===1)&&((i===1&&f.feature.properties.from===id)||(i===evalPoints.length-1&&f.feature.properties.to===id))){const p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],distance=Math.hypot(p[0]-target[0],p[1]-target[1]);if(distance<=spacing*Math.max(3,node.names.size)&&(!hits.has(hitKey)||distance<hits.get(hitKey).distance))hits.set(hitKey,{p,distance,name});}}}let crowding=0;const entries=[...hits];for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){const [a,ha]=entries[i],[b,hb]=entries[j],pa=positions.get(id+'|'+ha.name),pb=positions.get(id+'|'+hb.name);if(ha.name===hb.name||id==='NYP'&&Math.hypot(pa[0]-pb[0],pa[1]-pb[1])<1e-6)continue;const stopDiameter=Math.max(3.4,(1.8+5.2*Math.max(0,Math.min(1,(zoom-4)/6)))*stationScale),gap=node.stopNames?.has(ha.name)&&node.stopNames?.has(hb.name)?Math.max(spacing*.8,stopDiameter):spacing*.8;crowding+=Math.max(0,gap-Math.hypot(ha.p[0]-hb.p[0],ha.p[1]-hb.p[1]));}return {origin,direction,hits,crowding,score:[...hits.values()].reduce((sum,h)=>sum+h.distance,0)+crowding*100};};
   if(id==='ALB'){const trunk=edges.find(e=>[e.from,e.to].includes('HUD')),remote=project(nodes.get('HUD').coordinate),origin=project(node.coordinate),v=[remote[0]-origin[0],remote[1]-origin[1]],size=Math.hypot(...v);axis=[...trunk.normal];normal=[-axis[1],axis[0]];center[0]=origin[0]+v[0]/size*spacing*2;center[1]=origin[1]+v[1]/size*spacing*2;}
   let fit=evaluate(center,axis);if(!['ALB','PTB','PHL'].includes(id)&&(fit.hits.size<approachCount||fit.crowding>1e-6)){const original=[...center],angle=Math.atan2(axis[1],axis[0]);for(const rotation of [0,-.1,.1,-.2,.2,-.35,.35,-.5,.5,-.7,.7,-1,1,-1.3,1.3,-Math.PI/2,Math.PI/2])for(const shift of [0,-.25,.25,-.5,.5,-1,1,-1.5,1.5,-2,2,-3,3]){const d=[Math.cos(angle+rotation),Math.sin(angle+rotation)],n=[-d[1],d[0]],trial=evaluate([original[0]+n[0]*shift*spacing,original[1]+n[1]*shift*spacing],d);trial.score+=Math.abs(rotation)*spacing+Math.abs(shift)*spacing*.2;if(trial.hits.size>fit.hits.size||trial.hits.size===fit.hits.size&&trial.score<fit.score-1e-5)fit=trial;}center[0]=fit.origin[0];center[1]=fit.origin[1];axis=fit.direction;normal=[-axis[1],axis[0]];}
   const lanes=[...fit.hits.values()].map(h=>(h.p[0]-center[0])*axis[0]+(h.p[1]-center[1])*axis[1]);
   lanes.push(...corners.map(p=>(p[0]-center[0])*axis[0]+(p[1]-center[1])*axis[1]));const low=Math.min(...lanes),high=Math.max(...lanes),mid=(low+high)/2;center[0]+=axis[0]*mid;center[1]+=axis[1]*mid;length=(high-low)/2+margin;thickness=0;
  }
  let dotAxis;
  let outline=[],shape,radius;
  if(id==='CHI'){
   shape='rounded-square';const {halfWidth:hw,halfHeight:hh,radius:r}=terminalBoxDimensions(zoom);
   for(const [x,y,start] of [[hw-r,hh-r,0],[-hw+r,hh-r,Math.PI/2],[-hw+r,-hh+r,Math.PI],[hw-r,-hh+r,3*Math.PI/2]])for(let i=0;i<=8;i++){const a=start+i*Math.PI/16;outline.push([center[0]+x+Math.cos(a)*r,center[1]+y+Math.sin(a)*r]);}
   radius=Math.max(hw,hh);
  }else if(isBar){
   shape='capsule';const r=thickness+margin;
   for(let side=0;side<2;side++)for(let i=0;i<=16;i++){const a=(side?Math.PI/2:-Math.PI/2)+i*Math.PI/16,x=(side?-length:length)+Math.cos(a)*r,y=Math.sin(a)*r;outline.push([center[0]+axis[0]*x+normal[0]*y,center[1]+axis[1]*x+normal[1]*y]);}
   radius=length+r;dotAxis=[-1,1].map(sign=>[center[0]+axis[0]*length*sign,center[1]+axis[1]*length*sign]);
  }else{
   shape='circle';radius=Math.max(...points.map(p=>Math.hypot(p[0]-center[0],p[1]-center[1])))+margin;
   if(id==='LAX')radius=Math.min(radius,spacing*3);
   outline=Array.from({length:64},(_,i)=>[center[0]+Math.cos(i*Math.PI/32)*radius,center[1]+Math.sin(i*Math.PI/32)*radius]);
  }
  outline.push(outline[0]);
  circles.push({id,portScale:id==='CHI'?8*2**Math.min(0,zoom-8.6):spacing,fixedPorts:id==='CHI'?chicagoPorts:undefined,center,stationCenter,dotAxis,passingRoutes:node.order,radius,outline,shape,layoutMode:'enclosure',routes:stops,approaches:sectors.length,branches:edges.length});
 }
 const attached=circleStations?attachOutlineStops(features,circles,positions,spacing):new Map();for(const [key,p] of attached)markers.set(key,p);
 return {positions,features,circles,markers};
}

