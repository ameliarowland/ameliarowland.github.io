import {alignLaneFrames,optimizeLaneOrder,anchorStationGeometry,untangledNetwork,routeDrawingStyle,networkHighlights,stationRouteName} from './model.js?v=raw-geometry-4';
export function createLayoutEngine(routes,stations,shapes,engine) {
 const network=anchorStationGeometry(optimizeLaneOrder(alignLaneFrames(routes)),stations);
 const colors=new Map(network.features.map(f=>[stationRouteName(f.properties.symbologyName||f.properties.name),f.properties.color||'#fff']));
 const indexed=network.features.map(f=>{
  let west=Infinity,south=Infinity,east=-Infinity,north=-Infinity;
  for(const p of f.geometry.coordinates){west=Math.min(west,p[0]);east=Math.max(east,p[0]);south=Math.min(south,p[1]);north=Math.max(north,p[1]);}
  return {f,box:[west,south,east,north]};
 });
 const cache=new Map();
 function inView(bounds,zoom) {
  if(!bounds)return network;
  const margin=Math.max(.015,360*256/(512*2**zoom));
  const [west,south,east,north]=[bounds[0]-margin,bounds[1]-margin,bounds[2]+margin,bounds[3]+margin],features=[];
  for(const {f,box} of indexed) {
   if(box[2]<west||box[0]>east||box[3]<south||box[1]>north)continue;
   if(box[0]>=west&&box[2]<=east&&box[1]>=south&&box[3]<=north){features.push(f);continue;}
   const p=f.geometry.coordinates;let run=[];
   for(let i=1;i<p.length;i++) {
    const a=p[i-1],b=p[i],visible=Math.max(a[0],b[0])>=west&&Math.min(a[0],b[0])<=east&&Math.max(a[1],b[1])>=south&&Math.min(a[1],b[1])<=north;
    if(visible){if(!run.length)run.push(a);run.push(b);}
    else if(run.length){features.push({...f,geometry:{type:'LineString',coordinates:run}});run=[];}
   }
   if(run.length)features.push({...f,geometry:{type:'LineString',coordinates:run}});
  }
  // Source vertices inside the view are retained verbatim. The margin keeps
  // drawing caps and junction context outside the visible map.
  return {...network,features};
 }
 return job=>{
  const started=performance.now(),key=job.zoom.toFixed(2)+'|'+(job.bounds||[]).map(v=>v.toFixed(4)).join(','),style=routeDrawingStyle(network,job.zoom);
  let cached=cache.get(key);const cacheHit=!!cached;
  if(!cached) {
   const source=inView(job.bounds,job.zoom),displayed=untangledNetwork(source,job.zoom,style,stations,engine),positions=new Map();
   for(const f of displayed.features)for(const s of f.properties.stationPositions)positions.set(s.Code+'|'+s.name,s.coordinates);
   const dots={type:'FeatureCollection',features:stations.features.flatMap(s=>(s.properties.routeNames||[]).map(name=>({
    type:'Feature',properties:{...s.properties,symbolRoutes:[name],stopStatus:'stop',color:colors.get(name)||'#fff',radius:Math.max(2,Math.min(4.8,1.7+Math.max(0,job.zoom-3)*.26,style.spacing*.5-1)),ringWidth:Math.min(1.8,.75+Math.max(0,job.zoom-3)*.08,style.spacing*.18)},
    geometry:{type:'Point',coordinates:positions.get(s.properties.Code+'|'+name)||s.geometry.coordinates}
   })))};
   cached={displayed,dots};cache.set(key,cached);if(cache.size>2)cache.delete(cache.keys().next().value);
  }
  const qualifying=networkHighlights(job.records,shapes,cached.displayed,name=>colors.get(stationRouteName(name))||'#c1673e');
  return {id:job.id,key,zoom:job.zoom,style,...cached,qualifying,cacheHit,layoutMilliseconds:Math.round(performance.now()-started)};
 };
}
