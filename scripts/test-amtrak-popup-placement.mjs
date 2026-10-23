import assert from 'node:assert/strict';import {corridorPopupPlacement as place,popupTip} from '../public/amtrak-direct-route-explorer/popup-placement.js';
const viewport={width:1000,height:600},p={x:500,y:300};
assert.equal(place(p,viewport,[[[550,100],[550,500]]]).anchor,'right','Avoid routes on the right by placing the picker to the left');
assert.equal(place(p,viewport,[[[450,100],[450,500]]]).anchor,'left','Avoid routes on the left by placing the picker to the right');
assert.equal(place({x:950,y:300},viewport,[]).anchor,'right','Use the left side near the right edge');
assert.equal(place({x:30,y:300},viewport,[]).anchor,'left','Use the right side near the left edge');
for(const [width,height]of [[1000,600],[320,360]])for(const point of [{x:20,y:15},{x:width-20,y:height-15}]){const {rect}=place(point,{width,height},[]);assert(rect.x>=12&&rect.y>=12&&rect.x+rect.width<=width-12&&rect.y+rect.height<=height-12,'Keep the picker inside the map');}
console.log('Side selection, route avoidance, and edge/mobile containment pass.');

const rect={x:300,y:100,width:220,height:280};
assert.deepEqual(popupTip({x:270,y:135},rect),{side:'left',x:0,y:35},'Arrow can sit near the top of a side');
assert.deepEqual(popupTip({x:270,y:340},rect),{side:'left',x:0,y:240},'Arrow can slide down that same side');
assert.equal(popupTip({x:550,y:240},rect).side,'right');
assert.equal(popupTip({x:370,y:60},rect).side,'top');
assert.equal(popupTip({x:470,y:420},rect).side,'bottom');
console.log('Pointer slides along all four edges without moving the box.');

const homeView={width:1280,height:620,obstacles:[{x:1198,y:282,width:80,height:278}]},home=place({x:981,y:272},homeView,[]);for(const o of homeView.obstacles)assert(home.rect.x+home.rect.width<=o.x||home.rect.x>=o.x+o.width||home.rect.y+home.rect.height<=o.y||home.rect.y>=o.y+o.height,'Home-view popup avoids the map buttons');
console.log('Initial/Home popup avoids map controls.');

const crowded={width:1000,height:700,obstacles:[{x:850,y:400,width:100,height:200}]},stationPoint={x:500,y:350},denseRoutes=Array.from({length:30},(_,i)=>[[300,310+i*2],[800,310+i*2]]),near=place(stationPoint,crowded,denseRoutes,{width:220,height:140,near:true});assert(Math.hypot(near.rect.x+near.tip.x-stationPoint.x,near.rect.y+near.tip.y-stationPoint.y)<=13,'Station picker stays beside the marker even in a dense route network');
console.log('Station picker stays close to its marker.');
