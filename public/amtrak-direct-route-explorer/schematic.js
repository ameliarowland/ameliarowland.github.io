import {parallelCorridors,attachOutlineStops,terminalBoxDimensions} from './parallel-corridors.js?v=amtrak-5';
import {stationRouteName} from './model.js?v=amtrak-5';
const collection=features=>({type:'FeatureCollection',features});
const north=['Adirondack','Borealis','Empire Service','Ethan Allen Express','Lake Shore Limited','Maple Leaf','Pennsylvanian','Keystone Service','Cardinal'];
const south=['Acela','Vermonter','Northeast Regional'];
export const chicagoUnionOrder=['Empire Builder','Borealis','Hiawatha Service','California Zephyr','Southwest Chief','Carl Sandburg','Illinois Zephyr','Lincoln Service Missouri River Runner','Lincoln Service','Texas Eagle','City Of New Orleans','Illini','Saluki','Cardinal','Capitol Limited','Floridian','Lake Shore Limited','Wolverine','Blue Water','Pere Marquette'];
const rank=n=>north.includes(n)?north.indexOf(n):south.includes(n)?1000+south.indexOf(n):100;
// Scale the entire station layout together below regional zoom. Fixed pixel
// lane spacing otherwise makes hubs larger than the geography around them.
export function schematicDrawingStyle(zoom){const t=Math.max(0,Math.min(1,(zoom-4)/6)),stationScale=2**Math.min(0,zoom-8),baseWidth=(1.8+5.2*t)*stationScale;const baseStrokeWidth=Math.max(1.6,baseWidth);return {stationScale,baseWidth,baseStrokeWidth,highlightStrokeWidth:baseStrokeWidth,hoverStrokeWidth:Math.max(baseStrokeWidth+1,baseWidth+1.5*stationScale),focusStrokeWidth:Math.max(baseStrokeWidth+1.2,baseWidth+2*stationScale),selectedStrokeWidth:Math.max(baseStrokeWidth+1.5,baseWidth+2.5*stationScale),highlightWidth:baseWidth,hoverWidth:baseWidth+1.5*stationScale,focusWidth:baseWidth+2*stationScale,selectedWidth:baseWidth+2.5*stationScale,laneSpacing:Math.max(3.4,baseWidth+(2.4+.6*t)*stationScale)};}
function mergePennStationPorts(dots){
 const merged=new Map(),features=[];
 for(const dot of dots.features){if(dot.properties.Code!=='NYP'){features.push(dot);continue;}const key=dot.geometry.coordinates.map(v=>v.toFixed(9)).join(',');
  if(merged.has(key)){const other=merged.get(key);other.properties.symbolRoutes.push(...dot.properties.symbolRoutes.filter(name=>!other.properties.symbolRoutes.includes(name)));other.properties.sharedPort=true;}
  else{const copy={...dot,properties:{...dot.properties,symbolRoutes:[...dot.properties.symbolRoutes]}};merged.set(key,copy);features.push(copy);}
 }
 dots.features=features;return dots;
}
function fitStopGlyphs(dots,zoom,scale){
 mergePennStationPorts(dots);
 const world=512*2**zoom,project=p=>[(p[0]+180)/360*world,(1-Math.log(Math.tan(Math.PI/4+p[1]*Math.PI/360))/Math.PI)/2*world];
 const groups=Map.groupBy(dots.features,f=>f.properties.Code);
 for(const group of groups.values())for(const dot of group){const p=project(dot.geometry.coordinates),gap=Math.min(...group.filter(f=>f!==dot).map(f=>{const q=project(f.geometry.coordinates);return Math.hypot(p[0]-q[0],p[1]-q[1]);}));
  const outlineWidth=0;dot.properties.radius=Math.max(1.7,schematicDrawingStyle(zoom).baseStrokeWidth/2)*(dot.properties.symbolRoutes.every(n=>['Pennsylvanian','Keystone Service'].includes(n))?.75:1);
  dot.properties.outlineWidth=outlineWidth;dot.properties.radius=Math.min(dot.properties.radius,(gap-2*outlineWidth)/2);
 }
 return dots;
}
// A fixed Chicago box can cover nearby stations at overview zooms. Collapse
// those drawing vertices to their Chicago port while retaining the full route
// graph and station inventory for journey calculations.
export function chicagoOverviewDrawing(result){
 if(result.zoom>=8)return result;
 const box=result.interchanges?.features.find(f=>f.properties.Code==='CHI');if(!box)return result;
 const xs=box.geometry.coordinates.map(p=>p[0]),ys=box.geometry.coordinates.map(p=>p[1]),bounds=[Math.min(...xs),Math.max(...xs),Math.min(...ys),Math.max(...ys)];
 const inside=p=>p[0]>bounds[0]+1e-9&&p[0]<bounds[1]-1e-9&&p[1]>bounds[2]+1e-9&&p[1]<bounds[3]-1e-9;
 const ports=new Map(result.displayed.features.flatMap(f=>f.properties.stationPositions).filter(p=>p.Code==='CHI').map(p=>[p.name,p.coordinates]));
 const paint=collection=>({...collection,features:collection.features.map(f=>{const port=ports.get(f.properties.symbologyName||f.properties.name);return port?{...f,geometry:{...f.geometry,coordinates:f.geometry.coordinates.map(p=>inside(p)?port:p)}}:f;})});
 return {...result,displayed:paint(result.displayed),qualifying:paint(result.qualifying),dots:{...result.dots,features:result.dots.features.filter(f=>f.properties.Code==='CHI'||!inside(f.geometry.coordinates))},interchanges:{...result.interchanges,features:result.interchanges.features.filter(f=>f.properties.Code==='CHI'||!inside(f.properties.center))}};
}
// Branching bars connect approach ports; colored tracks end at the bar.
export function stationBarDrawing(result){
 const bars=new Map((result.interchanges?.features||[]).filter(f=>f.properties.shape==='capsule'&&f.properties.branches>=3).map(f=>[f.properties.Code,f]));if(!bars.size)return result;
 const world=512*2**result.zoom,project=p=>[(p[0]+180)/360*world,(1-Math.log(Math.tan(Math.PI/4+p[1]*Math.PI/360))/Math.PI)/2*world],unproject=p=>[p[0]/world*360-180,Math.atan(Math.sinh(Math.PI*(1-2*p[1]/world)))*180/Math.PI],cross=(a,b)=>a[0]*b[1]-a[1]*b[0],stopPorts=new Map();
 const protectedClusters=new Set();
 const routeStops=new Map();for(const dot of result.dots.features)for(const name of dot.properties.symbolRoutes){if(!routeStops.has(name))routeStops.set(name,[]);routeStops.get(name).push({code:dot.properties.Code,point:project(dot.geometry.coordinates)});}
 // Stations closer than one lane spacing already have protected geographic
 // ports. Retain those paths and fit their bar to the existing contacts.
 for(const [code,bar] of bars){const origin=project(bar.properties.stationCenter),near=(result.interchanges.features||[]).some(other=>other!==bar&&other.properties.stationCenter&&Math.hypot(...project(other.properties.stationCenter).map((v,i)=>v-origin[i]))<result.style.laneSpacing);if(!near)continue;
  const ports=result.displayed.features.filter(f=>[f.properties.from,f.properties.to].includes(code)).map(f=>project(f.geometry.coordinates[f.properties.from===code?0:f.geometry.coordinates.length-1]));let pair=[ports[0],ports[0]],length=0;for(const a of ports)for(const b of ports){const d=Math.hypot(b[0]-a[0],b[1]-a[1]);if(d>length){pair=[a,b];length=d;}}if(length<1e-5)continue;const unit=pair[1].map((v,i)=>(v-pair[0][i])/length),normal=[-unit[1],unit[0]],mid=pair[0].map((v,i)=>(v+pair[1][i])/2),radius=Math.max(.7,result.style.laneSpacing*.1),outline=[];for(let side=0;side<2;side++)for(let i=0;i<=16;i++){const angle=(side?Math.PI/2:-Math.PI/2)+i*Math.PI/16,x=(side?-length/2:length/2)+Math.cos(angle)*radius,y=Math.sin(angle)*radius;outline.push(unproject(mid.map((v,j)=>v+unit[j]*x+normal[j]*y)));}outline.push(outline[0]);bar.properties={...bar.properties,center:unproject(mid),radiusPixels:length/2+radius,dotAxis:pair.map(unproject)};bar.geometry={...bar.geometry,coordinates:outline};bars.delete(code);protectedClusters.add(code);for(const other of result.interchanges.features)if(other.properties.stationCenter&&Math.hypot(...project(other.properties.stationCenter).map((v,i)=>v-origin[i]))<result.style.laneSpacing)protectedClusters.add(other.properties.Code);
 }
 // Cover every real approach before trimming. A fit based on one contact
 // per service can miss the other side of a bend and leave its dot off-axis.
 for(const [code,bar] of bars){const [a,b]=bar.properties.dotAxis.map(project),axis=b.map((v,i)=>v-a[i]),length=Math.hypot(...axis),unit=axis.map(v=>v/length),normal=[-unit[1],unit[0]],center=project(bar.properties.center),contacts=[a,b];
  for(const f of result.displayed.features.filter(f=>[f.properties.from,f.properties.to].includes(code))){const [c,d]=f.properties.parallelBody.map(project),v=d.map((x,i)=>x-c[i]),delta=a.map((x,i)=>x-c[i]),det=cross(v,axis);if(Math.abs(det)<1e-8)continue;const t=cross(delta,axis)/det,p=c.map((x,i)=>x+t*v[i]);if(Math.hypot(p[0]-center[0],p[1]-center[1])<=bar.properties.radiusPixels*2)contacts.push(p);}
  const values=contacts.map(p=>(p[0]-a[0])*unit[0]+(p[1]-a[1])*unit[1]),lo=Math.min(...values),hi=Math.max(...values);if(lo>=-1e-6&&hi<=length+1e-6)continue;
  const radius=Math.max(...bar.geometry.coordinates.map(project).map(p=>Math.abs((p[0]-center[0])*normal[0]+(p[1]-center[1])*normal[1]))),mid=a.map((v,i)=>v+unit[i]*(lo+hi)/2),half=(hi-lo)/2,outline=[];
  for(let side=0;side<2;side++)for(let i=0;i<=16;i++){const angle=(side?Math.PI/2:-Math.PI/2)+i*Math.PI/16,x=(side?-half:half)+Math.cos(angle)*radius,y=Math.sin(angle)*radius;outline.push(unproject(mid.map((v,j)=>v+unit[j]*x+normal[j]*y)));}outline.push(outline[0]);
  bar.properties={...bar.properties,center:unproject(mid),radiusPixels:half+radius,dotAxis:[lo,hi].map(t=>unproject(a.map((v,i)=>v+unit[i]*t)))};bar.geometry={...bar.geometry,coordinates:outline};
 }
 const displayed={...result.displayed,features:result.displayed.features.map(f=>{
  if(![f.properties.from,f.properties.to].some(code=>bars.has(code)))return f;
  let points=f.geometry.coordinates.map(project);const name=f.properties.symbologyName||f.properties.name;
  for(const [end,code] of [f.properties.from,f.properties.to].entries()){
   const bar=bars.get(code);if(!bar||f.properties.stationTransition&&[f.properties.from,f.properties.to].some(c=>protectedClusters.has(c)))continue;const [c,d]=bar.properties.dotAxis.map(project),w=[d[0]-c[0],d[1]-c[1]],path=end===0?points:[...points].reverse();let hit;
   const intersect=(a,b,infinite=false)=>{const v=[b[0]-a[0],b[1]-a[1]],delta=[c[0]-a[0],c[1]-a[1]],det=cross(v,w);if(Math.abs(det)<1e-8)return;const t=cross(delta,w)/det,u=cross(delta,v)/det;if((infinite||t>=-1e-7&&t<=1+1e-7)&&u>=-1e-7&&u<=1+1e-7)return [a[0]+t*v[0],a[1]+t*v[1]];};
   for(let i=path.length-1;i>0;i--){const p=intersect(path[i-1],path[i]);if(p){hit={p,index:i};break;}}
   const body=f.properties.parallelBody.map(project),bodyPath=end===0?body:[...body].reverse();const bodyPort=intersect(bodyPath[0],bodyPath[1],true);if(bodyPort)hit={p:bodyPort,index:1};
   if(!hit&&path.length>1){const p=intersect(path[0],path[1],true);if(p&&Math.hypot(p[0]-path[0][0],p[1]-path[0][1])<=bar.properties.radiusPixels*4)hit={p,index:1};}
   if(!hit)continue;const tail=path.slice(hit.index),center=project(bar.properties.center);while(tail.length>1&&Math.hypot(tail[0][0]-center[0],tail[0][1]-center[1])<bar.properties.radiusPixels*4&&!(routeStops.get(name)||[]).some(g=>g.code!==code&&Math.hypot(g.point[0]-tail[0][0],g.point[1]-tail[0][1])<1e-5))tail.shift();const trimmed=[hit.p,...tail];points=end===0?trimmed:trimmed.reverse();
   const dot=result.dots.features.find(g=>g.properties.Code===code&&g.properties.symbolRoutes.includes(name));
   if(dot){const coordinate=unproject(hit.p),key=code+'|'+name+'|'+coordinate.map(v=>v.toFixed(9)).join(',');stopPorts.set(key,{...dot,properties:{...dot.properties,symbolRoutes:[name]},geometry:{type:'Point',coordinates:coordinate}});}
  }
  return {...f,geometry:{...f.geometry,coordinates:points.map(unproject)}};
 })};
 // Order New Orleans terminal ports by their approach directions. Crescent
 // leaves north of Mardi Gras, so its port must be above that eastbound ray.
 const newOrleans=bars.get('NOL');
 if(newOrleans){
  const order=['City Of New Orleans','Sunset Limited','Crescent','Amtrak Mardi Gras Service'],axis=newOrleans.properties.dotAxis.map(project),v=axis[1].map((x,i)=>x-axis[0][i]),edges=displayed.features.filter(f=>[f.properties.from,f.properties.to].includes('NOL'));
  const ports=edges.map(f=>project(f.geometry.coordinates[f.properties.from==='NOL'?0:f.geometry.coordinates.length-1])).sort((a,b)=>(a[0]-b[0])*v[0]+(a[1]-b[1])*v[1]);
  if(ports.length===order.length)for(const f of edges){const name=f.properties.symbologyName||f.properties.name,slot=order.indexOf(name);if(slot<0)continue;const point=unproject(ports[slot]),end=f.properties.from==='NOL'?0:f.geometry.coordinates.length-1;f.geometry.coordinates[end]=point;const dot=result.dots.features.find(g=>g.properties.Code==='NOL'&&g.properties.symbolRoutes.includes(name));if(dot){for(const [key,d] of stopPorts)if(d.properties.Code==='NOL'&&d.properties.symbolRoutes.includes(name))stopPorts.delete(key);stopPorts.set('NOL|'+name,{...dot,properties:{...dot.properties,symbolRoutes:[name]},geometry:{type:'Point',coordinates:point}});}}
 }
 // Use one pivot for every continuation of the same service. A side
 // branch connects to that pivot inside the station bar.
 const families=Map.groupBy(result.displayed.features,f=>[f.properties.from,f.properties.to].sort().join('|'));
 const familySize=f=>new Set(families.get([f.properties.from,f.properties.to].sort().join('|')).map(g=>g.properties.symbologyName||g.properties.name)).size;
 for(const [code,bar] of bars)for(const name of bar.properties.passingRoutes){
  const candidates=displayed.features.filter(f=>(f.properties.symbologyName||f.properties.name)===name&&[f.properties.from,f.properties.to].includes(code)).map(f=>{const end=f.properties.from===code?0:1,other=f.properties.stationPositions[1-end],center=project(bar.properties.center),p=project(other.coordinates),v=[p[0]-center[0],p[1]-center[1]],score=familySize(f)*100+Math.abs(v[1])/(Math.hypot(...v)||1);return {f,end,port:f.geometry.coordinates[end===0?0:f.geometry.coordinates.length-1],score};});
  if(candidates.length<2)continue;candidates.sort((a,b)=>b.score-a.score||[a.f.properties.from,a.f.properties.to].sort().join('|').localeCompare([b.f.properties.from,b.f.properties.to].sort().join('|')));
  // Allocate Albany's shared trunk ports in the explicit west-to-east order.
  // Approach fitting at small scales must not substitute a different branch port.
  const hudson=['Lake Shore Limited','Empire Service','Maple Leaf','Adirondack','Ethan Allen Express'].filter(route=>bar.properties.passingRoutes.includes(route)),axis=[...bar.properties.dotAxis].sort((a,b)=>a[0]-b[0]),slot=hudson.indexOf(name),t=(slot+.35)/(hudson.length-1+.7);
  const trunk=candidates.find(c=>[c.f.properties.from,c.f.properties.to].includes('ALB')),trunkNormal=trunk?.f.properties.bodyNormal||trunk?.f.properties.corridorNormal;
  const common=code==='SDY'&&result.zoom<5&&slot>=0&&trunkNormal?unproject(project(bar.properties.stationCenter).map((v,i)=>v+trunkNormal[i]*(slot-(hudson.length-1)/2)*result.style.laneSpacing)):code==='ALB'&&slot>=0?unproject(project(axis[0]).map((v,i)=>v+(project(axis[1])[i]-v)*t)):candidates[0].port,mainCount=familySize(candidates[0].f),degree=new Set(candidates.map(c=>[c.f.properties.from,c.f.properties.to].sort().join('|'))).size;
  const dot=result.dots.features.find(f=>f.properties.Code===code&&f.properties.symbolRoutes.includes(name));
  if(dot){for(const [key,d] of stopPorts)if(d.properties.Code===code&&d.properties.symbolRoutes.includes(name))stopPorts.delete(key);stopPorts.set(code+'|'+name+'|common',{...dot,properties:{...dot.properties,symbolRoutes:[name]},geometry:{type:'Point',coordinates:common}});}
  for(const {f,end,port} of candidates){const coordinates=f.geometry.coordinates,branch=degree>2&&familySize(f)<mainCount;
   if(branch&&code==='ALB'){
    f.properties={...f.properties,preserveStationConnector:true};
    // Carry the eastbound branch along the station bar before it leaves
    // the trunk, so it cannot cut across the incoming Hudson lanes.
    const remote=coordinates[end===0?coordinates.length-1:0],exit=bar.properties.dotAxis.toSorted((a,b)=>Math.hypot(...project(a).map((v,i)=>v-project(remote)[i]))-Math.hypot(...project(b).map((v,i)=>v-project(remote)[i])))[0];
    f.geometry.coordinates=end===0?[common,exit,...coordinates.slice(1)]:[...coordinates.slice(0,-1),exit,common];
   }
   else if(branch&&Math.hypot(...project(port).map((v,i)=>v-project(common)[i]))>1e-6){if(end===0)f.geometry.coordinates=[common,...coordinates];else f.geometry.coordinates=[...coordinates,common];if(dot)stopPorts.set(code+'|'+name+'|'+port.join(','),{...dot,properties:{...dot.properties,symbolRoutes:[name]},geometry:{type:'Point',coordinates:port}});}
   else if(end===0)f.geometry.coordinates=[common,...coordinates.slice(1)];else f.geometry.coordinates=[...coordinates.slice(0,-1),common];
  }
 }
 const represented=new Set([...stopPorts.values()].map(f=>f.properties.Code+'|'+f.properties.symbolRoutes[0]));
 const dots={...result.dots,features:[...result.dots.features.filter(f=>!f.properties.symbolRoutes.every(name=>represented.has(f.properties.Code+'|'+name))),...stopPorts.values()]};fitStopGlyphs(dots,result.zoom,result.style.stationScale);
 // Multi-direction terminal hubs use a square connection zone. Clip each
 // real approach to its boundary; continuing services share one pivot inside.
 for(const code of ['NOL']){const box=result.interchanges.features.find(f=>f.properties.Code===code);if(!box)continue;const edges=displayed.features.filter(f=>[f.properties.from,f.properties.to].includes(code)),center=project(box.properties.stationCenter),{halfWidth:hw,halfHeight:hh,radius}=terminalBoxDimensions(result.zoom),half=Math.max(hw,hh),extents=[hw,hh],ports=new Map(),contacts=[];
  for(const f of edges){const end=f.properties.from===code?0:1,dir=f.properties.approachDirections[end],n=f.properties.bodyNormal,offset=f.properties.perpendicularOffset||0,origin=center.map((v,i)=>v+n[i]*offset),candidates=[];for(let i=0;i<2;i++)if(Math.abs(dir[i])>1e-8)for(const sign of [-1,1]){const t=(center[i]+sign*extents[i]-origin[i])/dir[i],point=origin.map((v,j)=>v+dir[j]*t);if(t>=0&&point.every((v,j)=>Math.abs(v-center[j])<=extents[j]+1e-5))candidates.push({t,point});}candidates.sort((a,b)=>a.t-b.t);const port=candidates[0]?.point;if(!port)continue;const name=f.properties.symbologyName||f.properties.name;if(!ports.has(name))ports.set(name,[]);ports.get(name).push({f,end,port});contacts.push(port);}
  for(const [name,own] of ports){const main=own.toSorted((a,b)=>familySize(b.f)-familySize(a.f))[0],pivot=own.length===1?main.port:code==='SPG'&&name!=='Lake Shore Limited'?center.map((v,i)=>v+main.f.properties.bodyNormal[i]*(main.f.properties.perpendicularOffset||0)):center.map((v,i)=>v+(i===0?-half*.8:0));
   for(const {f,end,port} of own){const path=(end===0?f.geometry.coordinates:[...f.geometry.coordinates].reverse()).map(project);let tail=path.slice(1);while(tail.length>1&&tail[0].every((v,i)=>Math.abs(v-center[i])<=half*2)&&!(routeStops.get(name)||[]).some(g=>g.code!==code&&Math.hypot(...g.point.map((v,i)=>v-tail[0][i]))<1e-5))tail.shift();const points=own.length===1?[port,...tail]:[pivot,port,...tail];f.geometry.coordinates=(end===0?points:points.reverse()).map(unproject);}
   const coordinate=unproject(pivot);for(const dot of dots.features.filter(d=>d.properties.Code===code&&d.properties.symbolRoutes.includes(name)))dot.geometry={...dot.geometry,coordinates:coordinate};
  }
  const outline=[];for(const [x,y,start] of [[hw-radius,hh-radius,0],[-hw+radius,hh-radius,Math.PI/2],[-hw+radius,-hh+radius,Math.PI],[hw-radius,-hh+radius,3*Math.PI/2]])for(let i=0;i<=8;i++){const angle=start+i*Math.PI/16;outline.push(unproject([center[0]+x+Math.cos(angle)*radius,center[1]+y+Math.sin(angle)*radius]));}outline.push(outline[0]);box.geometry={...box.geometry,coordinates:outline};box.properties={...box.properties,shape:'rounded-square',center:unproject(center),radiusPixels:half,boxHalfSize:half};bars.delete(code);
 }
 // Springfield's dominant north-south services share one transverse row.
 // Lake Shore connects across that row before leaving on its eastern branch.
 const springfield=result.interchanges.features.find(f=>f.properties.Code==='SPG');
 if(springfield){const center=project(springfield.properties.stationCenter),edges=displayed.features.filter(f=>[f.properties.from,f.properties.to].includes('SPG')),main=edges.toSorted((a,b)=>familySize(b)-familySize(a))[0],mainNames=[...new Set(edges.filter(f=>familySize(f)===familySize(main)).map(f=>f.properties.symbologyName))],points=new Map();
  for(const name of mainNames){const f=edges.find(f=>f.properties.symbologyName===name&&familySize(f)===familySize(main)),n=f.properties.bodyNormal,d=f.properties.perpendicularOffset||0;points.set(name,[center[0]+d/n[0],center[1]]);}const xs=[...points.values()].map(p=>p[0]),left=Math.min(...xs)-result.style.laneSpacing,right=Math.max(...xs)+result.style.laneSpacing*.35,pivot=[left,center[1]];points.set('Lake Shore Limited',pivot);
  for(const f of edges){const name=f.properties.symbologyName,end=f.properties.from==='SPG'?0:1,point=points.get(name);if(!point)continue;const path=(end===0?f.geometry.coordinates:[...f.geometry.coordinates].reverse()).map(project);let tail=path.slice(1);while(tail.length>1&&Math.hypot(...tail[0].map((v,i)=>v-center[i]))<result.style.laneSpacing*8&&!(routeStops.get(name)||[]).some(g=>g.code!=='SPG'&&Math.hypot(...g.point.map((v,i)=>v-tail[0][i]))<1e-5))tail.shift();const east=name==='Lake Shore Limited'&&tail.at(-1)[0]>center[0],line=east?[point,[right,center[1]],...tail]:[point,...tail];f.geometry.coordinates=(end===0?line:line.reverse()).map(unproject);}
  for(const dot of dots.features.filter(d=>d.properties.Code==='SPG')){const point=points.get(dot.properties.symbolRoutes[0]);if(point)dot.geometry={...dot.geometry,coordinates:unproject(point)};}const half=(right-left)/2,mid=[(left+right)/2,center[1]],radius=Math.max(.7,result.style.laneSpacing*.1),outline=[];for(let side=0;side<2;side++)for(let i=0;i<=16;i++){const angle=(side?Math.PI/2:-Math.PI/2)+i*Math.PI/16;outline.push(unproject([mid[0]+(side?-half:half)+Math.cos(angle)*radius,mid[1]+Math.sin(angle)*radius]));}outline.push(outline[0]);springfield.geometry={...springfield.geometry,coordinates:outline};springfield.properties={...springfield.properties,shape:'capsule',center:unproject(mid),radiusPixels:half+radius,dotAxis:[[left,center[1]],[right,center[1]]].map(unproject)};bars.delete('SPG');
 }
 fitStopGlyphs(dots,result.zoom,result.style.stationScale);
 // A small contact correction is allowed only inside the filled glyph.
 // Preserve its radius and keep all colored geometry outside that glyph fixed.
 for(const dot of dots.features){const bar=bars.get(dot.properties.Code);if(!bar)continue;const [a,b]=bar.properties.dotAxis.map(project),v=b.map((x,i)=>x-a[i]),length=Math.hypot(...v),unit=v.map(x=>x/length),p=project(dot.geometry.coordinates),t=(p[0]-a[0])*unit[0]+(p[1]-a[1])*unit[1],distance=Math.abs(cross(v,p.map((x,i)=>x-a[i])))/length;if(distance<=1e-5||distance>dot.properties.radius)continue;
  const group=dots.features.filter(g=>g!==dot&&g.properties.Code===dot.properties.Code),candidates=[0,-.25,.25,-.5,.5].map(s=>a.map((x,i)=>x+unit[i]*(t+s*result.style.laneSpacing))),point=candidates.find(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<=dot.properties.radius&&group.every(g=>Math.hypot(...project(g.geometry.coordinates).map((x,i)=>x-q[i]))>=dot.properties.radius+g.properties.radius-1e-5));if(!point)continue;
  const coordinate=unproject(point);for(const f of displayed.features)if(dot.properties.symbolRoutes.includes(f.properties.symbologyName||f.properties.name))f.geometry.coordinates=f.geometry.coordinates.map(q=>Math.hypot(...project(q).map((x,i)=>x-p[i]))<1e-5?coordinate:q);dot.geometry={...dot.geometry,coordinates:coordinate};
  const position=(point[0]-a[0])*unit[0]+(point[1]-a[1])*unit[1];if(position<0||position>length){const lo=Math.min(0,position),hi=Math.max(length,position),normal=[-unit[1],unit[0]],center=project(bar.properties.center),radius=Math.max(...bar.geometry.coordinates.map(project).map(q=>Math.abs((q[0]-center[0])*normal[0]+(q[1]-center[1])*normal[1]))),mid=a.map((x,i)=>x+unit[i]*(lo+hi)/2),half=(hi-lo)/2,outline=[];for(let side=0;side<2;side++)for(let i=0;i<=16;i++){const angle=(side?Math.PI/2:-Math.PI/2)+i*Math.PI/16,x=(side?-half:half)+Math.cos(angle)*radius,y=Math.sin(angle)*radius;outline.push(unproject(mid.map((x,j)=>x+unit[j]*((side?-half:half)+Math.cos(angle)*radius)+normal[j]*y)));}outline.push(outline[0]);bar.properties={...bar.properties,center:unproject(mid),radiusPixels:half+radius,dotAxis:[lo,hi].map(t=>unproject(a.map((x,i)=>x+unit[i]*t)))};bar.geometry={...bar.geometry,coordinates:outline};}
 }
 // Trim the Schenectady bar to the ports actually used after branch joins.
 const sdy=result.interchanges.features.find(f=>f.properties.Code==='SDY');if(sdy){const [a,b]=sdy.properties.dotAxis.map(project),v=b.map((x,i)=>x-a[i]),length=Math.hypot(...v),unit=v.map(x=>x/length),normal=[-unit[1],unit[0]],center=project(sdy.properties.center),contacts=displayed.features.filter(f=>[f.properties.from,f.properties.to].includes('SDY')).map(f=>project(f.geometry.coordinates[f.properties.from==='SDY'?0:f.geometry.coordinates.length-1])).filter(p=>Math.abs(cross(v,p.map((x,i)=>x-a[i])))/length<1e-5);if(contacts.length){const values=contacts.map(p=>(p[0]-a[0])*unit[0]+(p[1]-a[1])*unit[1]),lo=Math.min(...values),hi=Math.max(...values),mid=a.map((x,i)=>x+unit[i]*(lo+hi)/2),half=(hi-lo)/2,radius=Math.max(...sdy.geometry.coordinates.map(project).map(p=>Math.abs((p[0]-center[0])*normal[0]+(p[1]-center[1])*normal[1]))),outline=[];for(let side=0;side<2;side++)for(let i=0;i<=16;i++){const angle=(side?Math.PI/2:-Math.PI/2)+i*Math.PI/16,x=(side?-half:half)+Math.cos(angle)*radius,y=Math.sin(angle)*radius;outline.push(unproject(mid.map((x,j)=>x+unit[j]*((side?-half:half)+Math.cos(angle)*radius)+normal[j]*y)));}outline.push(outline[0]);sdy.geometry={...sdy.geometry,coordinates:outline};sdy.properties={...sdy.properties,center:unproject(mid),radiusPixels:half+radius,dotAxis:[lo,hi].map(t=>unproject(a.map((x,i)=>x+unit[i]*t)))};}}
 const ids=new Set(result.qualifying.features.map(f=>f.properties.edgeId));return {...result,displayed,dots,qualifying:{...result.qualifying,features:displayed.features.filter(f=>ids.has(f.properties.edgeId))}};
}
export function createSchematicEngine(routes,stations) {
 const nodes=new Map(),groups=new Map(),graphs=new Map(),pathCache=new Map(),chicagoPorts=new Map(),pennPositions=new Map();
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
 for(const station of stations.features)if(nodes.has(station.properties.Code))nodes.get(station.properties.Code).stopNames=new Set((station.properties.routeNames||[]).map(stationRouteName));
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
 const losAngelesOrder=['Coast Starlight','Pacific Surfliner','Southwest Chief','Texas Eagle','Sunset Limited'];
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
  const west=['Amtrak Cascades','Coast Starlight','Empire Builder'];node.order=[...west.filter(name=>node.names.has(name)),...node.order.filter(name=>!west.includes(name))];
 }
 for(const id of ['POS','ONA'])if(nodes.has(id))nodes.get(id).normal=[0,1];
 for(const node of nodes.values()){
  const family=['Lincoln Service Missouri River Runner','Lincoln Service','Texas Eagle','Missouri River Runner'].filter(name=>node.names.has(name));if(family.length<2)continue;
  const slots=node.order.map((name,i)=>family.includes(name)?i:-1).filter(i=>i>=0);family.forEach((name,i)=>node.order[slots[i]]=name);
 }
 for(const node of nodes.values())if(node.names.has('Vermonter')&&node.names.has('Acela')){const v=node.order.indexOf('Vermonter'),a=node.order.indexOf('Acela');if(v>a){node.order[v]='Acela';node.order[a]='Vermonter';}}
 for(const node of nodes.values())for(const [west,east] of [['Northeast Regional','Acela'],['Floridian','Silver Meteor'],...(node.coordinate[1]>37?[['Floridian','Carolinian']]:[]),['Pacific Surfliner','Southwest Chief'],['Coast Starlight','Pacific Surfliner'],['Capitol Corridor','California Zephyr'],['Missouri River Runner','Texas Eagle'],['Lincoln Service Missouri River Runner','Texas Eagle'],['Lincoln Service Missouri River Runner','Lincoln Service']])if(node.names.has(west)&&node.names.has(east)){const w=node.order.indexOf(west),e=node.order.indexOf(east);if(node.normal[0]>=0?w>e:w<e){node.order[w]=east;node.order[e]=west;}}
 for(const node of nodes.values())if(node.names.has('Maple Leaf')){node.order=node.order.filter(name=>name!=='Maple Leaf');node.order.push('Maple Leaf');}
 const hudsonOrder=['Lake Shore Limited','Empire Service','Maple Leaf','Adirondack','Ethan Allen Express'];
 for(const node of nodes.values())if(node.names.has('Empire Service')&&[...node.names].every(name=>hudsonOrder.includes(name)))node.order=hudsonOrder.filter(name=>node.names.has(name));
 for(const [id,node] of nodes)if(id!=='CHI'&&node.names.has('Pere Marquette')){node.order=node.order.filter(name=>name!=='Pere Marquette');if(node.normal[1]>=0)node.order.unshift('Pere Marquette');else node.order.push('Pere Marquette');}
 for(const [id,node] of nodes)if(id!=='CHI'){
  for(const [below,above] of [['Capitol Limited','Floridian']])if(node.names.has(below)&&node.names.has(above)){
   const b=node.order.indexOf(below),a=node.order.indexOf(above);if(node.normal[1]>=0?b<a:b>a){node.order[b]=above;node.order[a]=below;}
  }
 }
 for(const [id,node] of nodes){const pairs=[...(id==='PGH'?[['Pennsylvanian','Floridian']]:[]),...(id==='SOB'?[['Lake Shore Limited','Floridian']]:[])];for(const [north,south] of pairs)if(node.names.has(north)&&node.names.has(south)){const n=node.order.indexOf(north),s=node.order.indexOf(south);if(node.normal[1]>=0?n>s:n<s){node.order[n]=south;node.order[s]=north;}}}
 if(nodes.has('SOB')){const node=nodes.get('SOB'),family=['Lake Shore Limited','Floridian','Capitol Limited'].filter(n=>node.order.includes(n)),slots=node.order.map((n,i)=>family.includes(n)?i:-1).filter(i=>i>=0);if(node.normal[1]<0)family.reverse();family.forEach((n,i)=>node.order[slots[i]]=n);}
 for(const [id,node] of nodes)if(id!=='CHI'&&node.names.has('Blue Water')&&node.names.has('Wolverine')){const b=node.order.indexOf('Blue Water'),w=node.order.indexOf('Wolverine');if(node.normal[1]>=0?b>w:b<w){node.order[b]='Wolverine';node.order[w]='Blue Water';}}
 for(const [id,node] of nodes)if(id!=='CHI'&&node.names.has('Borealis')&&node.names.has('Empire Builder')){node.normal=[Math.SQRT1_2,-Math.SQRT1_2];const b=node.order.indexOf('Borealis'),e=node.order.indexOf('Empire Builder');if(b<e){node.order[b]='Empire Builder';node.order[e]='Borealis';}}
 for(const node of nodes.values())if(node.names.has('Amtrak Cascades')){node.order=node.order.filter(n=>n!=='Amtrak Cascades');if(node.normal[0]>=0)node.order.unshift('Amtrak Cascades');else node.order.push('Amtrak Cascades');}
 for(const node of nodes.values())if(node.names.has('Pacific Surfliner')&&!node.names.has('Coast Starlight')){node.order=node.order.filter(n=>n!=='Pacific Surfliner');if(node.normal[0]>=0)node.order.unshift('Pacific Surfliner');else node.order.push('Pacific Surfliner');}
 for(const node of nodes.values())if(node.names.has('Crescent')&&node.names.has('Carolinian')){
  const c=node.order.indexOf('Crescent'),r=node.order.indexOf('Carolinian');
  if(node.normal[1]>=0?c>r:c<r){node.order[c]='Carolinian';node.order[r]='Crescent';}
 }
 for(const node of nodes.values())if(node.names.has('Crescent')&&node.names.has('Floridian')){const c=node.order.indexOf('Crescent'),f=node.order.indexOf('Floridian');if(node.normal[0]>=0?c>f:c<f){node.order[c]='Floridian';node.order[f]='Crescent';}}
 for(const node of nodes.values())if(node.names.has('Piedmont')&&node.names.has('Carolinian')){const p=node.order.indexOf('Piedmont'),c=node.order.indexOf('Carolinian');if(node.normal[1]>=0?p>c:p<c){node.order[p]='Carolinian';node.order[c]='Piedmont';}}
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
  if(job.circleStations!==false&&job.zoom!==8&&!chicagoPorts.size)this.render({...job,zoom:8});
  if(job.zoom<8&&!job.overviewBase){
   const reference=this.render({...job,zoom:8}),baseline=this.render({...job,overviewBase:true,circleStations:false}),style=baseline.style,factor=style.laneSpacing/reference.style.laneSpacing;
   const world=512*2**job.zoom,project=p=>[(p[0]+180)/360*world,(1-Math.log(Math.tan(Math.PI/4+p[1]*Math.PI/360))/Math.PI)/2*world],unproject=p=>[p[0]/world*360-180,Math.atan(Math.sinh(Math.PI*(1-2*p[1]/world)))*180/Math.PI];
   const referenceWorld=512*2**8,referenceProject=p=>[(p[0]+180)/360*referenceWorld,(1-Math.log(Math.tan(Math.PI/4+p[1]*Math.PI/360))/Math.PI)/2*referenceWorld];
   const move=(p,code)=>{const center=project(nodes.get(code).coordinate),origin=referenceProject(nodes.get(code).coordinate),q=referenceProject(p);return unproject([center[0]+(q[0]-origin[0])*factor,center[1]+(q[1]-origin[1])*factor]);};
   let features=baseline.displayed.features;
   let displayed=collection(features);displayed.connectivityAudit={brokenJunctions:[]};
   let dots=collection(baseline.dots.features.map(f=>({...f,properties:{...f.properties}})));
   const stableBarCodes=new Set(['NYP','YNY','NRO','NWK','EWR']);
   for(const symbol of reference.interchanges.features){const code=symbol.properties.Code,local=reference.displayed.features.filter(f=>[f.properties.from,f.properties.to].includes(code));if(symbol.properties.passingRoutes.every(name=>new Set(local.filter(f=>f.properties.symbologyName===name).map(f=>[f.properties.from,f.properties.to].sort().join('|'))).size===1))stableBarCodes.add(code);}
   const moveSymbol=(p,code)=>{if(!['CHI','NYP','YNY','NRO','NWK','EWR'].includes(code))return move(p,code);const center=project(nodes.get(code).coordinate),origin=referenceProject(nodes.get(code).coordinate),q=referenceProject(p);return unproject([center[0]+(q[0]-origin[0])*2**(job.zoom-8),center[1]+(q[1]-origin[1])*2**(job.zoom-8)]);};
   let interchanges=collection(reference.interchanges.features.map(f=>f.properties.shape==='capsule'&&!stableBarCodes.has(f.properties.Code)?baseline.symbolTemplates.features.find(g=>g.properties.Code===f.properties.Code)||f:{...f,properties:{...f.properties,portScale:f.properties.portScale*(f.properties.Code==='CHI'?2**(job.zoom-8):1),radiusPixels:f.properties.radiusPixels*(['CHI','NYP','YNY','NRO','NWK','EWR'].includes(f.properties.Code)?2**(job.zoom-8):factor),center:moveSymbol(f.properties.center,f.properties.Code),dotAxis:f.properties.dotAxis?.map(p=>moveSymbol(p,f.properties.Code))},geometry:{type:'LineString',coordinates:f.geometry.coordinates.map(p=>moveSymbol(p,f.properties.Code))}}));
   if(job.circleStations!==false){
    const world=512*2**job.zoom,project=p=>[(p[0]+180)/360*world,(1-Math.log(Math.tan(Math.PI/4+p[1]*Math.PI/360))/Math.PI)/2*world],unproject=p=>[p[0]/world*360-180,Math.atan(Math.sinh(Math.PI*(1-2*p[1]/world)))*180/Math.PI];
    // Thin station bars can share an enclosing radius without overlapping.
    // Do not hide them based on the circular bounds used by the old symbols.
    // Every station bar remains available; visibility is controlled at zoom 5
    // by the map paint, without altering the station connections.
    const layout=features.map(f=>({feature:f,points:f.geometry.coordinates.map(project),body:f.properties.parallelBody.map(project)})),ports=new Map(features.flatMap(f=>f.properties.stationPositions.map(p=>[p.Code+'|'+p.name,project(p.coordinates)])));
    const circles=interchanges.features.map(f=>({id:f.properties.Code,fixedPorts:f.properties.Code==='CHI'?chicagoPorts:undefined,center:project(f.properties.center),stationCenter:project(f.properties.stationCenter),portScale:f.properties.portScale,shape:f.properties.shape,dotAxis:f.properties.dotAxis?.map(project),routes:f.properties.routes,outline:f.geometry.coordinates.map(project)}));
    const markers=attachOutlineStops(layout,circles,ports,style.laneSpacing);
    features=layout.map(f=>{const original=new Map(f.feature.geometry.coordinates.map(p=>[project(p).join(','),p]));return {...f.feature,properties:{...f.feature.properties,terminalCircleEnds:f.terminalCircleEnds,parallelBody:f.body.map((p,i)=>f.terminalCircleEnds?.[i]?unproject(p):f.feature.properties.parallelBody[i]),stationPositions:f.feature.properties.stationPositions.map((p,i)=>f.terminalCircleEnds?.[i]?{...p,coordinates:unproject(ports.get(p.Code+'|'+p.name))}:p)},geometry:{type:'LineString',coordinates:f.points.map(p=>original.get(p.join(','))||unproject(p))}};});
    displayed=collection(features);displayed.connectivityAudit={brokenJunctions:[]};
    dots=collection(dots.features.map(f=>{const marker=markers.get(f.properties.Code+'|'+f.properties.symbolRoutes[0]),coordinate=marker?features.filter(g=>g.properties.symbologyName===f.properties.symbolRoutes[0]&&[g.properties.from,g.properties.to].includes(f.properties.Code)).flatMap(g=>g.geometry.coordinates).find(p=>{const q=project(p);return Math.hypot(q[0]-marker[0],q[1]-marker[1])<1e-6;})||unproject(marker):f.geometry.coordinates;return {...f,properties:{...f.properties,interchange:circles.some(c=>c.id===f.properties.Code)},geometry:{type:'Point',coordinates:coordinate}};}));
   }
   dots=fitStopGlyphs(dots,job.zoom,style.stationScale);
   const ids=new Set(reference.qualifying.features.map(f=>f.properties.edgeId));
   return {...reference,id:job.id,key:'schematic|'+job.zoom+'|'+(job.circleStations!==false?'circles':'rows'),zoom:job.zoom,style:{...reference.style,...style},displayed,dots,interchanges,qualifying:collection(features.filter(f=>ids.has(f.properties.edgeId)))};
  }
  const started=performance.now(),world=512*2**job.zoom;
  const project=p=>[(p[0]+180)/360*world,(1-Math.log(Math.tan(Math.PI/4+p[1]*Math.PI/360))/Math.PI)/2*world];
  const unproject=p=>[p[0]/world*360-180,Math.atan(Math.sinh(Math.PI*(1-2*p[1]/world)))*180/Math.PI];
  const spacing=Math.min(13,6+Math.max(0,job.zoom-4)*.65),positions=new Map();
  const drawingStyle=schematicDrawingStyle(job.zoom),radius=Math.min(2.3* drawingStyle.stationScale,drawingStyle.baseWidth*.32),ringWidth=0;
  const rowSpacing=drawingStyle.laneSpacing,screen=new Map();
  for(const [id,node] of nodes){
   const p=project(node.coordinate),stationSpacing=id==='CHI'?Math.min(spacing,rowSpacing*.88):rowSpacing;
   node.order.forEach((name,i)=>{const offset=(i-(node.order.length-1)/2)*stationSpacing;
    if(id==='CHI'&&i>13){const start=(13-(node.order.length-1)/2)*stationSpacing,step=(i-13)*stationSpacing;screen.set(id+'|'+name,[p[0]+Math.SQRT1_2*(start+step),p[1]+Math.SQRT1_2*(start-step)]);}
    else screen.set(id+'|'+name,[p[0]+node.normal[0]*offset,p[1]+node.normal[1]*offset]);
   });
  }
  const parallel=parallelCorridors(routes,nodes,screen,project,rowSpacing,{circleStations:job.circleStations!==false,zoom:job.zoom,stationScale:drawingStyle.stationScale,chicagoPorts,pennPositions});
  for(const [key,p] of parallel.positions)positions.set(key,unproject(p));
  const displayed=collection(parallel.features.map(({feature:f,points,body,normal,priorityNormal,laneOffset,stationTransition,terminalCircleEnds,markerCodes,approachDirections})=>{const name=stationRouteName(f.properties.symbologyName||f.properties.name);return {...f,properties:{...f.properties,vertexStations:points.map((p,i)=>markerCodes?.get(p.join(','))||[f.properties.from,f.properties.to][i===points.length-1||body.findIndex(q=>q[0]===p[0]&&q[1]===p[1])===1?1:0]),parallelBody:body.map(unproject),stationTransition:!!stationTransition,terminalCircleEnds,widthScale:['Pennsylvanian','Keystone Service'].includes(name)?.75:1,perpendicularOffset:laneOffset,corridorNormal:priorityNormal,bodyNormal:normal,approachDirections,stationPositions:[f.properties.from,f.properties.to].map(Code=>({Code,name,coordinates:positions.get(Code+'|'+name)}))},geometry:{type:'LineString',coordinates:points.map(unproject)}};}));
  displayed.connectivityAudit={brokenJunctions:[]};
  const colors=new Map(routes.features.map(f=>[stationRouteName(f.properties.symbologyName||f.properties.name),f.properties.color]));
  const enclosureCodes=new Set((job.circleStations!==false?parallel.circles:[]).map(c=>c.id));
  const dots=collection(stations.features.flatMap(s=>(s.properties.routeNames||[]).map(name=>({type:'Feature',properties:{...s.properties,symbolRoutes:[name],interchange:enclosureCodes.has(s.properties.Code),stopStatus:'stop',color:colors.get(name)||'#fff',radius,ringWidth},geometry:{type:'Point',coordinates:parallel.markers.has(s.properties.Code+'|'+name)?unproject(parallel.markers.get(s.properties.Code+'|'+name)):positions.get(s.properties.Code+'|'+name)||s.geometry.coordinates}}))));
  fitStopGlyphs(dots,job.zoom,drawingStyle.stationScale);
  const symbolTemplates=collection(parallel.circles.map(c=>({type:'Feature',properties:{Code:c.id,portScale:c.portScale,radiusPixels:c.radius,shape:c.shape,layoutMode:c.layoutMode,routes:c.routes,approaches:c.approaches,branches:c.branches,passingRoutes:c.passingRoutes,dotAxis:c.dotAxis?.map(unproject),stationCenter:unproject(c.stationCenter),center:unproject(c.center)},geometry:{type:'LineString',coordinates:c.outline.map(unproject)}})));
  const interchanges=job.circleStations!==false?symbolTemplates:collection([]);
  const ids=new Set((job.records||[]).flatMap(journey)),qualifying=collection(displayed.features.filter(f=>ids.has(f.properties.edgeId)));
  return {id:job.id,key:'schematic|'+job.zoom+'|'+(job.circleStations!==false?'circles':'rows'),zoom:job.zoom,style:{spacing,...schematicDrawingStyle(job.zoom)},displayed,dots,interchanges,symbolTemplates,qualifying,layoutMilliseconds:Math.round(performance.now()-started)};
 }};
}
