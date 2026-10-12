export const AIRPORT_OVERHEAD = 180;
export const stationRouteName=name=>name==='Lincol Service Missouri River Runner'?'Lincoln Service Missouri River Runner':name;
export function delta(record) { return record.railMinutes - record.flightMinutes - AIRPORT_OVERHEAD; }
export function qualifies(record, tolerance) { return delta(record) <= tolerance; }
export function duration(minutes) { const n = Math.round(minutes); return `${Math.floor(n / 60)}h ${String(n % 60).padStart(2, '0')}m`; }
const coordinateKey = point => point.map(v => v.toFixed(7)).join(',');
function edgeKey(a,b) { const x=coordinateKey(a),y=coordinateKey(b); return x<y ? [x+'|'+y,1] : [y+'|'+x,-1]; }
function corridorDirections(edges, pointsByKey) {
  const adjacency=new Map(), continuation=new Map(), unused=new Set(edges.keys()), result=new Map();
  for(const key of edges.keys()) {
    const [a,b]=key.split('|');
    if(!adjacency.has(a))adjacency.set(a,[]);if(!adjacency.has(b))adjacency.set(b,[]);
    adjacency.get(a).push(b);adjacency.get(b).push(a);
  }
  for(const [v,ns] of adjacency) {
    const remaining=new Set(ns),p=pointsByKey.get(v);
    while(remaining.size>=2) {
      const sorted=[...remaining].sort();let best=null;
      for(let i=0;i<sorted.length;i++)for(let j=i+1;j<sorted.length;j++) {
        const a=pointsByKey.get(sorted[i]),b=pointsByKey.get(sorted[j]);
        const ax=a[0]-p[0],ay=a[1]-p[1],bx=b[0]-p[0],by=b[1]-p[1];
        const cosine=(ax*bx+ay*by)/Math.hypot(ax,ay)/Math.hypot(bx,by);
        if(!best||cosine<best[0])best=[cosine,sorted[i],sorted[j]];
      }
      if(!best||(ns.length>2&&best[0]>-.25))break;
      const [,a,b]=best;continuation.set(v+'|'+a,b);continuation.set(v+'|'+b,a);remaining.delete(a);remaining.delete(b);
    }
  }
  const keyFor=(a,b)=>a<b?a+'|'+b:b+'|'+a;
  function walk(a,b) {
    const path=[a,b];unused.delete(keyFor(a,b));
    while(continuation.has(b+'|'+a)) {
      const c=continuation.get(b+'|'+a),key=keyFor(b,c);
      if(!unused.has(key))break;unused.delete(key);path.push(c);a=b;b=c;
    }
    if(path[0]>path.at(-1))path.reverse();
    for(let i=0;i<path.length-1;i++)result.set(keyFor(path[i],path[i+1]),path[i]<path[i+1]?1:-1);
  }
  const starts=[];
  for(const [v,ns] of adjacency)for(const n of ns)if(!continuation.has(v+'|'+n))starts.push([v,n]);
  starts.sort((a,b)=>(a[0]+'|'+a[1]).localeCompare(b[0]+'|'+b[1]));
  for(const [a,b] of starts)if(unused.has(keyFor(a,b)))walk(a,b);
  while(unused.size){const [a,b]=unused.values().next().value.split('|');walk(a,b);}
  return result;
}
function networkReference(network) {
  const grid=new Map(),cell=.05;
  for(const f of network?.features||[]) {
    const points=f.geometry.coordinates;
    for(let i=0;i<points.length-1;i++) {
      const a=points[i],b=points[i+1],entry={a,b,lane:f.properties.lane};
      for(let x=Math.floor(Math.min(a[0],b[0])/cell);x<=Math.floor(Math.max(a[0],b[0])/cell);x++)
      for(let y=Math.floor(Math.min(a[1],b[1])/cell);y<=Math.floor(Math.max(a[1],b[1])/cell);y++) {
        const key=f.properties.name+'|'+x+'|'+y;
        if(!grid.has(key))grid.set(key,[]);grid.get(key).push(entry);
      }
    }
  }
  return (name,a,b)=>{
    const p=[(a[0]+b[0])/2,(a[1]+b[1])/2],gx=Math.floor(p[0]/cell),gy=Math.floor(p[1]/cell),cos=Math.cos(p[1]*Math.PI/180);
    let best=null,dist=.015**2;
    for(let x=gx-1;x<=gx+1;x++)for(let y=gy-1;y<=gy+1;y++)for(const ref of grid.get(name+'|'+x+'|'+y)||[]) {
      const dx=(ref.b[0]-ref.a[0])*cos,dy=ref.b[1]-ref.a[1],den=dx*dx+dy*dy;
      if(!den)continue;
      const t=Math.max(0,Math.min(1,((p[0]-ref.a[0])*cos*dx+(p[1]-ref.a[1])*dy)/den));
      const d=((p[0]-ref.a[0])*cos-t*dx)**2+(p[1]-ref.a[1]-t*dy)**2;
      if(d<dist) {
        dist=d;const dot=(b[0]-a[0])*cos*dx+(b[1]-a[1])*dy;
        best=ref.lane*(dot>=0?1:-1);
      }
    }
    return best;
  };
}
export function prepareLanes(records, shapes, network=null) {
  const services=new Map(),edges=new Map(),pointsByKey=new Map();
  for(const r of records) {
    if(!r.shapeId || !shapes[r.shapeId])continue;
    if(!services.has(r.shapeId))services.set(r.shapeId,new Set());
    services.get(r.shapeId).add(r.ntadName||r.route);
  }
  for(const [sid,names] of services) {
    const points=shapes[sid];
    for(let i=0;i<points.length-1;i++) {
      const [key]=edgeKey(points[i],points[i+1]);
      pointsByKey.set(coordinateKey(points[i]),points[i]);pointsByKey.set(coordinateKey(points[i+1]),points[i+1]);
      if(!edges.has(key))edges.set(key,new Set());
      for(const name of names)edges.get(key).add(name);
    }
  }
  const directions=corridorDirections(edges,pointsByKey),reference=networkReference(network),lanes=new Map();
  let matched=0,total=0;
  for(const [sid,names] of services)for(const name of names) {
    const points=shapes[sid],values=[];
    for(let i=0;i<points.length-1;i++) {
      const [key,sign]=edgeKey(points[i],points[i+1]),list=[...edges.get(key)].sort();
      const base=network?reference(name,points[i],points[i+1]):null;
      if(base!==null)matched++;total++;
      values.push(base!==null?base:(list.indexOf(name)-(list.length-1)/2)*sign*directions.get(key));
    }
    lanes.set(sid+'|'+name,values);
  }
  lanes.stats={referenceMatches:matched,edges:total};
  return lanes;
}
export function mergedHighlights(records, shapes, color, lanes=new Map()) {
  const groups = new Map();
  for (const r of records) {
    if (!r.shapeRange || !shapes[r.shapeId]) continue;
    const key = `${r.shapeId}|${r.route}`;
    if (!groups.has(key)) groups.set(key, {shapeId:r.shapeId, route:r.route, ntadName:r.ntadName, intervals:[]});
    groups.get(key).intervals.push(r.shapeRange);
  }
  const features = [];
  for (const g of groups.values()) {
    g.intervals.sort((a,b)=>a[0]-b[0]);
    const merged=[];
    for (const [a,b] of g.intervals) {
      const last=merged.at(-1);
      if (last && a <= last[1]) last[1]=Math.max(last[1],b); else merged.push([a,b]);
    }
    for (const [a,b] of merged) {
      const values=lanes.get(g.shapeId+'|'+(g.ntadName||g.route))||[];
      let start=a;
      for(let i=a+1;i<=b;i++) {
        if(i===b || (values[i]||0)!==(values[start]||0)) {
          features.push({type:'Feature',properties:{route:g.route,color:color(g.ntadName||g.route),lane:values[start]||0},geometry:{type:'LineString',coordinates:shapes[g.shapeId].slice(start,i+1)}});
          start=i;
        }
      }
    }
  }
  return {type:'FeatureCollection',features};
}

