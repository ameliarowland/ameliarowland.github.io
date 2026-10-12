import {createLayoutEngine} from './layout-core.js?v=station-schematic-11';
let layout,pending=null,timer=null;
self.onmessage=async ({data})=>{
 if(data.type==='init') {
  try{layout=createLayoutEngine(data.routes,data.stations);self.postMessage({type:'ready'});if(pending)schedule();}
  catch(error){self.postMessage({type:'error',message:error.message});}
 }else if(data.type==='layout'){pending=data;schedule();}
};
function schedule() {
 if(!layout)return;clearTimeout(timer);
 timer=setTimeout(()=>{
  const job=pending;pending=null;if(!job)return;
  try{self.postMessage({type:'layout',...layout(job)});}catch(error){self.postMessage({type:'error',id:job.id,message:error.message});}
 },0);
}
