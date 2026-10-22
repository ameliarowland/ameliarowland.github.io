import {createSchematicEngine} from './schematic.js?v=amtrak-1';
let engine;
self.onmessage=({data})=>{try{if(data.type==='init'){engine=createSchematicEngine(data.routes,data.stations);self.postMessage({type:'ready'});}else if(engine){const result=engine.render({...data,circleStations:false,records:[]});self.postMessage({type:'layout',id:data.id,displayed:result.displayed,dots:result.dots,style:result.style,paths:(data.journeys||[]).flatMap(r=>engine.journey(r))});}}catch(error){self.postMessage({type:'error',message:error.message});}};
