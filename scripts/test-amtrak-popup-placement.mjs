import assert from 'node:assert/strict';
import {stationControlPlacement as place} from '../public/amtrak-direct-route-explorer/popup-placement.js';
import {stationAction} from '../public/amtrak-direct-route-explorer/model.js';
assert.deepEqual(stationAction({start:null,end:null},'A'),{role:'start',remove:false});
assert.deepEqual(stationAction({start:'A',end:null},'B'),{role:'end',remove:false});
assert.deepEqual(stationAction({start:null,end:'B'},'A'),{role:'start',remove:false});
assert.deepEqual(stationAction({start:'A',end:'B'},'A'),{role:'start',remove:true});
assert.deepEqual(stationAction({start:'A',end:'B'},'B'),{role:'end',remove:true});
assert.equal(stationAction({start:'A',end:'B'},'C'),null,'A full journey cannot silently replace an endpoint');
for(const width of [360,720,1280]){
 const view={width,height:600};
 for(const p of [{x:20,y:10},{x:width-20,y:590},{x:width/2,y:300}]){
  const result=place(p,view,{width:200,height:42});assert.equal(Math.abs(result.offset[0]),12,'The control always stays 12px from the station');
  const top=p.y-21+result.offset[1];assert(top>=8&&top+42<=592,'Nudge vertically only to stay inside the map');
 }
 assert.equal(place({x:width-20,y:300},view).anchor,'right','Flip to the left near the right edge');
 assert.equal(place({x:20,y:300},view).anchor,'left');
}
console.log('Adjacent station controls, edge placement, sequential endpoints and exact-role removal pass.');
