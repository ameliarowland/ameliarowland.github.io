// Final geometry owns branch transitions and their stop positions together.
// A solitary branch inherits its corridor's offset, then tapers it over a
// distance at least four times that offset instead of snapping to center.
export function finalizeLayout(result,stations){
 result={...result,interchanges:{...result.interchanges,features:result.interchanges.features.map(f=>({...f,properties:{...f.properties},geometry:{...f.geometry}}))}};
 const world=512*2**result.zoom,project=p=>[(p[0]+180)/360*world,(1-Math.log(Math.tan(Math.PI/4+p[1]*Math.PI/360))/Math.PI)/2*world],unproject=p=>[p[0]/world*360-180,Math.atan(Math.sinh(Math.PI*(1-2*p[1]/world)))*180/Math.PI],centers=new Map(stations.features.map(f=>[f.properties.Code,project(f.geometry.coordinates)])),features=result.displayed.features.map(f=>({...f,properties:{...f.properties},geometry:{...f.geometry,coordinates:f.geometry.coordinates.map(p=>[...p])}})),pair=f=>[f.properties.from,f.properties.to].sort().join('|'),groups=Map.groupBy(features,pair),names=new Map(),incident=new Map(),moved=new Map(),visited=new Set();
 const name=f=>f.properties.symbologyName||f.properties.name,other=(f,code)=>f.properties.from===code?f.properties.to:f.properties.from,index=(f,code)=>f.properties.from===code?0:f.geometry.coordinates.length-1,point=(f,code)=>project(f.geometry.coordinates[index(f,code)]);
 for(const f of features)for(const code of [f.properties.from,f.properties.to]){if(!names.has(code)){names.set(code,new Set());incident.set(code,[]);}names.get(code).add(name(f));incident.get(code).push(f);}
 const solitary=code=>names.get(code)?.size===1&&incident.get(code)?.length===2&&centers.has(code),single=f=>new Set(groups.get(pair(f)).map(name)).size===1&&!f.properties.corridorBundle;
 for(const first of features){if(!single(first)||visited.has(first.properties.edgeId))continue;const start=[first.properties.from,first.properties.to].find(code=>!solitary(code));if(!start||!centers.has(start))continue;
  const chain=[],codes=[start];let edge=first,code=start;
  while(edge&&single(edge)&&!visited.has(edge.properties.edgeId)){visited.add(edge.properties.edgeId);const next=other(edge,code);chain.push(edge);codes.push(next);if(!solitary(next))break;edge=incident.get(next).find(f=>f!==edge);code=next;}
  if(chain.length<2||!codes.every(code=>centers.has(code)))continue;
  const end=codes.at(-1),a=point(chain[0],start),b=point(chain.at(-1),end),offsetA=a.map((v,i)=>v-centers.get(start)[i]),offsetB=b.map((v,i)=>v-centers.get(end)[i]),fadeA=4*Math.hypot(...offsetA),fadeB=4*Math.hypot(...offsetB),distances=[0];for(let i=1;i<codes.length;i++)distances.push(distances.at(-1)+Math.hypot(...centers.get(codes[i]).map((v,j)=>v-centers.get(codes[i-1])[j])));const total=distances.at(-1);
  for(let i=1;i<codes.length-1;i++){const fromStart=distances[i],fromEnd=total-fromStart,wa=fadeA?Math.max(0,1-fromStart/fadeA):0,wb=fadeB?Math.max(0,1-fromEnd/fadeB):0,normalizer=Math.max(1,wa+wb),target=centers.get(codes[i]).map((v,j)=>v+(offsetA[j]*wa+offsetB[j]*wb)/normalizer),old=point(chain[i-1],codes[i]);if(Math.hypot(...target.map((v,j)=>v-old[j]))<1e-6)continue;moved.set(codes[i]+'|'+name(first),unproject(target));}
 }
 // Give each route/station pair one shared vertex. A hub enclosure is
 // the deliberate exception: different approaches attach to its border.
 const boxes=new Set(result.interchanges.features.filter(f=>f.properties.shape==='rounded-square').map(f=>f.properties.Code)),jointSamples=new Map(),joints=new Map();
 const sample=(key,p)=>{if(!jointSamples.has(key))jointSamples.set(key,[]);jointSamples.get(key).push(project(p));};
 for(const dot of result.dots.features)for(const n of dot.properties.symbolRoutes)sample(dot.properties.Code+'|'+n,moved.get(dot.properties.Code+'|'+n)||dot.geometry.coordinates);
 for(const [key,points]of jointSamples)joints.set(key,unproject([0,1].map(i=>points.reduce((sum,p)=>sum+p[i],0)/points.length)));
 for(const f of features)for(const code of [f.properties.from,f.properties.to]){const key=code+'|'+name(f);if(!joints.has(key))joints.set(key,f.geometry.coordinates[index(f,code)]);}

 // Treat the combined corridor as one physical lane, including its joins.
 // Its first few stations inherit the end offset instead of snapping back
 // toward geography and forming the Washington hook at intermediate zooms.
 const core=result.bundle.features,coreIncident=new Map(),coreSamples=new Map(),coreJoints=new Map(),coreNames=new Map(),bands=new Map();
 for(const f of features)for(const code of [f.properties.from,f.properties.to]){if(!bands.has(code))bands.set(code,new Set());bands.get(code).add(f.properties.corridorBundle?'combined-corridor':name(f));}
 for(const f of core)for(const code of [f.properties.from,f.properties.to]){if(!coreIncident.has(code)){coreIncident.set(code,[]);coreSamples.set(code,[]);coreNames.set(code,new Set());}coreIncident.get(code).push(f);coreSamples.get(code).push(point(f,code));for(const n of f.properties.bundleMembers)coreNames.get(code).add(n);}
 for(const [code,points]of coreSamples)coreJoints.set(code,unproject([0,1].map(i=>points.reduce((sum,p)=>sum+p[i],0)/points.length)));
 const coreSeen=new Set(),coreSolo=code=>!boxes.has(code)&&bands.get(code)?.size===1&&coreIncident.get(code)?.length===2;
 for(const first of core){const key=pair(first);if(coreSeen.has(key))continue;const start=[first.properties.from,first.properties.to].find(code=>!coreSolo(code));if(!start||!centers.has(start))continue;const edges=[],codes=[start];let edge=first,code=start;
  while(edge&&!coreSeen.has(pair(edge))){coreSeen.add(pair(edge));const next=other(edge,code);edges.push(edge);codes.push(next);if(!coreSolo(next))break;edge=coreIncident.get(next).find(f=>f!==edge);code=next;}
  if(edges.length<2||!codes.every(code=>centers.has(code)))continue;
  const end=codes.at(-1),offsetA=project(coreJoints.get(start)).map((v,i)=>v-centers.get(start)[i]),offsetB=project(coreJoints.get(end)).map((v,i)=>v-centers.get(end)[i]),fadeA=4*Math.hypot(...offsetA),fadeB=4*Math.hypot(...offsetB),distances=[0];for(let i=1;i<codes.length;i++)distances.push(distances.at(-1)+Math.hypot(...centers.get(codes[i]).map((v,j)=>v-centers.get(codes[i-1])[j])));const total=distances.at(-1);
  for(let i=1;i<codes.length-1;i++){const wa=fadeA?Math.max(0,1-distances[i]/fadeA):0,wb=fadeB?Math.max(0,1-(total-distances[i])/fadeB):0,scale=Math.max(1,wa+wb);coreJoints.set(codes[i],unproject(centers.get(codes[i]).map((v,j)=>v+(offsetA[j]*wa+offsetB[j]*wb)/scale)));}
 }
 for(const [code,names]of coreNames)if(!boxes.has(code))for(const n of names)joints.set(code+'|'+n,coreJoints.get(code));
 // Pack branching services into the same regular row as the main corridor.
 // Extending each approach to a bar independently can leave a terminal
 // route well outside the other services' station vertices.
 let stationRowsPacked=0;
 for(const [code,edges]of incident){
  if(boxes.has(code)||coreJoints.has(code)||!centers.has(code)||result.overviewApproachStations?.includes(code))continue;
  const families=Map.groupBy(edges,pair),primary=[...families.values()].toSorted((a,b)=>new Set(b.map(name)).size-new Set(a.map(name)).size)[0],trunk=[...new Set(primary.map(name))],all=[...names.get(code)];
  if(trunk.length<2||trunk.length===all.length)continue;
  const samples=trunk.map(n=>project(joints.get(code+'|'+n)));let ends=[samples[0],samples[0]],span=0;
  for(const a of samples)for(const b of samples){const length=Math.hypot(...b.map((v,i)=>v-a[i]));if(length>span){ends=[a,b];span=length;}}
  if(span<1e-6)continue;
  const axis=ends[1].map((v,i)=>(v-ends[0][i])/span),along=p=>p.reduce((sum,v,i)=>sum+(v-ends[0][i])*axis[i],0),order=all.toSorted((a,b)=>along(project(joints.get(code+'|'+a)))-along(project(joints.get(code+'|'+b))));
  const nearest=Math.min(...edges.map(f=>centers.has(other(f,code))?Math.hypot(...centers.get(other(f,code)).map((v,i)=>v-centers.get(code)[i])):Infinity)),spacing=result.zoom<5?Math.min(result.style.laneSpacing,nearest*.24):result.style.laneSpacing,origins=trunk.map(n=>project(joints.get(code+'|'+n)).map((v,i)=>v-axis[i]*(order.indexOf(n)-(order.length-1)/2)*spacing)),center=[0,1].map(i=>origins.reduce((sum,p)=>sum+p[i],0)/origins.length);
  const row=order.map((n,i)=>{const p=center.map((v,j)=>v+axis[j]*(i-(order.length-1)/2)*spacing);joints.set(code+'|'+n,unproject(p));return p;});stationRowsPacked++;
  for(const symbol of result.interchanges.features.filter(f=>f.properties.Code===code&&f.properties.shape==='capsule')){
   const half=(order.length-1)*spacing/2,radius=Math.max(.7,result.style.stationScale),normal=[-axis[1],axis[0]],outline=[];
   for(let side=0;side<2;side++)for(let i=0;i<=16;i++){const angle=(side?Math.PI/2:-Math.PI/2)+i*Math.PI/16,x=(side?-half:half)+Math.cos(angle)*radius,y=Math.sin(angle)*radius;outline.push(unproject(center.map((v,j)=>v+axis[j]*x+normal[j]*y)));}outline.push(outline[0]);symbol.geometry={...symbol.geometry,coordinates:outline};symbol.properties={...symbol.properties,center:unproject(center),radiusPixels:half+radius,dotAxis:[unproject(row[0]),unproject(row.at(-1))]};
  }
 }
 // Shared approaches own their perpendicular lane spacing. A fixed diagonal
 // station row measures distance along the row and can squeeze wide strokes
 // together. Intersect the two dominant offset tracks instead; a diverging
 // service uses that same bend row on its shared approach.
 let corridorRowsAligned=0;
 for(const [code,edges]of incident){
  if(boxes.has(code)||coreJoints.has(code)||!centers.has(code)||result.overviewApproachStations?.includes(code))continue;
  // Bay Area services already use a dedicated compass-ordered frame.
  if(names.get(code).has('Capitol Corridor')||['HMI','NBU','SOB'].includes(code))continue;
  const families=[...Map.groupBy(edges,pair).values()].toSorted((a,b)=>new Set(b.map(name)).size-new Set(a.map(name)).size),a=families[0],b=families[1];
  if(!b||new Set(a.map(name)).size<2||new Set(a.map(name)).size!==names.get(code).size)continue;
  const shared=[...new Set(a.map(name))].filter(n=>b.some(f=>name(f)===n));if(shared.length<2)continue;
  const normal=group=>{const f=group[0];return f.properties.bodyNormal;},n=normal(a),m=normal(b),det=n[0]*m[1]-n[1]*m[0];
  if(Math.abs(det)<1e-7)continue;
  const ordered=[...names.get(code)].toSorted((x,y)=>a.find(f=>name(f)===x).properties.perpendicularOffset-a.find(f=>name(f)===y).properties.perpendicularOffset),sign=n[0]*m[0]+n[1]*m[1]>=0?1:-1,secondary=ordered.filter(route=>shared.includes(route)),centerAt=centers.get(code);
  const line=(group,route,axis)=>{const order=group===a?ordered:secondary,slot=order.indexOf(route)-(order.length-1)/2;return centerAt[0]*axis[0]+centerAt[1]*axis[1]+slot*result.style.laneSpacing*(group===a?1:sign);};
  const targets=new Map();
  for(const route of shared){const d=line(a,route,n),e=line(b,route,m);if(d===null||e===null)continue;targets.set(route,[(d*m[1]-n[1]*e)/det,(n[0]*e-d*m[0])/det]);}
  if(targets.size<2)continue;
  const row=[...targets.values()],origin=row[0],axis=row.at(-1).map((v,i)=>v-origin[i]),length=Math.hypot(...axis),center=centers.get(code);
  if(length<1e-7||row.some(p=>Math.hypot(...p.map((v,i)=>v-center[i]))>result.style.laneSpacing*Math.max(5,names.get(code).size)*2))continue;
  const divisor=axis[0]*n[0]+axis[1]*n[1];if(Math.abs(divisor)<1e-7)continue;
  for(const route of names.get(code)){if(!targets.has(route)){const d=line(a,route,n),t=(d-origin[0]*n[0]-origin[1]*n[1])/divisor;targets.set(route,origin.map((v,i)=>v+axis[i]*t));}}
  // Preserve explicit compass ordering when a sharp junction cannot use
  // a common miter row without reversing those services.
  const west=targets.get('Capitol Corridor'),east=targets.get('California Zephyr');if(west&&east&&west[0]>=east[0])continue;
  for(const [route,point]of targets)joints.set(code+'|'+route,unproject(point));
  const points=[...targets.values()].toSorted((p,q)=>(p[0]-q[0])*axis[0]+(p[1]-q[1])*axis[1]),first=points[0],last=points.at(-1),span=Math.hypot(...last.map((v,i)=>v-first[i])),unit=last.map((v,i)=>(v-first[i])/span),middle=first.map((v,i)=>(v+last[i])/2),radius=Math.max(.7,result.style.stationScale);
  for(const symbol of result.interchanges.features.filter(f=>f.properties.Code===code&&f.properties.shape==='capsule')){const outline=[],normal=[-unit[1],unit[0]];for(let side=0;side<2;side++)for(let i=0;i<=16;i++){const angle=(side?Math.PI/2:-Math.PI/2)+i*Math.PI/16,x=(side?-span/2:span/2)+Math.cos(angle)*radius,y=Math.sin(angle)*radius;outline.push(unproject(middle.map((v,j)=>v+unit[j]*x+normal[j]*y)));}outline.push(outline[0]);symbol.geometry={...symbol.geometry,coordinates:outline};symbol.properties={...symbol.properties,center:unproject(middle),radiusPixels:span/2+radius,dotAxis:[unproject(first),unproject(last)]};}
  corridorRowsAligned++;
 }
 // A close pair of stations must share one lane frame. Independent bend
 // rows can exceed the short source edge and reverse it into a visible hook.
 // Carry the dominant outside approach through the pair, retaining both stops.
 for(const family of groups.values()){
  const from=family[0].properties.from,to=family[0].properties.to,a=centers.get(from),b=centers.get(to);if(!a||!b||[from,to].some(code=>boxes.has(code)||coreJoints.has(code)))continue;
  const delta=b.map((v,i)=>v-a[i]),distance=Math.hypot(...delta),spacing=result.style.laneSpacing;if(result.zoom<5||names.get(from).has('Capitol Corridor')||names.get(to).has('Capitol Corridor')||distance>=spacing*3||new Set(family.map(name)).size<2)continue;
  const reversed=family.some(f=>{const u=project(joints.get(from+'|'+name(f))),v=project(joints.get(to+'|'+name(f)));return (v[0]-u[0])*delta[0]+(v[1]-u[1])*delta[1]<0;});if(!reversed)continue;
  const outside=[...incident.get(from),...incident.get(to)].filter(f=>pair(f)!==pair(family[0])&&centers.has(f.properties.from)&&centers.has(f.properties.to)).toSorted((f,g)=>{const length=e=>Math.hypot(...centers.get(e.properties.to).map((v,i)=>v-centers.get(e.properties.from)[i]));return length(g)-length(f);})[0];if(!outside)continue;
  let axis=centers.get(outside.properties.to).map((v,i)=>v-centers.get(outside.properties.from)[i]),length=Math.hypot(...axis);axis=axis.map(v=>v/length);if(axis[0]*delta[0]+axis[1]*delta[1]<0)axis=axis.map(v=>-v);
  const normal=[-axis[1],axis[0]],center=a.map((v,i)=>(v+b[i])/2),order=[...new Set(family.map(name))].toSorted((x,y)=>{const midpoint=n=>project(joints.get(from+'|'+n)).map((v,i)=>(v+project(joints.get(to+'|'+n))[i])/2),p=midpoint(x),q=midpoint(y);return (p[0]-q[0])*normal[0]+(p[1]-q[1])*normal[1];}),half=Math.max(.05,Math.abs(axis[0]*delta[0]+axis[1]*delta[1])/2);
  for(const [i,route]of order.entries())for(const [code,sign]of [[from,-1],[to,1]])joints.set(code+'|'+route,unproject(center.map((v,j)=>v+normal[j]*(i-(order.length-1)/2)*spacing+axis[j]*half*sign)));
 }
 // A terminating branch may not cross a continuing route to reach a
 // packed station row. Shorten its own offset track before that crossing.
 const cross=(a,b)=>a[0]*b[1]-a[1]*b[0],crosses=(a,b,c,d)=>{const v=b.map((x,i)=>x-a[i]),w=d.map((x,i)=>x-c[i]),det=cross(v,w);if(Math.abs(det)<1e-8)return false;const delta=c.map((x,i)=>x-a[i]),t=cross(delta,w)/det,u=cross(delta,v)/det;return t>1e-7&&t<1-1e-7&&u>1e-7&&u<1-1e-7;};
 for(const [code,edges]of incident){if(boxes.has(code)||coreJoints.has(code)||!centers.has(code))continue;
  for(const route of names.get(code)){const own=edges.filter(f=>name(f)===route);if(own.length!==1)continue;const edge=own[0],neighbor=other(edge,code),remote=project(joints.get(neighbor+'|'+route)),old=project(joints.get(code+'|'+route)),others=edges.filter(f=>name(f)!==route),blocked=point=>others.some(f=>crosses(point,remote,project(joints.get(code+'|'+name(f))),project(joints.get(other(f,code)+'|'+name(f)))));if(!blocked(old))continue;
   const normal=edge.properties.bodyNormal,center=centers.get(code),d=edge.properties.perpendicularOffset,base=center.map((v,i)=>v+normal[i]*d),vector=remote.map((v,i)=>v-base[i]),length=Math.hypot(...vector),axis=vector.map(v=>v/length);
   for(let step=0;step<24;step++){const point=base.map((v,i)=>v+axis[i]*step*result.style.laneSpacing);if(step*result.style.laneSpacing>=length*.8)break;const clear=others.every(f=>{const a=project(joints.get(code+'|'+name(f))),b=project(joints.get(other(f,code)+'|'+name(f))),v=b.map((x,i)=>x-a[i]),length=v[0]**2+v[1]**2,t=length?Math.max(0,Math.min(1,((point[0]-a[0])*v[0]+(point[1]-a[1])*v[1])/length)):0;return Math.hypot(...point.map((x,i)=>x-a[i]-v[i]*t))>=result.style.laneSpacing-.01;});if(!blocked(point)&&clear){joints.set(code+'|'+route,unproject(point));break;}}
  }
 }
 // Alexandria sits close to the Washington enclosure at overview zooms.
 // Keep its full route row on the geographic south side of that box.
 if(boxes.has('WAS')&&centers.has('ALX')){
  const center=centers.get('ALX'),order=['Cardinal','Crescent','Floridian','Carolinian','Palmetto','Silver Meteor','Northeast Regional'].filter(n=>names.get('ALX')?.has(n)),distance=Math.hypot(...centers.get('WAS').map((v,i)=>v-center[i])),spacing=Math.min(result.style.laneSpacing,distance*.60/Math.max(1,order.length-1));
  order.forEach((route,i)=>joints.set('ALX|'+route,unproject([center[0]+(i-(order.length-1)/2)*spacing,center[1]])));
 }

 // At overview scale a fixed-width station row can exceed the distance
 // to the next real stop. Bound the whole row together so every approach
 // continues toward its neighbor instead of doubling back through the hub.
 const reversedHubs=new Set();
 if(result.zoom<5)for(const f of features){const a=centers.get(f.properties.from),b=centers.get(f.properties.to);if(!a||!b)continue;const u=project(joints.get(f.properties.from+'|'+name(f))),v=project(joints.get(f.properties.to+'|'+name(f)));if((v[0]-u[0])*(b[0]-a[0])+(v[1]-u[1])*(b[1]-a[1])<0)for(const code of [f.properties.from,f.properties.to])reversedHubs.add(code);}
 if(result.zoom<5)for(const [code,edges] of incident){
  if(!reversedHubs.has(code)||boxes.has(code)||coreJoints.has(code)||result.overviewApproachStations?.includes(code)||!centers.has(code))continue;
  const center=centers.get(code),nearest=Math.min(...edges.map(f=>centers.has(other(f,code))?Math.hypot(...centers.get(other(f,code)).map((v,i)=>v-center[i])):Infinity)),keys=[...names.get(code)].map(n=>code+'|'+n),extent=Math.max(0,...keys.map(k=>Math.hypot(...project(joints.get(k)).map((v,i)=>v-center[i])))),scale=extent?Math.min(1,nearest*.24/extent):1;
  if(scale>=1)continue;
  const compact=p=>unproject(project(p).map((v,i)=>center[i]+(v-center[i])*scale));
  for(const key of keys)joints.set(key,compact(joints.get(key)));
  if(coreJoints.has(code))coreJoints.set(code,compact(coreJoints.get(code)));
  for(const symbol of result.interchanges.features.filter(f=>f.properties.Code===code)){symbol.geometry={...symbol.geometry,coordinates:symbol.geometry.coordinates.map(compact)};symbol.properties={...symbol.properties,center:compact(symbol.properties.center),radiusPixels:symbol.properties.radiusPixels*scale,dotAxis:symbol.properties.dotAxis?.map(compact)};}
 }
 for(const f of features){const route=name(f),a=boxes.has(f.properties.from)?null:joints.get(f.properties.from+'|'+route),b=boxes.has(f.properties.to)?null:joints.get(f.properties.to+'|'+route);let points=[...f.geometry.coordinates];if(a)points[0]=a;if(b)points[points.length-1]=b;
  // All source edges run station-to-station. Interior vertices are drawing
  // connectors, so remove a connector that reverses toward the previous
  // station without cutting either endpoint or dropping a source edge.
  points=points.filter((p,i)=>!i||i===points.length-1||Math.hypot(...project(p).map((v,j)=>v-project(points[i-1])[j]))>1e-7);
  for(let iteration=0;iteration<f.geometry.coordinates.length;iteration++){const screen=points.map(project);if(screen.length<3)break;const direction=screen.at(-1).map((v,j)=>v-screen[0][j]),length=Math.hypot(...direction);let removed=false;for(let i=1;i<screen.length;i++){if(direction.reduce((sum,v,j)=>sum+v*(screen[i][j]-screen[i-1][j]),0)>=-length*1e-6)continue;const k=i<points.length-1?i:i-1;if(k>0&&k<points.length-1){points.splice(k,1);removed=true;break;}}if(!removed)break;}
  // Explicit corridor junctions retain their approach connectors. Other
  // source station pairs are straight: offsetting must not add extra kinks.
  if(!f.properties.preserveStationConnector&&!coreIncident.has(f.properties.from)&&!coreIncident.has(f.properties.to))points=[points[0],points.at(-1)];
  if(points.length<2)points=[points[0],points[0]];f.geometry.coordinates=points;f.properties.stationPositions=f.properties.stationPositions.map(p=>({...p,coordinates:f.geometry.coordinates[index(f,p.Code)]}));
 }
 const finalContacts=new Map();for(const f of features)for(const code of [f.properties.from,f.properties.to]){const key=code+'|'+name(f);if(!finalContacts.has(key))finalContacts.set(key,[]);finalContacts.get(key).push(f.geometry.coordinates[index(f,code)]);}
 const contact=(code,n,original)=>{if(!boxes.has(code))return joints.get(code+'|'+n)||original;const q=project(original);return (finalContacts.get(code+'|'+n)||[]).toSorted((a,b)=>Math.hypot(...project(a).map((v,j)=>v-q[j]))-Math.hypot(...project(b).map((v,j)=>v-q[j])))[0]||original;};
 const ids=new Set(result.qualifying.features.map(f=>f.properties.edgeId)),coreEdges=new Map(features.filter(f=>f.properties.corridorBundle).map(f=>[pair(f),f]));
 return {...result,displayed:{...result.displayed,features},qualifying:{...result.qualifying,features:features.filter(f=>ids.has(f.properties.edgeId))},bundle:{...result.bundle,features:core.map(f=>{const template=coreEdges.get(pair(f));return {...f,geometry:{...f.geometry,coordinates:template.properties.from===f.properties.from?template.geometry.coordinates:[...template.geometry.coordinates].reverse()}};})},dots:{...result.dots,features:result.dots.features.flatMap(f=>{const groups=new Map();for(const n of f.properties.symbolRoutes){const p=contact(f.properties.Code,n,moved.get(f.properties.Code+'|'+n)||f.geometry.coordinates),key=p.join(',');if(!groups.has(key))groups.set(key,{p,names:[]});groups.get(key).names.push(n);}return [...groups.values()].map(({p,names})=>({...f,properties:{...f.properties,symbolRoutes:names},geometry:{...f.geometry,coordinates:p}}));})},finalLayout:{branchStopsAdjusted:moved.size,stationRowsPacked,corridorRowsAligned}};
}
