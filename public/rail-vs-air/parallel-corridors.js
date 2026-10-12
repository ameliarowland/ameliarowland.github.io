// Offset each shared station-to-station segment perpendicular to its own track.
// Adjacent unchanged bundles meet at their offset-line intersection (miter).
export function parallelCorridors(routes,nodes,preferred,project,spacing){
 const bundles=new Map(),incident=new Map(),keyFor=f=>[f.properties.from,f.properties.to].sort().join('|');
 for(const f of routes.features){const key=keyFor(f);if(!bundles.has(key))bundles.set(key,{names:new Set(),features:[]});const b=bundles.get(key);b.names.add(f.properties.symbologyName||f.properties.name);b.features.push(f);}
 for(const [key,bundle] of bundles){
  const [from,to]=key.split('|'),a=project(nodes.get(from).coordinate),b=project(nodes.get(to).coordinate),dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1;
  let normal=[-dy/length,dx/length];
  const names=[...bundle.names],west=names.some(n=>['Coast Starlight','Amtrak Cascades','Empire Builder'].includes(n))&&nodes.get(from).coordinate[0]<-116;
  if(west?normal[0]<0:(names.includes('Texas Eagle')&&names.includes('Sunset Limited')?normal[1]<0:normal[0]+normal[1]<0))normal=normal.map(v=>-v);
  if(names.includes('Coast Starlight')&&names.includes('Pacific Surfliner')&&normal[0]-normal[1]<0)normal=normal.map(v=>-v);
  if(names.includes('Borealis')&&names.includes('Empire Builder')&&normal[0]-normal[1]<0)normal=normal.map(v=>-v);
  const order=nodes.get(from).order.filter(n=>bundle.names.has(n));
  if(order.includes('Vermonter')&&order.includes('Acela')){const v=order.indexOf('Vermonter'),a=order.indexOf('Acela');if(normal[0]>=0?v>a:v<a){order[v]='Acela';order[a]='Vermonter';}}
  for(const [west,east] of [['Northeast Regional','Acela'],['Silver Meteor','Floridian'],['Pacific Surfliner','Southwest Chief'],['Coast Starlight','Pacific Surfliner'],['Missouri River Runner','Texas Eagle'],['Lincoln Service Missouri River Runner','Texas Eagle']])if(order.includes(west)&&order.includes(east)){const w=order.indexOf(west),e=order.indexOf(east);if(normal[0]>=0?w>e:w<e){order[w]=east;order[e]=west;}}
  if(order.includes('Maple Leaf')){const index=order.indexOf('Maple Leaf');order.splice(index,1);if(normal[1]>=0)order.unshift('Maple Leaf');else order.push('Maple Leaf');}
  if(order.includes('Pere Marquette')){const index=order.indexOf('Pere Marquette');order.splice(index,1);if(normal[1]>=0)order.unshift('Pere Marquette');else order.push('Pere Marquette');}
  for(const [below,above] of [['Capitol Limited','Floridian']])if(order.includes(below)&&order.includes(above)){
   const b=order.indexOf(below),a=order.indexOf(above);if(normal[1]>=0?b<a:b>a){order[b]=above;order[a]=below;}
  }
  const northPairs=[['Blue Water','Wolverine'],['Pennsylvanian','Floridian'],...([from,to].includes('SOB')?[['Lake Shore Limited','Floridian']]:[])];
  for(const [north,south] of northPairs)if(order.includes(north)&&order.includes(south)){const n=order.indexOf(north),s=order.indexOf(south);if(normal[1]>=0?n>s:n<s){order[n]=south;order[s]=north;}}
  if([from,to].includes('SOB')){const family=['Lake Shore Limited','Floridian','Capitol Limited'].filter(n=>order.includes(n)),slots=order.map((n,i)=>family.includes(n)?i:-1).filter(i=>i>=0);if(normal[1]<0)family.reverse();family.forEach((n,i)=>order[slots[i]]=n);}
  if(order.includes('Coast Starlight')&&order.includes('Pacific Surfliner')){const c=order.indexOf('Coast Starlight'),p=order.indexOf('Pacific Surfliner');if((normal[0]-normal[1]>=0)?c>p:c<p){order[c]='Pacific Surfliner';order[p]='Coast Starlight';}}
  if(order.includes('Borealis')&&order.includes('Empire Builder')){const b=order.indexOf('Borealis'),e=order.indexOf('Empire Builder');if(normal[0]-normal[1]>=0?b<e:b>e){order[b]='Empire Builder';order[e]='Borealis';}}
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
  for(const b of component){if(b.normal[0]*reference.normal[0]+b.normal[1]*reference.normal[1]<0)b.normal=b.normal.map(v=>-v);b.priorityNormal=reference.normal;order.forEach((name,i)=>b.lanes.set(name,(i-(order.length-1)/2)*spacing));}
 }
 const positions=new Map(preferred),joins=new Set();
 // Spread each Chicago approach across its own track direction. Preserve the
 // requested west/east group order. Keep singleton hub displacement local
 // to the approach edge; shared bundles retain their common lane origin.
 const assigned=new Set();let right=-Infinity;
 const chicago=nodes.get('CHI');
 if(chicago){const origin=project(chicago.coordinate),edges=[...(incident.get('CHI')||[])].sort((a,b)=>Math.min(...[...a.names].map(n=>chicago.order.indexOf(n)))-Math.min(...[...b.names].map(n=>chicago.order.indexOf(n))));
  for(const edge of edges){const names=chicago.order.filter(n=>edge.names.has(n)).sort((a,b)=>edge.lanes.get(a)-edge.lanes.get(b)),points=names.map(n=>preferred.get('CHI|'+n)),center=[points.reduce((s,p)=>s+p[0],0)/points.length,points.reduce((s,p)=>s+p[1],0)/points.length],half=(names.length-1)*spacing/2;
   const minimum=center[0]-Math.abs(edge.normal[0])*half;if(minimum<right+spacing*.12)center[0]+=right+spacing*.12-minimum;
   right=center[0]+Math.abs(edge.normal[0])*half;
   const base=(center[0]-origin[0])*edge.normal[0]+(center[1]-origin[1])*edge.normal[1];
   const signature=[...edge.names].sort().join(';'),queue=[edge];
   while(queue.length){const b=queue.pop();if(assigned.has(b))continue;assigned.add(b);for(const [name,d] of b.lanes)b.lanes.set(name,d+base);
    // A singleton has no parallel companion requiring a common corridor origin.
    if(edge.names.size>1)for(const id of [b.from,b.to])for(const other of incident.get(id)||[])if([...other.names].sort().join(';')===signature)queue.push(other);
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
  if(names.includes('Coast Starlight')&&names.includes('Pacific Surfliner')&&(vector[0]<0||vector[1]>0))continue;
  if(edges.length===2&&names.some(name=>Math.abs(edges[0].lanes.get(name)-edges[1].lanes.get(name))>1e-8))continue;
  const p=project(node.coordinate);
  for(const name of names){const d=edges[0].lanes.get(name);positions.set(id+'|'+name,[p[0]+vector[0]*d,p[1]+vector[1]*d]);joins.add(id+'|'+name);}
 }
 // At Hammond–Whiting each route continues through one of two branches.
 // Intersect its incoming and outgoing offset lines instead of sending all
 // three bundles through the same diagonal station row.
 for(const name of nodes.get('HMI')?.names||[]){const edges=(incident.get('HMI')||[]).filter(e=>e.names.has(name));if(edges.length!==2)continue;const [a,b]=edges,n=a.normal,m=b.normal,det=n[0]*m[1]-n[1]*m[0];if(Math.abs(det)<1e-8)continue;const d=a.lanes.get(name),e=b.lanes.get(name),p=project(nodes.get('HMI').coordinate);positions.set('HMI|'+name,[p[0]+(d*m[1]-n[1]*e)/det,p[1]+(n[0]*e-d*m[0])/det]);joins.add('HMI|'+name);}
 const features=routes.features.map(f=>{
  const bundle=bundles.get(keyFor(f)),name=f.properties.symbologyName||f.properties.name,d=bundle.lanes.get(name)||0,n=bundle.normal;
  const ids=[f.properties.from,f.properties.to],centers=ids.map(id=>project(nodes.get(id).coordinate)),anchors=ids.map(id=>positions.get(id+'|'+name));
  // Trim each parallel body at the displayed marker's longitudinal position.
  // The old center-based endpoint overshot that marker, then doubled back.
  const singleHubApproach=bundle.names.size===1&&ids.includes('CHI');
  const ends=centers.map((p,i)=>{if(singleHubApproach)return anchors[i];if(joins.has(ids[i]+'|'+name))return anchors[i];const anchor=anchors[i],correction=(anchor[0]-p[0])*n[0]+(anchor[1]-p[1])*n[1]-d;return [anchor[0]-n[0]*correction,anchor[1]-n[1]*correction];});
  for(let i=0;i<2;i++)if(Math.hypot(anchors[i][0]-ends[i][0],anchors[i][1]-ends[i][1])<1e-7)ends[i]=anchors[i];
  const points=[anchors[0]];if(Math.hypot(anchors[0][0]-ends[0][0],anchors[0][1]-ends[0][1])>1e-7)points.push(ends[0]);
  points.push(ends[1]);if(Math.hypot(anchors[1][0]-ends[1][0],anchors[1][1]-ends[1][1])>1e-7)points.push(anchors[1]);
  return {feature:f,points,body:ends,normal:n,priorityNormal:bundle.priorityNormal||n,laneOffset:d};
 });
 return {positions,features};
}
