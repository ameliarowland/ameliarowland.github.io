import fs from 'node:fs';
import './offset-engine-node.mjs';
import {alignLaneFrames,optimizeLaneOrder,untangledNetwork,routeDrawingStyle,filterDisplayData} from '../public/rail-vs-air/model.js';
const load=n=>JSON.parse(fs.readFileSync('public/rail-vs-air/data/'+n,'utf8'));
const visible=filterDisplayData(load('routes.geojson'),load('stations.geojson'),[]);
const network=optimizeLaneOrder(alignLaneFrames(visible.routes));
console.log(JSON.stringify(network.orderingAudit));
const regions={philadelphia:[-75.23,39.93,-75.13,40.01],newYork:[-74.04,40.71,-73.90,40.86],newHaven:[-72.96,41.27,-72.85,41.36],richmond:[-77.51,37.51,-77.36,37.65]};
const results=[];
for(const zoom of [4,7.9,10,13,16]) {
 const start=performance.now(),shown=untangledNetwork(network,zoom,routeDrawingStyle(network,zoom),visible.stations);
 console.log('zoom',zoom,'ms',Math.round(performance.now()-start),'vertices',shown.features.reduce((n,f)=>n+f.geometry.coordinates.length,0));
 for(const [region,bounds] of Object.entries(regions)) {
  const inside=p=>p[0]>=bounds[0]&&p[0]<=bounds[2]&&p[1]>=bounds[1]&&p[1]<=bounds[3];
  results.push({region,bounds,zoom,features:shown.features.filter(f=>f.geometry.coordinates.some(inside))});
 }
}
fs.mkdirSync('work',{recursive:true});
fs.writeFileSync('work/rail-rendering-audit.json',JSON.stringify(results));
