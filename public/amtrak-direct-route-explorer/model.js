export const stationRouteName=name=>name==='Lincol Service Missouri River Runner'?'Lincoln Service Missouri River Runner':name;
export const collection=features=>({type:'FeatureCollection',features});
export const duration=minutes=>{const n=Math.round(minutes);return `${Math.floor(n/60)}h ${String(n%60).padStart(2,'0')}m`;};
export const routeKey=name=>stationRouteName(name).toLowerCase();
export function createTimetable(data){
 const at=new Map();
 for(const trip of data.trips)for(let i=0;i<trip.stops.length;i++){const code=trip.stops[i];if(!at.has(code))at.set(code,[]);at.get(code).push({trip,index:i});}
 function matches(start,end){const found=[];for(const {trip,index:from}of at.get(start)||[]){if(trip.noPickup?.includes(from))continue;for(let to=from+1;to<trip.stops.length;to++)if(trip.stops[to]===end&&!trip.noDropoff?.includes(to)){const minutes=trip.arrival[to]-trip.departure[from];if(minutes>0)found.push({trip,from,to,minutes});}}return found;}
 function options(start,end){const best=new Map();for(const match of matches(start,end)){const key=routeKey(match.trip.route);if(!best.has(key)||match.minutes<best.get(key).minutes)best.set(key,match);}return [...best.values()].sort((a,b)=>a.minutes-b.minutes);}
 function reachable(start,end){
  if(!start&&!end)return null;const allowed=new Set([start,end].filter(Boolean));
  if(start&&end){for(const {trip,from,to}of matches(start,end))for(let i=from;i<=to;i++)allowed.add(trip.stops[i]);return allowed;}
  const code=start||end;for(const {trip,index}of at.get(code)||[]){if(start&&!trip.noPickup?.includes(index))for(let i=index+1;i<trip.stops.length;i++)if(!trip.noDropoff?.includes(i))allowed.add(trip.stops[i]);if(end&&!trip.noDropoff?.includes(index))for(let i=0;i<index;i++)if(!trip.noPickup?.includes(i))allowed.add(trip.stops[i]);}return allowed;
 }
 return {matches,options,reachable,has:code=>at.has(code)};
}
export function singleNetwork(routes){const seen=new Set();return collection(routes.features.filter(f=>{const key=[f.properties.from,f.properties.to].sort().join('|');if(seen.has(key))return false;seen.add(key);return true;}));}
export function stationPoints(stations,layout,route=null){
 const positions=new Map();for(const dot of layout?.dots.features||[]){if(route&&!dot.properties.symbolRoutes.some(name=>routeKey(name)===routeKey(route)))continue;const code=dot.properties.Code;if(!positions.has(code))positions.set(code,[]);positions.get(code).push(dot.geometry.coordinates);}
 return collection(stations.features.filter(f=>!route||positions.has(f.properties.Code)).map(f=>{const points=positions.get(f.properties.Code),coordinates=points?.length?[points.reduce((s,p)=>s+p[0],0)/points.length,Math.atan(Math.sinh(points.reduce((s,p)=>s+Math.log(Math.tan(Math.PI/4+p[1]*Math.PI/360)),0)/points.length))*180/Math.PI]:f.geometry.coordinates;return {...f,geometry:{type:'Point',coordinates}};}));
}