// Render qualifying coverage on the base network's exact path and lane. Timetable
// shapes identify covered sections; they do not add a second competing centerline.
export function networkHighlights(records, shapes, network, color) {
  if(!network)return {type:'FeatureCollection',features:[]};
  const nameByService=new Map(records.map(r=>[r.route,r.ntadName||r.route]));
  const coverage=mergedHighlights(records,shapes,color),grid=new Map(),cell=.025;
  for(const f of coverage.features) {
    const name=nameByService.get(f.properties.route),points=f.geometry.coordinates;
    for(let i=0;i<points.length-1;i++) {
      const a=points[i],b=points[i+1];
      for(let x=Math.floor(Math.min(a[0],b[0])/cell);x<=Math.floor(Math.max(a[0],b[0])/cell);x++)
      for(let y=Math.floor(Math.min(a[1],b[1])/cell);y<=Math.floor(Math.max(a[1],b[1])/cell);y++) {
        const key=name+'|'+x+'|'+y;
        if(!grid.has(key))grid.set(key,[]);grid.get(key).push([a,b]);
      }
    }
  }
  function covered(name,a,b) {
    const p=[(a[0]+b[0])/2,(a[1]+b[1])/2],cos=Math.cos(p[1]*Math.PI/180),gx=Math.floor(p[0]/cell),gy=Math.floor(p[1]/cell);
    for(let x=gx-1;x<=gx+1;x++)for(let y=gy-1;y<=gy+1;y++)for(const [u,v] of grid.get(name+'|'+x+'|'+y)||[]) {
      const dx=(v[0]-u[0])*cos,dy=v[1]-u[1],den=dx*dx+dy*dy;
      if(!den)continue;
      const t=Math.max(0,Math.min(1,((p[0]-u[0])*cos*dx+(p[1]-u[1])*dy)/den));
      if(Math.hypot((p[0]-u[0])*cos-t*dx,p[1]-u[1]-t*dy)*111.32<=.75)return true;
    }
    return false;
  }
  const features=[];
  for(const f of network.features) {
    // Bound coverage classification to short sections without changing the path.
    const original=f.geometry.coordinates,points=[original[0]],name=f.properties.name;let start=null;
    for(let j=0;j<original.length-1;j++) {
      const a=original[j],b=original[j+1],cos=Math.cos((a[1]+b[1])*Math.PI/360);
      const steps=Math.max(1,Math.ceil(Math.hypot((b[0]-a[0])*cos,b[1]-a[1])*111.32/.5));
      for(let k=1;k<=steps;k++)points.push(k===steps?b:[a[0]+(b[0]-a[0])*k/steps,a[1]+(b[1]-a[1])*k/steps]);
    }
    for(let i=0;i<points.length-1;i++) {
      const yes=covered(name,points[i],points[i+1]);
      if(yes&&start===null)start=i;
      if(start!==null&&(!yes||i===points.length-2)) {
        const end=yes?i+1:i;
        features.push({type:'Feature',properties:{...f.properties,route:name,color:color(name)},geometry:{type:'LineString',coordinates:points.slice(start,end+1)}});
        start=null;
      }
    }
  }
  return {type:'FeatureCollection',features};
}

