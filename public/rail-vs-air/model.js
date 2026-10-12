export const AIRPORT_OVERHEAD = 180;
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
function smoothLaneTransitions(points,radius=24) {
  if(points.length<3)return points;
  const distance=[0],integral=[0];
  for(let i=1;i<points.length;i++) {
    const span=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);
    distance.push(distance.at(-1)+span);integral.push(integral.at(-1)+span*(points[i][2]+points[i-1][2])/2);
  }
  const total=distance.at(-1);
  function area(t) {
    if(t<=0)return 0;if(t>=total)return integral.at(-1);
    let lo=0,hi=distance.length-1;
    while(hi-lo>1){const mid=(lo+hi)>>1;if(distance[mid]<=t)lo=mid;else hi=mid;}
    const span=distance[hi]-distance[lo],x=t-distance[lo],a=points[lo][2],b=points[hi][2];
    return integral[lo]+a*x+(span?(b-a)*x*x/(2*span):0);
  }
  return points.map((p,i)=>{
    const lo=Math.max(0,distance[i]-radius),hi=Math.min(total,distance[i]+radius);
    return [p[0],p[1],hi>lo?(area(hi)-area(lo))/(hi-lo):p[2]];
  });
}
export function routeDrawingStyle(collection,zoom) {
  const nominal=zoom<=3?3.5:zoom<7?3.5+(zoom-3)/4*2:zoom<11?5.5+(zoom-7)/4*1.5:7;
  const maxLane=Math.max(1,...collection.features.map(f=>Math.abs(f.properties.lane||0)));
  const cap=16+Math.max(0,zoom-12)*12;
  const spacing=1.5*Math.min(nominal,cap/maxLane);
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
export function offsetNetwork(collection, zoom, drawingStyle=routeDrawingStyle(collection,zoom)) {
  const world=512*2**zoom;
  const project=p=>[(p[0]+180)/360*world,(1-Math.log(Math.tan(Math.PI/4+p[1]*Math.PI/360))/Math.PI)/2*world];
  const unproject=p=>[p[0]/world*360-180,Math.atan(Math.sinh(Math.PI*(1-2*p[1]/world)))*180/Math.PI];
  const spacing=drawingStyle.spacing;
  const tangentRadius=Math.max(4,spacing*Math.max(1,...collection.features.map(f=>Math.abs(f.properties.lane||0))));
  const features=continuousRoutePaths(collection).features.map(f=>{
    const lanes=f.properties.edgeLanes;
    const projected=f.geometry.coordinates.map((p,i)=>{
      const xy=project(p),lane=i===0?lanes[0]:i===lanes.length?lanes.at(-1):(lanes[i-1]+lanes[i])/2;
      return [...xy,lane];
    });
    // Shared centerlines were simplified together by the data builder. Do not
    // independently simplify each service: different retained bend vertices
    // would give neighboring lanes different normals and make them weave.
    const points=projected.filter((p,i,all)=>i===0||Math.hypot(p[0]-all[i-1][0],p[1]-all[i-1][1])>1e-7);
    if(points.length<2)return f;
    const path=smoothLaneTransitions(points);
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
      const amount=p[2]*spacing;return [p[0]-dy/len*amount,p[1]+dx/len*amount];
    });
    return {...f,geometry:{type:'LineString',coordinates:shifted.map(unproject)}};
  });
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
  for(const group of ends.values()) {
    // Pair a through continuation at branches without imposing contradictory
    // all-pairs parity constraints on the diverging arms.
    const pairs=[];
    for(let i=0;i<group.length;i++)for(let j=i+1;j<group.length;j++) {
      const a=group[i],b=group[j];if(a.index!==b.index)pairs.push({a,b,bundle:Math.min(a.shared,b.shared),dot:a.out[0]*b.out[0]+a.out[1]*b.out[1]});
    }
    pairs.sort((a,b)=>b.bundle-a.bundle||a.dot-b.dot);
    const paired=new Set();
    for(const {a,b} of pairs){
      if(paired.has(a)||paired.has(b))continue;
      link(a.index,b.index,a.side===b.side?-1:1);paired.add(a);paired.add(b);
    }
  }
  // Anchor each component to its first stored frame for stable redraws.
  const anchor=new Map();
  for(let i=0;i<n;i++){const [root,s]=find(i);if(!anchor.has(root))anchor.set(root,s);}
  return {type:'FeatureCollection',features:collection.features.map((f,i)=>{
    const [root,s]=find(i);return {...f,properties:{...f.properties,lane:(f.properties.lane||0)*s*anchor.get(root)}};
  })};
}
