import {terminalBoxDimensions} from './parallel-corridors.js?v=amtrak-5';
// Terminal hubs connect routes through their enclosures rather than a set
// of overlapping bends. Keep every approach outside and every stop on it.
export const newYorkTerminalBox=result=>terminalBox(result,'NYP');
export const losAngelesTerminalBox=result=>terminalBox(result,'LAX');
export const washingtonTerminalBox=result=>terminalBox(result,'WAS');
export const springfieldTerminalBox=result=>terminalBox(result,'SPG');
function terminalBox(result,code){
 const box=result.interchanges.features.find(f=>f.properties.Code===code);if(!box)return result;
 const world=512*2**result.zoom,project=p=>[(p[0]+180)/360*world,(1-Math.log(Math.tan(Math.PI/4+p[1]*Math.PI/360))/Math.PI)/2*world],unproject=p=>[p[0]/world*360-180,Math.atan(Math.sinh(Math.PI*(1-2*p[1]/world)))*180/Math.PI],center=project(box.properties.stationCenter),{halfWidth:hw,halfHeight:hh,radius}=terminalBoxDimensions(result.zoom),extent=[hw,hh],ports=new Map(),approachPorts=new Map();
 const southOrder=['Cardinal','Crescent','Floridian','Carolinian','Palmetto','Silver Meteor','Northeast Regional'],southNames=[...new Set(result.displayed.features.filter(f=>[f.properties.from,f.properties.to].sort().join('|')==='ALX|WAS').map(f=>f.properties.symbologyName||f.properties.name).filter(name=>southOrder.includes(name)))].sort((a,b)=>southOrder.indexOf(a)-southOrder.indexOf(b));
 const inside=p=>p.every((v,i)=>Math.abs(v-center[i])<=extent[i]+1e-7);
 const trim=f=>{
  if(![f.properties.from,f.properties.to].includes(code))return f;
  const first=f.properties.from===code,path=(first?f.geometry.coordinates:[...f.geometry.coordinates].reverse()).map(project);let hit=null,index=1;
  for(let j=1;j<path.length&&!hit;j++){const a=path[j-1],b=path[j],v=b.map((x,i)=>x-a[i]),candidates=[];for(let i=0;i<2;i++)if(Math.abs(v[i])>1e-9)for(const sign of [-1,1]){const t=(center[i]+sign*extent[i]-a[i])/v[i],p=a.map((x,k)=>x+t*v[k]);if(t>=-1e-8&&t<=1+1e-8&&inside(p))candidates.push({t,p});}candidates.sort((a,b)=>b.t-a.t);if(candidates.length&&!inside(b)){hit=candidates[0].p;index=j;}}
  if(!hit){const remote=path.at(-1),v=remote.map((x,i)=>x-center[i]),scale=Math.min(...v.map((x,i)=>Math.abs(x)>1e-9?extent[i]/Math.abs(x):Infinity));hit=center.map((x,i)=>x+v[i]*scale);index=path.length-1;}
  if(code==='WAS'){const name=f.properties.symbologyName||f.properties.name,other=f.properties.from===code?f.properties.to:f.properties.from;if(other==='ALX'){const spacing=Math.min(result.style.laneSpacing*1.3,Math.max(.01,2*(hw-radius)-result.style.baseStrokeWidth)/Math.max(1,southNames.length-1));hit=[center[0]+(southNames.indexOf(name)-(southNames.length-1)/2)*spacing,center[1]+hh];}else if(f.properties.corridorBundle)hit=[center[0]+hw*.5,center[1]-hh];else hit=[center[0]-hw,center[1]];index=path.length-1;}
  const point=unproject(hit),name=f.properties.symbologyName||f.properties.name,existing=ports.get(name);if(!approachPorts.has(name))approachPorts.set(name,new Map());approachPorts.get(name).set(point.map(v=>v.toFixed(9)).join(','),point);if(!existing||f.properties.corridorBundle)ports.set(name,{point,bundled:f.properties.corridorBundle});
  const original=first?f.geometry.coordinates:[...f.geometry.coordinates].reverse(),points=[point,...original.slice(index)];return {...f,properties:{...f.properties,stationPositions:f.properties.stationPositions?.map(p=>p.Code===code?{...p,coordinates:point}:p)},geometry:{...f.geometry,coordinates:first?points:points.reverse()}};
 };
 const displayed={...result.displayed,features:result.displayed.features.map(trim)},outline=[];
 // Allocate the north and east approaches together. Independent clipping
 // let New Haven routes cut across the Hudson routes before the box edge.
 const approaches=displayed.features.filter(f=>code==='NYP'&&[f.properties.from,f.properties.to].includes(code)&&['YNY','NRO'].includes(f.properties.from===code?f.properties.to:f.properties.from)),remote=f=>project(f.geometry.coordinates[f.properties.from===code?f.geometry.coordinates.length-1:0]),family=f=>(f.properties.from===code?f.properties.to:f.properties.from)==='YNY'?0:1;
 const angle=f=>{const p=remote(f);return Math.atan2(p[0]-center[0],center[1]-p[1]);};
 approaches.sort((a,b)=>angle(a)-angle(b));
 const spacing=Math.min(result.style.laneSpacing*1.3,Math.max(0,2*(hw-radius)-result.style.baseStrokeWidth)/(Math.max(1,approaches.length-1)));
 for(const [i,f]of approaches.entries()){
  const point=unproject([center[0]+(i-(approaches.length-1)/2)*spacing,center[1]-hh]),name=f.properties.symbologyName||f.properties.name,index=f.properties.from===code?0:f.geometry.coordinates.length-1;
  f.geometry.coordinates[index]=point;f.properties.stationPositions=f.properties.stationPositions?.map(p=>p.Code===code?{...p,coordinates:point}:p);if(!ports.get(name)?.bundled)ports.set(name,{point,bundled:false});
 }

 for(const [x,y,start] of [[hw-radius,hh-radius,0],[-hw+radius,hh-radius,Math.PI/2],[-hw+radius,-hh+radius,Math.PI],[hw-radius,-hh+radius,3*Math.PI/2]])for(let i=0;i<=8;i++){const a=start+i*Math.PI/16;outline.push(unproject([center[0]+x+Math.cos(a)*radius,center[1]+y+Math.sin(a)*radius]));}outline.push(outline[0]);
 const ids=new Set(result.qualifying.features.map(f=>f.properties.edgeId));
 return {...result,displayed,qualifying:{...result.qualifying,features:displayed.features.filter(f=>ids.has(f.properties.edgeId))},bundle:{...result.bundle,features:result.bundle.features.map(trim)},interchanges:{...result.interchanges,features:result.interchanges.features.map(f=>f===box?{...f,properties:{...f.properties,shape:'rounded-square',center:unproject(center),radiusPixels:Math.max(hw,hh)},geometry:{...f.geometry,coordinates:outline}}:f)},dots:{...result.dots,features:result.dots.features.flatMap(f=>f.properties.Code!==code?[f]:f.properties.symbolRoutes.flatMap(name=>(code==='WAS'?[...(approachPorts.get(name)?.values()||[f.geometry.coordinates])]:[ports.get(name)?.point||f.geometry.coordinates]).map(point=>({...f,properties:{...f.properties,symbolRoutes:[name]},geometry:{...f.geometry,coordinates:point}}))))}};
}