// Compute perpendicular offsets on continuous paths using smoothed tangents.
// Remove self-loops created by screen-space offsets, preserving source loops
// and every station anchor. The underlying railway geometry stays unchanged.
function removeOffsetLoops(shifted,source,protectedVertices) {
 const crossing=(a,b,c,d)=>{
  const rx=b[0]-a[0],ry=b[1]-a[1],sx=d[0]-c[0],sy=d[1]-c[1],den=rx*sy-ry*sx;
  if(Math.abs(den)<1e-9)return null;
  const t=((c[0]-a[0])*sy-(c[1]-a[1])*sx)/den,u=((c[0]-a[0])*ry-(c[1]-a[1])*rx)/den;
  return t>1e-7&&t<1-1e-7&&u>1e-7&&u<1-1e-7?[a[0]+t*rx,a[1]+t*ry]:null;
 };
 let entries=shifted.map((point,index)=>({point,index}));
 for(let pass=0;pass<10;pass++) {
  let cut=false;
  // An inside offset can double back without forming a closed loop. Replace
  // that non-station spike with the intersection of its adjacent offset rays.
  for(let i=2;i<entries.length-1;i++) {
    const before=entries[i-1],after=entries[i];
    if(!Number.isInteger(before.index)||!Number.isInteger(after.index)||protectedVertices.has(before.index)||protectedVertices.has(after.index))continue;
    const a=source[before.index],b=source[after.index],vx=after.point[0]-before.point[0],vy=after.point[1]-before.point[1];
    if(vx*(b[0]-a[0])+vy*(b[1]-a[1])>=-1e-7)continue;
    const p=entries[i-2].point,q=before.point,r=after.point,s=entries[i+1].point,rx=q[0]-p[0],ry=q[1]-p[1],sx=s[0]-r[0],sy=s[1]-r[1],den=rx*sy-ry*sx;
    if(Math.abs(den)<1e-8)continue;
    const t=((r[0]-p[0])*sy-(r[1]-p[1])*sx)/den,u=((r[0]-p[0])*ry-(r[1]-p[1])*rx)/den;
    if(u>1&&protectedVertices.has(entries[i+1].index)) {
      // The offset corner would overshoot its next stop. Simplify the two
      // non-station vertices and connect to the preserved stop anchor directly.
      entries=[...entries.slice(0,i-1),...entries.slice(i+1)];cut=true;break;
    }
    if(t<0||u>1)continue;
    const point=[p[0]+t*rx,p[1]+t*ry],limit=Math.max(8,Math.hypot(after.point[0]-b[0],after.point[1]-b[1])*4);
    if(Math.hypot(point[0]-r[0],point[1]-r[1])>limit)continue;
    entries=[...entries.slice(0,i-1),{point,index:null},...entries.slice(i+1)];cut=true;break;
  }
  if(cut)continue;
  outer:for(let i=0;i<entries.length-3;i++)for(let j=i+2;j<entries.length-1;j++) {
   const point=crossing(entries[i].point,entries[i+1].point,entries[j].point,entries[j+1].point);if(!point)continue;
   if(entries.slice(i+1,j+1).some(e=>protectedVertices.has(e.index)))continue;
   const a=entries[i].index,b=entries[i+1].index,c=entries[j].index,d=entries[j+1].index;
   if([a,b,c,d].every(Number.isInteger)&&crossing(source[a],source[b],source[c],source[d]))continue;
   entries=[...entries.slice(0,i+1),{point,index:null},...entries.slice(j+1)];cut=true;break outer;
  }
  if(!cut)break;
 }
 return entries.map(e=>e.point);
}
export function routeDrawingStyle(collection,zoom) {
  const nominal=zoom<=3?3.5:zoom<7?3.5+(zoom-3)/4*2:zoom<11?5.5+(zoom-7)/4*1.5:7+Math.max(0,Math.min(5,zoom-11));
  const maxLane=Math.max(1,...collection.features.map(f=>Math.abs(f.properties.lane||0)));
  const cap=zoom<=6?16:zoom<7?16+(zoom-6)*32:zoom<=12?48+(zoom-7)*12:108+(zoom-12)*60;
  const spacing=Math.max(6,1.5*Math.min(nominal,cap/maxLane));
  return {spacing,baseWidth:Math.min(zoom<7?3.75:4.8,spacing*.78),highlightWidth:Math.min(zoom<7?5.25:6.3,spacing*.95)};
}
export function continuousRoutePaths(collection) {
  const endpoints=new Map(),links=new Map(),used=new Set(),features=[];
  collection.features.forEach((f,index)=>{
    const p=f.geometry.coordinates;
    for(const side of [0,1]) {
      const a=p[side?p.length-1:0],b=p[side?p.length-2:1],key=(f.properties.name||f.properties.route)+'|'+a.map(v=>v.toFixed(7)).join(',');
      const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(!len)continue;
      if(!endpoints.has(key))endpoints.set(key,[]);
      endpoints.get(key).push({index,side,out:[dx/len,dy/len],shared:f.properties.shared||1});
    }
  });
  for(const ends of endpoints.values()) {
    const pairs=[];
    for(let i=0;i<ends.length;i++)for(let j=i+1;j<ends.length;j++) {
      const a=ends[i],b=ends[j];if(a.index!==b.index)pairs.push({a,b,bundle:Math.min(a.shared,b.shared),dot:a.out[0]*b.out[0]+a.out[1]*b.out[1]});
    }
    pairs.sort((a,b)=>b.bundle-a.bundle||a.dot-b.dot);
    for(const {a,b} of pairs) {
      const ak=a.index+':'+a.side,bk=b.index+':'+b.side;
      if(links.has(ak)||links.has(bk))continue;links.set(ak,b);links.set(bk,a);
    }
  }
  function walk(index,side) {
    const first=collection.features[index],coordinates=[],edgeLanes=[];
    while(!used.has(index)) {
      const f=collection.features[index],p=side?[...f.geometry.coordinates].reverse():f.geometry.coordinates,lane=(f.properties.lane||0)*(side?-1:1);
      if(!coordinates.length)coordinates.push(p[0]);coordinates.push(...p.slice(1));
      edgeLanes.push(...Array(p.length-1).fill(lane));used.add(index);
      const next=links.get(index+':'+(1-side));if(!next||used.has(next.index))break;index=next.index;side=next.side;
    }
    features.push({type:'Feature',properties:{...first.properties,edgeLanes},geometry:{type:'LineString',coordinates}});
  }
  collection.features.forEach((f,index)=>{
    for(const side of [0,1])if(!used.has(index)&&!links.has(index+':'+side))walk(index,side);
  });
  collection.features.forEach((f,index)=>{if(!used.has(index))walk(index,0);});
  return {type:'FeatureCollection',features};
}
const stationAnchorCache=new WeakMap();
// Insert station projections into their source track segments, once, and share
// those anchors with every route using that edge. Offsets still retain their
// separate lanes; anchoring does not pinch a bundle into one station point.
export function anchorStationGeometry(collection,stations) {
  if(!stations)return collection;
  const cached=stationAnchorCache.get(collection);
  if(cached?.stations===stations)return cached.result;
  const grid=new Map(),cell=.05,anchors=new Map(),keys=new Set(),stationAnchorAssociations=[];
  for(const f of collection.features) {
    const name=stationRouteName(f.properties.symbologyName||f.properties.name),p=f.geometry.coordinates;
    for(let i=1;i<p.length;i++) {
      const a=p[i-1],b=p[i],entry={a,b,name};
      for(let x=Math.floor(Math.min(a[0],b[0])/cell);x<=Math.floor(Math.max(a[0],b[0])/cell);x++)for(let y=Math.floor(Math.min(a[1],b[1])/cell);y<=Math.floor(Math.max(a[1],b[1])/cell);y++) {
        const key=x+','+y;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(entry);
      }
    }
  }
  for(const station of stations.features) {
    const p=station.geometry.coordinates,names=new Set(station.properties.routeNames||[]),best=new Map(),cos=Math.cos(p[1]*Math.PI/180),gx=Math.floor(p[0]/cell),gy=Math.floor(p[1]/cell);
    for(let x=gx-1;x<=gx+1;x++)for(let y=gy-1;y<=gy+1;y++)for(const e of grid.get(x+','+y)||[]) {
      if(!names.has(e.name))continue;
      const dx=(e.b[0]-e.a[0])*cos,dy=e.b[1]-e.a[1],den=dx*dx+dy*dy;if(!den)continue;
      const t=Math.max(0,Math.min(1,((p[0]-e.a[0])*cos*dx+(p[1]-e.a[1])*dy)/den));
      const distance=Math.hypot((p[0]-e.a[0])*cos-t*dx,p[1]-e.a[1]-t*dy)*111320;
      if(distance<=750&&(!best.has(e.name)||distance<best.get(e.name).distance))best.set(e.name,{...e,t,distance});
    }
    for(const e of best.values()) {
      const [key,sign]=edgeKey(e.a,e.b),point=[e.a[0]+e.t*(e.b[0]-e.a[0]),e.a[1]+e.t*(e.b[1]-e.a[1])].map(v=>Number(v.toFixed(7)));
      keys.add(coordinateKey(point));
      stationAnchorAssociations.push({Code:station.properties.Code,name:e.name,key:coordinateKey(point)});
      if(e.t<1e-6||e.t>1-1e-6)continue;
      if(!anchors.has(key))anchors.set(key,new Map());anchors.get(key).set(coordinateKey(point),{point,t:sign===1?e.t:1-e.t});
    }
  }
  const result={type:'FeatureCollection',stationAnchorKeys:[...keys],stationAnchorAssociations,features:collection.features.map(f=>{
    const p=f.geometry.coordinates,coordinates=[p[0]];
    for(let i=1;i<p.length;i++) {
      const [key,sign]=edgeKey(p[i-1],p[i]);
      const additions=[...(anchors.get(key)?.values()||[])].sort((a,b)=>sign*(a.t-b.t));
      for(const {point} of additions)if(coordinateKey(point)!==coordinateKey(coordinates.at(-1))&&coordinateKey(point)!==coordinateKey(p[i]))coordinates.push(point);
      coordinates.push(p[i]);
    }
    return {...f,geometry:{type:'LineString',coordinates}};
  })};
  stationAnchorCache.set(collection,{stations,result});return result;
}
// Union retained vertices across services so a shared source vertex is either
// kept for every route or removed for every route. Country overviews permit
// 3 pixels of generalization; zoom 13 restores detail. Station anchors are fixed.
export function simplifyDisplayGeometry(collection,zoom) {
  const tolerance=zoom<=4?3:zoom<7?3-(zoom-4)*.6:zoom<10?1.2-(zoom-7)*.85/3:zoom<13?.35*(13-zoom)/3:0;
  if(!tolerance)return collection;
  const world=512*2**zoom,keep=new Set(collection.stationAnchorKeys||[]);
  const project=p=>[(p[0]+180)/360*world,(1-Math.log(Math.tan(Math.PI/4+p[1]*Math.PI/360))/Math.PI)/2*world];
  for(const f of collection.features) {
    const p=f.geometry.coordinates,xy=p.map(project),breaks=[0,...p.map((point,i)=>keep.has(coordinateKey(point))?i:-1).filter(i=>i>0&&i<p.length-1),p.length-1],stack=breaks.slice(1).map((hi,i)=>[breaks[i],hi]);
    keep.add(coordinateKey(p[0]));keep.add(coordinateKey(p.at(-1)));
    while(stack.length) {
      const [lo,hi]=stack.pop(),a=xy[lo],b=xy[hi],dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
      let index=lo,max=tolerance*tolerance;
      for(let j=lo+1;j<hi;j++) {
        const t=den?Math.max(0,Math.min(1,((xy[j][0]-a[0])*dx+(xy[j][1]-a[1])*dy)/den)):0;
        const d=(xy[j][0]-a[0]-t*dx)**2+(xy[j][1]-a[1]-t*dy)**2;
        if(d>max){max=d;index=j;}
      }
      if(index!==lo){keep.add(coordinateKey(p[index]));stack.push([lo,index],[index,hi]);}
    }
  }
  return {type:'FeatureCollection',features:collection.features.map(f=>({...f,geometry:{type:'LineString',coordinates:f.geometry.coordinates.filter(p=>keep.has(coordinateKey(p)))}}))};
}
export function offsetNetwork(collection, zoom, drawingStyle=routeDrawingStyle(collection,zoom), stations=null) {
  const world=512*2**zoom;
  const project=p=>[(p[0]+180)/360*world,(1-Math.log(Math.tan(Math.PI/4+p[1]*Math.PI/360))/Math.PI)/2*world];
  const unproject=p=>[p[0]/world*360-180,Math.atan(Math.sinh(Math.PI*(1-2*p[1]/world)))*180/Math.PI];
  const spacing=drawingStyle.spacing;
  const tangentRadius=Math.max(4,spacing*Math.max(1,...collection.features.map(f=>Math.abs(f.properties.lane||0))));
  const anchored=anchorStationGeometry(collection,stations);
  const associations=new Map();
  for(const a of anchored.stationAnchorAssociations||[]) {
    const key=a.name+'|'+a.key;if(!associations.has(key))associations.set(key,[]);associations.get(key).push(a.Code);
  }
  const sourcePaths=continuousRoutePaths(simplifyDisplayGeometry(anchored,zoom));
  // Use one through-corridor tangent for every coincident centerline vertex.
  // Service-specific terminal tangents otherwise pull neighboring lanes inward.
  const support=new Map(),tangents=new Map();
  for(const f of sourcePaths.features) {
    const p=f.geometry.coordinates;
    for(let i=1;i<p.length;i++){const [key]=edgeKey(p[i-1],p[i]);support.set(key,(support.get(key)||0)+1);}
  }
  for(const f of sourcePaths.features) {
    const coordinates=f.geometry.coordinates,p=coordinates.map(project),distance=[0];
    for(let i=1;i<p.length;i++)distance.push(distance.at(-1)+Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]));
    const at=t=>{
      if(t<=0)return p[0];if(t>=distance.at(-1))return p.at(-1);
      let lo=0,hi=distance.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(distance[m]<=t)lo=m;else hi=m;}
      const span=distance[hi]-distance[lo],u=span?(t-distance[lo])/span:0;return [p[lo][0]+(p[hi][0]-p[lo][0])*u,p[lo][1]+(p[hi][1]-p[lo][1])*u];
    };
    for(let i=0;i<p.length;i++) {
      const a=at(distance[i]-tangentRadius),b=at(distance[i]+tangentRadius),dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);if(!length)continue;
      const left=i?(support.get(edgeKey(coordinates[i-1],coordinates[i])[0])||0):0;
      const right=i+1<p.length?(support.get(edgeKey(coordinates[i],coordinates[i+1])[0])||0):0;
      const quality=Math.min(left,right)*1000+Math.min(distance[i],distance.at(-1)-distance[i],tangentRadius);
      const key=coordinateKey(coordinates[i]);if(!tangents.has(key)||quality>tangents.get(key).quality)tangents.set(key,{dx:dx/length,dy:dy/length,quality});
    }
  }
  const sourcePositions=sourcePaths.features.map(()=>new Map());
  const features=sourcePaths.features.map((f,featureIndex)=>{
    const lanes=f.properties.edgeLanes;
    const projected=f.geometry.coordinates.map((p,i)=>{
      const xy=project(p);let lane;
      if(i===0)lane=lanes[0];else if(i===lanes.length)lane=lanes.at(-1);
      else {
        const previous=support.get(edgeKey(f.geometry.coordinates[i-1],p)[0])||0;
        const next=support.get(edgeKey(p,f.geometry.coordinates[i+1])[0])||0;
        // Keep the full wider bundle at the join. Averaging its lane with a
        // smaller outgoing bundle pinches lines before the station/branch.
        lane=previous>next?lanes[i-1]:next>previous?lanes[i]:(lanes[i-1]+lanes[i])/2;
      }
      return [...xy,lane];
    });
    // Translate an entire joining/leaving bundle gradually, retaining its
    // internal lane spacing and the wider bundle's full slots at the junction.
    const stationDistance=[0];
    for(let i=1;i<projected.length;i++)stationDistance.push(stationDistance.at(-1)+Math.hypot(projected[i][0]-projected[i-1][0],projected[i][1]-projected[i-1][1]));
    for(let i=1;i<projected.length-1;i++) {
      const p=f.geometry.coordinates,left=support.get(edgeKey(p[i-1],p[i])[0])||0,right=support.get(edgeKey(p[i],p[i+1])[0])||0;
      if(left===right||lanes[i]===lanes[i-1])continue;
      const delta=lanes[i]-lanes[i-1],window=Math.max(tangentRadius*2,Math.abs(delta)*spacing*4);
      if(right>left) {
        for(let j=i-1;j>=0&&stationDistance[i]-stationDistance[j]<window;j--) {
          if(j<i-1&&(support.get(edgeKey(p[j],p[j+1])[0])||0)!==left)break;
          const t=1-(stationDistance[i]-stationDistance[j])/window;projected[j][2]+=delta*t*t*(3-2*t);
        }
      } else {
        for(let j=i+1;j<projected.length&&stationDistance[j]-stationDistance[i]<window;j++) {
          if(j>i+1&&(support.get(edgeKey(p[j-1],p[j])[0])||0)!==right)break;
          const t=1-(stationDistance[j]-stationDistance[i])/window;projected[j][2]-=delta*t*t*(3-2*t);
        }
      }
    }
    // Shared centerlines were simplified together by the data builder. Do not
    // independently simplify each service: different retained bend vertices
    // would give neighboring lanes different normals and make them weave.
    const points=projected.filter((p,i,all)=>i===0||Math.hypot(p[0]-all[i-1][0],p[1]-all[i-1][1])>1e-7);
    if(points.length<2)return f;
    // Lane slots remain fixed at their shared source/station vertices.
    // Averaging across a junction compresses the entire bundle before stops.
    const path=points;
    // Estimate one tangent over a bundle-sized window. Sharp source vertices
    // otherwise create inside-out offset corners when the bundle is wider than
    // the local bend radius. Keep every lane at its full perpendicular distance.
    const distances=[0];
    for(let i=1;i<path.length;i++)distances.push(distances.at(-1)+Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]));
    function at(t) {
      if(t<=0)return path[0];if(t>=distances.at(-1))return path.at(-1);
      let lo=0,hi=distances.length-1;
      while(hi-lo>1){const mid=(lo+hi)>>1;if(distances[mid]<=t)lo=mid;else hi=mid;}
      const f=(t-distances[lo])/(distances[hi]-distances[lo]);
      return [path[lo][0]+(path[hi][0]-path[lo][0])*f,path[lo][1]+(path[hi][1]-path[lo][1])*f];
    }
    const radius=tangentRadius;
    const shifted=path.map((p,i)=>{
      const a=at(distances[i]-radius),b=at(distances[i]+radius);
      let dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
      if(len<1e-7){const q=path[Math.min(i+1,path.length-1)],r=path[Math.max(0,i-1)];dx=q[0]-r[0];dy=q[1]-r[1];len=Math.hypot(dx,dy)||1;}
      const shared=tangents.get(coordinateKey(unproject(p)));
      if(shared){
        // Determine direction from the actual local source segment. A wide
        // tangent window can face the other way around a sharp city approach.
        const before=path[Math.max(0,i-1)],after=path[Math.min(path.length-1,i+1)];
        const left=i?(support.get(edgeKey(unproject(before),unproject(p))[0])||0):0;
        const right=i+1<path.length?(support.get(edgeKey(unproject(p),unproject(after))[0])||0):0;
        const local=left>right?[p[0]-before[0],p[1]-before[1]]:right>left?[after[0]-p[0],after[1]-p[1]]:[after[0]-before[0],after[1]-before[1]];
        const direction=local[0]*shared.dx+local[1]*shared.dy>=0?1:-1;
        dx=shared.dx*direction;dy=shared.dy*direction;len=1;
      }
      const amount=p[2]*spacing;return [p[0]-dy/len*amount,p[1]+dx/len*amount];
    });
    const stationPositions=[],protectedVertices=new Set();
    const name=stationRouteName(f.properties.symbologyName||f.properties.name);
    for(let i=0;i<path.length;i++) {
      const key=coordinateKey(unproject(path[i]));
      sourcePositions[featureIndex].set(key,unproject(shifted[i]));
      const codes=associations.get(name+'|'+key)||[];
      if(codes.length)protectedVertices.add(i);
      for(const Code of codes)stationPositions.push({Code,name,coordinates:unproject(shifted[i])});
    }
    return {...f,properties:{...f.properties,stationPositions},geometry:{type:'LineString',coordinates:removeOffsetLoops(shifted,path,protectedVertices).map(unproject)}};
  });
  // At a true same-service branch, join the offset branch to that service's
  // through lane. A short quadratic transition removes floating caps and kinks.
  const through=new Map();
  sourcePaths.features.forEach((f,index)=>{
    const p=f.geometry.coordinates;
    for(let i=1;i<p.length-1;i++)through.set((f.properties.name||f.properties.route)+'|'+coordinateKey(p[i]),{index,point:sourcePositions[index].get(coordinateKey(p[i]))});
  });
  sourcePaths.features.forEach((f,index)=>{
    for(const side of [0,1]) {
      const source=f.geometry.coordinates,key=(f.properties.name||f.properties.route)+'|'+coordinateKey(source[side?source.length-1:0]),join=through.get(key);
      if(!join||join.index===index)continue;
      const coordinates=features[index].geometry.coordinates;
      const oriented=side?coordinates:[...coordinates].reverse();
      if(oriented.length<2)continue;
      // Clip the Philadelphia west approach where it actually meets its offset
      // through lane. The source join can sit beyond the outer displayed lane.
      if(['Pennsylvanian','Keystone Service'].includes(f.properties.name)&&source.some(p=>p[0]===-75.198326&&p[1]===39.9720475)) {
        const main=features[join.index].geometry.coordinates.map(project),branch=oriented.map(project),target=project(join.point);
        let crossing=null;
        for(let j=Math.max(1,branch.length-12);j<branch.length&&!crossing;j++) {
          const a=branch[j-1],b=branch[j],rx=b[0]-a[0],ry=b[1]-a[1];
          for(let k=1;k<main.length;k++) {
            const c=main[k-1],d=main[k],sx=d[0]-c[0],sy=d[1]-c[1],den=rx*sy-ry*sx;
            if(Math.abs(den)<1e-8)continue;
            const t=((c[0]-a[0])*sy-(c[1]-a[1])*sx)/den,u=((c[0]-a[0])*ry-(c[1]-a[1])*rx)/den;
            if(t<0||t>1||u<0||u>1)continue;
            const point=[a[0]+t*rx,a[1]+t*ry];
            if(Math.hypot(point[0]-target[0],point[1]-target[1])<=spacing*12){crossing={j,point};break;}
          }
        }
        if(crossing) {
          const clipped=[...oriented.slice(0,crossing.j),unproject(crossing.point)];
          features[index].geometry.coordinates=side?clipped:clipped.reverse();continue;
        }
      }
      const end=project(oriented.at(-1)),prior=project(oriented.at(-2)),target=project(join.point),span=Math.hypot(end[0]-prior[0],end[1]-prior[1]);
      if(!span||Math.hypot(target[0]-end[0],target[1]-end[1])>spacing*12)continue;
      const gap=Math.hypot(target[0]-end[0],target[1]-end[1]);
      const ratio=Math.min(1,Math.max(24,spacing*2,gap*2.5)/span),start=[end[0]+(prior[0]-end[0])*ratio,end[1]+(prior[1]-end[1])*ratio];
      const incoming=[(end[0]-prior[0])/span,(end[1]-prior[1])/span];
      const forward=Math.max(0,(target[0]-start[0])*incoming[0]+(target[1]-start[1])*incoming[1]);
      const control=[start[0]+incoming[0]*forward*.5,start[1]+incoming[1]*forward*.5];
      const curve=[];
      for(let i=0;i<=8;i++) {const t=i/8,u=1-t;curve.push(unproject([u*u*start[0]+2*u*t*control[0]+t*t*target[0],u*u*start[1]+2*u*t*control[1]+t*t*target[1]]));}
      const joined=[...oriented.slice(0,-1),...curve];
      features[index].geometry.coordinates=side?joined:joined.reverse();
    }
  });
  if(stations) {
    const phl={type:'FeatureCollection',features:stations.features.filter(f=>f.properties.Code==='PHL')};
    const displayed={type:'FeatureCollection',features};
    const dots=stationSymbols(phl,collection,displayed,zoom,drawingStyle).dots.features;
    sourcePaths.features.forEach((source,index)=>{
      const name=source.properties.name;if(!['Pennsylvanian','Keystone Service'].includes(name))return;
      const p=source.geometry.coordinates;
      const stationEnd=[p[0],p.at(-1)].map(q=>q[0]>-75.184&&q[0]<-75.18&&q[1]>39.955&&q[1]<39.956);
      if(!stationEnd.some(Boolean))return;
      const dot=dots.find(f=>f.properties.symbolRoutes.includes(name));if(!dot)return;
      const q=project(dot.geometry.coordinates),line=features[index].geometry.coordinates;let best=null;
      for(let i=1;i<line.length;i++) {
        const a=project(line[i-1]),b=project(line[i]),dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
        if(!den)continue;const t=Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/den));
        const distance=Math.hypot(q[0]-a[0]-t*dx,q[1]-a[1]-t*dy);
        if(!best||distance<best.distance)best={i,distance};
      }
      if(best&&best.distance<.001)features[index].geometry.coordinates=stationEnd[0]?[dot.geometry.coordinates,...line.slice(best.i)]:[...line.slice(0,best.i),dot.geometry.coordinates];
    });
  }
  return {type:'FeatureCollection',features};
}

