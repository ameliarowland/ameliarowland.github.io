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
 function connections(start,end){
  if(start&&end)return matches(start,end).map(({trip,from,to})=>({route:trip.route,origin:trip.stops[from],destination:trip.stops[to]}));
  const found=[];for(const {trip,index}of at.get(start||end)||[]){
   if(start&&!trip.noPickup?.includes(index)){let last=index;for(let i=index+1;i<trip.stops.length;i++)if(!trip.noDropoff?.includes(i))last=i;if(last>index)found.push({route:trip.route,origin:start,destination:trip.stops[last]});}
   if(end&&!trip.noDropoff?.includes(index)){let first=index;for(let i=index-1;i>=0;i--)if(!trip.noPickup?.includes(i))first=i;if(first<index)found.push({route:trip.route,origin:trip.stops[first],destination:end});}
  }return found;
 }
 return {matches,options,reachable,connections,has:code=>at.has(code)};
}
export function singleNetwork(routes){const seen=new Set();return collection(routes.features.filter(f=>{const key=[f.properties.from,f.properties.to].sort().join('|');if(seen.has(key))return false;seen.add(key);return true;}));}
export function stationPoints(stations,route=null){return collection(stations.features.filter(f=>!route||(f.properties.routeNames||[]).some(name=>routeKey(name)===routeKey(route))));}
// Source graph paths only highlight track; travel times always come from GTFS.
export function createRoutePaths(routes){
 const graphs=new Map(),cache=new Map();
 routes.features.forEach((f,id)=>{const name=routeKey(f.properties.symbologyName||f.properties.name);if(!graphs.has(name))graphs.set(name,new Map());const graph=graphs.get(name);for(const [from,to]of [[f.properties.from,f.properties.to],[f.properties.to,f.properties.from]]){if(!graph.has(from))graph.set(from,[]);graph.get(from).push({to,id,cost:f.properties.distanceKm||1});}});
 return ({route,origin,destination})=>{const key=[routeKey(route),origin,destination].join('|');if(cache.has(key))return cache.get(key);const graph=graphs.get(routeKey(route)),costs=new Map([[origin,0]]),previous=new Map(),queue=new Set([origin]);while(queue.size){let current;for(const code of queue)if(current===undefined||costs.get(code)<costs.get(current))current=code;queue.delete(current);if(current===destination)break;for(const edge of graph?.get(current)||[]){const distance=costs.get(current)+edge.cost;if(distance<(costs.get(edge.to)??Infinity)){costs.set(edge.to,distance);previous.set(edge.to,{from:current,id:edge.id});queue.add(edge.to);}}}const ids=[];let current=destination;while(previous.has(current)){const edge=previous.get(current);ids.push(edge.id);current=edge.from;}const path=current===origin?ids.reverse():[];cache.set(key,path);return path;};
}
