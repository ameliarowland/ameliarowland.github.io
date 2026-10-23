// Enclosure ports describe approaches, not additional station stops.
// Keep one marker per service and expose internal links only to route focus.
export function connectHubRoutes(result){
 const boxes=new Set(result.interchanges.features.filter(f=>f.properties.shape==='rounded-square').map(f=>f.properties.Code)),contacts=new Map(),connections=[];
 for(const f of result.displayed.features)for(const code of [f.properties.from,f.properties.to]){
  if(!boxes.has(code))continue;const name=f.properties.symbologyName||f.properties.name,key=code+'|'+name,point=f.geometry.coordinates[f.properties.from===code?0:f.geometry.coordinates.length-1];
  if(!contacts.has(key))contacts.set(key,{code,name,feature:f,points:new Map()});contacts.get(key).points.set(point.map(v=>v.toFixed(9)).join(','),point);
 }
 for(const {code,name,feature,points}of contacts.values())if(points.size>1)connections.push({type:'Feature',properties:{...feature.properties,Code:code,name,symbologyName:name,hubConnection:true,corridorBundle:false},geometry:{type:'LineString',coordinates:[...points.values()]}});
 const seen=new Set(),dots=result.dots.features.flatMap(f=>f.properties.symbolRoutes.flatMap(name=>{
  const code=f.properties.Code,key=code+'|'+name;if(!boxes.has(code))return [{...f,properties:{...f.properties,symbolRoutes:[name]}}];if(seen.has(key))return [];seen.add(key);
  const ports=[...(contacts.get(key)?.points.values()||[])],point=code==='WAS'?ports.toSorted((a,b)=>a[1]-b[1])[0]:f.geometry.coordinates;
  return [{...f,properties:{...f.properties,symbolRoutes:[name]},geometry:{...f.geometry,coordinates:point||f.geometry.coordinates}}];
 }));
 return {...result,dots:{...result.dots,features:dots},hubConnections:{type:'FeatureCollection',features:connections}};
}
export function focusedRouteData(result,name){return {type:'FeatureCollection',features:[...result.displayed.features,...(result.hubConnections?.features||[])].filter(f=>(f.properties.symbologyName||f.properties.name)===name)};}