// Keep the lane frame consistent across section boundaries, even when the source
// stores both adjoining sections toward (or away from) their common endpoint.
export function alignLaneFrames(collection) {
  const n=collection.features.length,parent=Array.from({length:n},(_,i)=>i),sign=Array(n).fill(1),rank=Array(n).fill(0);
  function find(i){if(parent[i]===i)return [i,1];const [root,s]=find(parent[i]);sign[i]*=s;parent[i]=root;return [root,sign[i]];}
  function link(a,b,relation){
    const [ra,sa]=find(a),[rb,sb]=find(b);if(ra===rb)return;
    const parity=relation*sa*sb;
    if(rank[ra]<rank[rb]){parent[ra]=rb;sign[ra]=parity;}
    else{parent[rb]=ra;sign[rb]=parity;if(rank[ra]===rank[rb])rank[ra]++;}
  }
  const point=p=>p.map(v=>v.toFixed(7)).join(','),edges=new Map(),ends=new Map();
  collection.features.forEach((f,index)=>{
    const p=f.geometry.coordinates;
    for(let j=0;j<p.length-1;j++) {
      const a=point(p[j]),b=point(p[j+1]);if(a===b)continue;
      const key=a<b?a+'|'+b:b+'|'+a,direction=a<b?1:-1;
      if(edges.has(key)){const prior=edges.get(key);link(prior.index,index,prior.direction*direction);}
      else edges.set(key,{index,direction});
    }
    for(const side of [0,1]) {
      const a=p[side?p.length-1:0],b=p[side?p.length-2:1];
      const key=(f.properties.name||f.properties.route)+'|'+point(a),dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
      if(!len)continue;
      if(!ends.has(key))ends.set(key,[]);ends.get(key).push({index,side,out:[dx/len,dy/len],shared:f.properties.shared||1});
    }
  });
  // Geographic lane priorities anchor the shared corridor orientation.
  const priorities=collection.features.map((f,index)=>({f,index}))
    .filter(({f})=>Number.isFinite(f.properties.lanePriority)&&f.properties.lane!==0)
    .sort((a,b)=>a.f.properties.lanePriority-b.f.properties.lanePriority);
  const continuations=[];
  for(const group of ends.values()) {
    const pairs=[];
    for(let i=0;i<group.length;i++)for(let j=i+1;j<group.length;j++) {
      const a=group[i],b=group[j];if(a.index!==b.index)pairs.push({a,b,bundle:Math.min(a.shared,b.shared),dot:a.out[0]*b.out[0]+a.out[1]*b.out[1]});
    }
    pairs.sort((a,b)=>b.bundle-a.bundle||a.dot-b.dot);
    const paired=new Set();
    for(const pair of pairs){
      if(paired.has(pair.a)||paired.has(pair.b))continue;
      continuations.push(pair);paired.add(pair.a);paired.add(pair.b);
    }
  }
  // Resolve the strongest through corridors before branch constraints. A branch
  // must never reverse the entire shared bundle at a station approach.
  continuations.sort((a,b)=>b.bundle-a.bundle||a.dot-b.dot);
  for(const {a,b} of continuations) {
    // A lone centered line has no lane order to propagate to another bundle.
    if((a.shared<=1&&collection.features[a.index].properties.lane===0)||(b.shared<=1&&collection.features[b.index].properties.lane===0))continue;
    link(a.index,b.index,a.side===b.side?-1:1);
  }
  // Anchor priority corridors first; other components retain their stored frame.
  const anchor=new Map();
  for(const {f,index} of priorities) {
    const [root,s]=find(index),p=f.geometry.coordinates;
    if(!anchor.has(root))anchor.set(root,s*(p.at(-1)[0]>=p[0][0]?1:-1));
  }
  for(let i=0;i<n;i++){const [root,s]=find(i);if(!anchor.has(root))anchor.set(root,s);}
  const features=collection.features.map((f,i)=>{
    const [root,s]=find(i);return {...f,properties:{...f.properties,lane:(f.properties.lane||0)*s*anchor.get(root)}};
  });
  // Apply explicit geographic priorities after resolving through-path direction.
  // Reorder lanes locally instead of forcing unrelated branch frames to reverse.
  const bundles=new Map();
  for(const f of features) {
    const key=JSON.stringify(f.geometry.coordinates);
    if(!bundles.has(key))bundles.set(key,[]);bundles.get(key).push(f);
  }
  for(const bundle of bundles.values()) {
    if(!bundle.some(f=>Number.isFinite(f.properties.lanePriority)||Number.isFinite(f.properties.laneSouthPriority)))continue;
    const p=bundle[0].geometry.coordinates;
    let direction=p.at(-1)[0]>=p[0][0]?1:-1;
    // The Philadelphia approach bends back west before reaching the station.
    // Preserve its through-corridor frame rather than reordering at each bend.
    if(p.every(q=>q[0]>-75.201&&q[0]<-75.175&&q[1]>=39.9516&&q[1]<=39.97806)) {
      const reference=bundle.find(f=>f.properties.name==='Acela')||bundle.find(f=>f.properties.lane!==0);
      if(reference) {
        const original=collection.features[features.indexOf(reference)].properties.lane;
        if(original)direction=Math.sign(reference.properties.lane/original);
      }
    }
    const values=[...new Set(bundle.map(f=>f.properties.lane*direction))].sort((a,b)=>a-b);
    const symbols=new Map();
    for(const f of bundle) {
      const name=f.properties.symbologyName||f.properties.name;
      if(!symbols.has(name))symbols.set(name,{name,lane:f.properties.lane*direction,priority:f.properties.lanePriority??Infinity,south:f.properties.laneSouthPriority??Infinity});
    }
    const manhattan=['Adirondack','Empire Service','Ethan Allen Express','Lake Shore Limited','Maple Leaf'];
    const newYork=p.every(q=>q[0]>=-74.0021&&q[0]<=-73.99&&q[1]>=40.749&&q[1]<=40.755);
    if(newYork)for(const symbol of symbols.values()) {
      const index=manhattan.indexOf(symbol.name);
      symbol.priority=index>=0?index:(symbol.priority===Infinity?Infinity:manhattan.length+symbol.priority);
    }
    const ordered=[...symbols.values()].sort((a,b)=>Number.isFinite(a.south)-Number.isFinite(b.south)||(Number.isFinite(a.south)&&Number.isFinite(b.south)?a.south-b.south:a.priority-b.priority||a.lane-b.lane));
    for(const f of bundle)f.properties.lane=values[ordered.findIndex(s=>s.name===(f.properties.symbologyName||f.properties.name))]*direction;
  }
  return {type:'FeatureCollection',features};
}

