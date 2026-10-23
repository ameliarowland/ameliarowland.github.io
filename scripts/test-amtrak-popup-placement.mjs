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

// Independent segment/rectangle intersection check for the route being inspected.
function crosses(a,b,r){let low=0,high=1;for(let k=0;k<2;k++){const min=k?r.y-5:r.x-5,max=min+(k?r.height:r.width)+10,d=b[k]-a[k];if(!d){if(a[k]<min||a[k]>max)return false;}else{const t=[(min-a[k])/d,(max-a[k])/d].sort((a,b)=>a-b);low=Math.max(low,t[0]);high=Math.min(high,t[1]);}}return high>low;}
for(const scale of [.6,1,1.8])for(const path of [
 [[-400,0],[0,0],[400,0]],[[0,-400],[0,0],[0,400]],
 [[-400,300],[0,0],[400,-300]],[[-400,0],[0,0],[150,-400]],
 [[-200,-400],[0,0],[400,100]]
]){
 const route=path.map(([x,y])=>[p.x+x*scale,p.y+y*scale]);
 const result=place(p,viewport,[route],{width:200,height:130,priorityPaths:[route]});
 for(let i=1;i<route.length;i++)assert(!crosses(route[i-1],route[i],result.rect),'Keep the inspected route clear at different zoom scales and bends');
 assert(Math.hypot(result.rect.x+result.tip.x-p.x,result.rect.y+result.tip.y-p.y)<160,'Keep the popup tether reasonably short');
}
const denseRoutes=Array.from({length:30},(_,i)=>[[300,310+i*2],[800,310+i*2]]),dense=place({x:500,y:350},{width:1000,height:700},denseRoutes,{width:200,height:130});
for(const route of denseRoutes)assert(!crosses(...route,dense.rect),'Move above or below a dense corridor instead of covering it');
console.log('Inspected horizontal, vertical, diagonal, bent and dense routes remain clear across zoom scales.');