// Timetable service membership determines eligibility; geometry only positions
// the symbol. Passing routes do not create a multi-service station.
export function stationSymbols(stations, network, displayed, zoom, style, activeRoutes=null) {
  const world=512*2**zoom;
  const project=p=>[(p[0]+180)/360*world,(1-Math.log(Math.tan(Math.PI/4+p[1]*Math.PI/360))/Math.PI)/2*world];
  const unproject=p=>[p[0]/world*360-180,Math.atan(Math.sinh(Math.PI*(1-2*p[1]/world)))*180/Math.PI];
  const maxOffset=style.spacing*Math.max(1,...network.features.map(f=>Math.abs(f.properties.lane||0)));
  function index(collection,screen=false) {
    const cell=screen?2*maxOffset+16:.025;
    const grid=new Map();
    for(const f of collection.features)for(let i=1;i<f.geometry.coordinates.length;i++) {
      const u=f.geometry.coordinates[i-1],v=f.geometry.coordinates[i],a=project(u),b=project(v),dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
      if(!length)continue;
      const entry={a,b,dx,dy,length,name:stationRouteName(f.properties.symbologyName||f.properties.name),originalName:f.properties.name,color:f.properties.color||'#ffffff'};
      const first=screen?a:u,last=screen?b:v;
      for(let x=Math.floor(Math.min(first[0],last[0])/cell);x<=Math.floor(Math.max(first[0],last[0])/cell);x++)for(let y=Math.floor(Math.min(first[1],last[1])/cell);y<=Math.floor(Math.max(first[1],last[1])/cell);y++) {
        const key=x+','+y;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(entry);
      }
    }
    return p=>{
      const q=screen?project(p):p,result=new Set(),gx=Math.floor(q[0]/cell),gy=Math.floor(q[1]/cell);
      for(let x=gx-1;x<=gx+1;x++)for(let y=gy-1;y<=gy+1;y++)for(const e of grid.get(x+','+y)||[])result.add(e);
      return result;
    };
  }
  const sourceNear=index(network),displayNear=index(displayed,zoom<9),dots=[],passes=[];
  const known=activeRoutes||new Set(stations.features.flatMap(f=>f.properties.routeNames||[]));
  const colorByRoute=new Map(network.features.map(f=>[stationRouteName(f.properties.symbologyName||f.properties.name),f.properties.color||'#ffffff']));
  const anchoredStops=new Map();
  for(const f of displayed.features)for(const stop of f.properties.stationPositions||[])anchoredStops.set(stop.Code+'|'+stop.name,stop.coordinates);
  for(const station of stations.features) {
    const names=new Set(station.properties.routeNames||[]);
    const coordinate=station.geometry.coordinates,p=project(coordinate);
    // NTAD stations and tracks can differ slightly. Keep the association within
    // 750 m and require an actual stopping service's named route.
    const metersPerPixel=40075016.686*Math.cos(coordinate[1]*Math.PI/180)/world;
    function stopProperties(name,color) {
      const ringWidth=Math.min(1.8,.75+Math.max(0,zoom-3)*.08,style.spacing*.18);
      const radius=Math.max(2,Math.min(4.8,1.7+Math.max(0,zoom-3)*.26,style.spacing*.5-ringWidth));
      return {...station.properties,symbolRoutes:[name],stopStatus:'stop',color,radius,ringWidth};
    }
    for(const name of names) {
      const point=anchoredStops.get(station.properties.Code+'|'+name);
      if(point)dots.push({type:'Feature',properties:stopProperties(name,colorByRoute.get(name)||'#ffffff'),geometry:{type:'Point',coordinates:point}});
    }
    let best=null,distance=750/metersPerPixel;
    for(const e of sourceNear(coordinate)) {
      if(names.size?!names.has(e.name):!known.has(e.name))continue;
      const t=Math.max(0,Math.min(1,((p[0]-e.a[0])*e.dx+(p[1]-e.a[1])*e.dy)/(e.length*e.length)));
      const q=[e.a[0]+t*e.dx,e.a[1]+t*e.dy],d=Math.hypot(q[0]-p[0],q[1]-p[1]);
      if(d<distance){distance=d;best={q,tangent:[e.dx/e.length,e.dy/e.length]};}
    }
    if(!best){for(const name of names)if(!anchoredStops.has(station.properties.Code+'|'+name))dots.push({type:'Feature',properties:{...stopProperties(name,colorByRoute.get(name)||'#ffffff'),geometryFallback:true},geometry:{type:'Point',coordinates:coordinate}});continue;}
    const {q,tangent}=best,normal=[-tangent[1],tangent[0]],crossings=new Map();
    // Restrict the span to the physical track corridor. At small zooms an
    // unrelated branch may also cross the same screen-space perpendicular.
    const bundleNames=new Set();
    for(const e of sourceNear(unproject(q))) {
      if(Math.abs((e.dx*tangent[0]+e.dy*tangent[1])/e.length)<.7)continue;
      const t=Math.max(0,Math.min(1,((q[0]-e.a[0])*e.dx+(q[1]-e.a[1])*e.dy)/(e.length*e.length)));
      if(Math.hypot(e.a[0]+t*e.dx-q[0],e.a[1]+t*e.dy-q[1])*metersPerPixel<=75)bundleNames.add(e.name);
    }
    for(const e of displayNear(unproject(q))) {
      // Span all parallel visible lanes in this bundle, including passing lines.
      if(!bundleNames.has(e.name))continue;
      // Do not classify an unmatched legacy source route as an operating
      // passing service merely because it shares another route’s symbology.
      if(!names.has(e.name)&&!known.has(e.originalName))continue;
      const alongA=(e.a[0]-q[0])*tangent[0]+(e.a[1]-q[1])*tangent[1];
      const alongB=(e.b[0]-q[0])*tangent[0]+(e.b[1]-q[1])*tangent[1];
      if(alongA*alongB>0||Math.abs(alongB-alongA)<1e-7)continue;
      const t=-alongA/(alongB-alongA),x=e.a[0]+t*e.dx,y=e.a[1]+t*e.dy;
      const across=(x-q[0])*normal[0]+(y-q[1])*normal[1];
      if(Math.abs(across)>maxOffset+style.spacing*2)continue;
      if(!crossings.has(e.name)||Math.abs(across)<Math.abs(crossings.get(e.name).value))crossings.set(e.name,{value:across,point:[x,y],normal:[-e.dy/e.length,e.dx/e.length],color:e.color});
    }
    for(const [name,crossing] of crossings) {
      if(names.has(name)&&!anchoredStops.has(station.properties.Code+'|'+name))dots.push({type:'Feature',properties:stopProperties(name,crossing.color),geometry:{type:'Point',coordinates:unproject(crossing.point)}});
      else if(!names.has(name)&&known.has(name)) {
        const {point,normal}=crossing,half=style.highlightWidth/2;
        passes.push({type:'Feature',properties:{...station.properties,symbolRoutes:[name],stopStatus:'no-stop'},geometry:{type:'LineString',coordinates:[unproject([point[0]-normal[0]*half,point[1]-normal[1]*half]),unproject([point[0]+normal[0]*half,point[1]+normal[1]*half])]}});
      }
    }
    // If a curved/terminal lane does not cross the local perpendicular, retain
    // its real scheduled stop as a dot on its nearest displayed route segment.
    const shown=new Set(dots.filter(f=>f.properties.Code===station.properties.Code).flatMap(f=>f.properties.symbolRoutes||[]));
    for(const name of names) {
      if(shown.has(name))continue;
      let nearest=null,nearestColor='#ffffff',limit=750/metersPerPixel+maxOffset;
      // Terminal/platform branches need their own station association. They
      // may lie outside the narrow through-track bundle but still serve this
      // exact GTFS stop. Use the same 750 m source association limit.
      for(const e of displayNear(coordinate)) {
        if(e.name!==name)continue;
        const t=Math.max(0,Math.min(1,((p[0]-e.a[0])*e.dx+(p[1]-e.a[1])*e.dy)/(e.length*e.length)));
        const point=[e.a[0]+t*e.dx,e.a[1]+t*e.dy],d=Math.hypot(point[0]-p[0],point[1]-p[1]);
        if(d<limit){limit=d;nearest=point;nearestColor=e.color;}
      }
      dots.push({type:'Feature',properties:{...stopProperties(name,nearest?nearestColor:colorByRoute.get(name)||'#ffffff'),geometryFallback:!nearest},geometry:{type:'Point',coordinates:nearest?unproject(nearest):coordinate}});
    }
  }
  return {dots:{type:'FeatureCollection',features:dots},passes:{type:'FeatureCollection',features:passes}};
}

