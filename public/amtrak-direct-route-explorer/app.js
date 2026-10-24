import {stationControlPlacement} from './popup-placement.js?v=amtrak-17';
import {collection,createTimetable,duration,routeKey,singleNetwork,stationPoints,createRoutePaths,stationAction} from './model.js?v=amtrak-17';
const $=id=>document.getElementById(id),base='/amtrak-direct-route-explorer/',params=new URLSearchParams(location.search);
document.documentElement.classList.toggle('embedded',window.self!==window.top||params.get('embed')==='1');
const state={start:null,end:null,route:null,showStations:params.get('stations')==='on'};
let map,timetable,stations,routes,metadata,byCode,findPath=null,journeyPaths=[],allowed=null,options=[],hoveredStation='',hoveredRoute=null,popup=null,popupCode=null;
const routeName=f=>f.properties.symbologyName||f.properties.name;
const title=code=>byCode.get(code)?.properties.title||code;
const color=name=>metadata.routeColors[name]||Object.entries(metadata.routeColors).find(([key])=>routeKey(key)===routeKey(name))?.[1]||'#e9bc4c';
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function syncURL(){const p=new URLSearchParams();for(const field of ['start','end','route'])if(state[field])p.set(field,state[field]);if(state.showStations)p.set('stations','on');else if(state.start||state.end)p.set('stations','off');history.replaceState(null,'',location.pathname+(p.size?'?'+p:''));}
function source(id,data){map.getSource(id).setData(data);}
function closePopup(){if(popup)popup.remove();popup=null;popupCode=null;}
function setEndpoint(role,code){if(!byCode.has(code))return;const other=role==='start'?'end':'start';if(state[role]===code)state[role]=null;else{state[role]=code;if(state[other]===code)state[other]=null;}closePopup();updateJourney();}
function updateJourney(){
 if(Boolean(state.start)!==Boolean(state.end)){state.route=null;hoveredRoute=null;}
 allowed=timetable.reachable(state.start,state.end);options=state.start&&state.end?timetable.options(state.start,state.end):[];if(options.length&&state.route&&!options.some(o=>routeKey(o.trip.route)===routeKey(state.route)))state.route=null;
 for(const role of ['start','end'])$(role).value=state[role]||'';
 $('journey-panel').open=true;$('journey-panel').classList.toggle('has-journey',Boolean(state.start&&state.end));$('journey-panel').scrollTop=0;const results=$('journey-results');results.replaceChildren();
 if(state.start&&state.end){$('journey-status').textContent=options.length?`${title(state.start)} → ${title(state.end)} · ${options.length} direct service${options.length===1?'':'s'}. Fastest scheduled time per service.`:'No direct train in this timetable snapshot. Clear an endpoint to explore other stations.';
  for(const option of options){const {trip,minutes}=option,article=document.createElement('article'),button=document.createElement('button'),name=document.createElement('span'),time=document.createElement('strong'),details=document.createElement('details'),summary=document.createElement('summary'),evidence=document.createElement('p');article.className='journey-result';button.type='button';button.className='journey-choice';button.style.setProperty('--route-color',color(trip.route));button.setAttribute('aria-label',`${trip.route} · ${duration(minutes)} · show journey`);button.setAttribute('aria-pressed',String(routeKey(state.route||'')===routeKey(trip.route)));name.textContent=trip.route;time.textContent=duration(minutes);button.append(name,time);button.onclick=()=>{state.route=trip.route;syncURL();render();for(const b of results.querySelectorAll('.journey-choice'))b.setAttribute('aria-pressed',String(b===button));fitJourney();};summary.textContent='Timetable details';evidence.textContent=`Train ${trip.number||trip.id} · ${trip.dates.join(', ')}. Scheduled elapsed time includes intermediate stops. Departure ${clock(trip.departure[option.from])}, arrival ${clock(trip.arrival[option.to])} in the GTFS agency time zone. Trip ${trip.id}.`;details.append(summary,evidence);article.append(button,details);results.append(article);}
 }else if(state.start||state.end){const count=Math.max(0,allowed.size-1),role=state.start?'destinations':'origins';$('journey-status').textContent=`${count} direct ${role} ${state.start?'from':'to'} ${title(state.start||state.end)}. Choose your ${state.start?'end':'start'} station on the map.`;}else $('journey-status').textContent='Choose a station on the map or search above. Start shows direct destinations; End shows direct origins.';
 journeyPaths=state.start&&state.end?options.flatMap(({trip})=>findPath({route:trip.route,origin:state.start,destination:state.end})):timetable.connections(state.start,state.end).flatMap(findPath);syncURL();render();
}
function clock(minutes){const n=Math.round(minutes),day=Math.floor(n/1440);return `${String(Math.floor(n%1440/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}${day?' (day +'+day+')':''}`;}
const stationPreviews=new Map();
function previewFor(code){
 if(!stationPreviews.has(code))stationPreviews.set(code,{allowed:new Set([...timetable.reachable(code,null),...timetable.reachable(null,code)]),paths:new Set([...timetable.connections(code,null),...timetable.connections(null,code)].flatMap(findPath))});
 return stationPreviews.get(code);
}
function render(){
 if(!map?.getSource('stations'))return;const focus=hoveredRoute||state.route,active=Boolean(state.start||state.end),previewCode=!active&&!state.showStations?(hoveredStation||popupCode):null,preview=previewCode?previewFor(previewCode):null,visibleStations=state.showStations||Boolean(focus)||active||Boolean(preview);
 for(const id of ['stations','station-icons','station-hit'])map.setLayoutProperty(id,'visibility',visibleStations?'visible':'none');$('toggle-stations').setAttribute('aria-pressed',String(state.showStations));
 const points=preview?collection(stations.features.filter(f=>preview.allowed.has(f.properties.Code))):stationPoints(stations,!active&&!state.showStations?focus:null);source('stations',points);
 const displayAllowed=preview?.allowed||allowed,stationFilter=displayAllowed?['in',['get','Code'],['literal',[...displayAllowed]]]:null;for(const id of ['stations','station-icons','station-hit'])map.setFilter(id,stationFilter);
 map.setPaintProperty('stations','circle-radius',['interpolate',['linear'],['zoom'],3,['case',['==',['get','Code'],hoveredStation],8,['any',['==',['get','Code'],state.start||''],['==',['get','Code'],state.end||'']],7,3.2],8,['case',['==',['get','Code'],hoveredStation],8,['any',['==',['get','Code'],state.start||''],['==',['get','Code'],state.end||'']],7,5.5]]);
 map.setPaintProperty('stations','circle-color',['case',['==',['get','Code'],state.start||''],'#146a5a',['==',['get','Code'],state.end||''],'#b75634','#183d33']);
 map.setLayoutProperty('station-icons','icon-size',['interpolate',['linear'],['zoom'],3,['case',['==',['get','Code'],hoveredStation],.30,.12],8,['case',['==',['get','Code'],hoveredStation],.30,.22]]);
 const features=routes.features,journeyIds=new Set(journeyPaths),selectedOptions=state.route?options.filter(o=>routeKey(o.trip.route)===routeKey(state.route)):options;
 const selectedNames=new Set(selectedOptions.map(o=>routeKey(o.trip.route)));const highlighted=preview?features.filter(f=>preview.paths.has(f.properties.edgeId)):active&&!(state.start&&state.end)?features.filter(f=>journeyIds.has(f.properties.edgeId)):state.start&&state.end?features.filter(f=>journeyIds.has(f.properties.edgeId)&&(!state.route||selectedNames.has(routeKey(routeName(f))))):focus?features.filter(f=>routeKey(routeName(f))===routeKey(focus)):[];
 source('focus',collection(highlighted));
 $('clear-route').hidden=!state.route;$('fit-journey').hidden=!state.start||!state.end;$('route-name').hidden=!focus&&!previewCode;$('route-name').textContent=previewCode?`${title(previewCode)} · direct trains`:focus||'';if(focus||previewCode)$('route-name').style.setProperty('--route-color',previewCode?'#466f5e':color(focus));
 $('map-status').textContent=previewCode?`${Math.max(0,preview.allowed.size-1)} direct stations from or to ${previewCode}`:state.start&&state.end?`${allowed.size} stations on direct trains between your endpoints`:allowed?`${Math.max(0,allowed.size-1)} directly accessible stations`:focus?`${focus} · ${points.features.length} stations`:state.showStations?`${stations.features.length} stations · Select a station or route to explore`:'Hover or select a route to see its stations';
}
function fitJourney(){const codes=allowed||new Set([state.start,state.end].filter(Boolean));const bounds=new maplibregl.LngLatBounds();for(const f of stations.features)if(codes.has(f.properties.Code))bounds.extend(f.geometry.coordinates);if(!bounds.isEmpty())map.fitBounds(bounds,{padding:map.getContainer().clientWidth>650?{top:60,bottom:65,left:$('journey-panel').getBoundingClientRect().width+30,right:110}:{top:$('journey-panel').open?Math.min($('journey-panel').getBoundingClientRect().height+30,map.getContainer().clientHeight*.65):70,bottom:80,left:35,right:55},maxZoom:10,duration:reduced()?0:650});}
function fitNetwork(){
 const bounds=new maplibregl.LngLatBounds();for(const f of routes.features)for(const point of f.geometry.coordinates)bounds.extend(point);
 const panel=$('journey-panel'),wide=map.getContainer().clientWidth>650,padding=wide?{left:panel.getBoundingClientRect().width+30,right:110,top:30,bottom:45}:{left:20,right:95,top:panel.open?panel.getBoundingClientRect().height+25:65,bottom:45};
 map.fitBounds(bounds,{padding,duration:0});
}
function withinStationControl(point){
 if(!popup||!popupCode)return false;
 const button=popup.getElement().querySelector('button');if(!button)return false;
 const bounds=map.getContainer().getBoundingClientRect(),rect=button.getBoundingClientRect(),station=map.project(byCode.get(popupCode).geometry.coordinates);
 return point.x>=Math.min(station.x-18,rect.left-bounds.left-10)&&point.x<=Math.max(station.x+18,rect.right-bounds.left+10)&&point.y>=Math.min(station.y-18,rect.top-bounds.top-10)&&point.y<=Math.max(station.y+18,rect.bottom-bounds.top+10);
}
function stationPopup(feature){
 const code=feature.properties.Code;if(popupCode===code&&popup)return;closePopup();popupCode=code;
 const element=document.createElement('div');element.className='station-control';
 const action=timetable.has(code)?stationAction(state,code):null;
 if(timetable.has(code)){
  const button=document.createElement('button');button.type='button';button.className='station-add';button.textContent=action?.remove?'−':'+';button.disabled=!action;
  const label=action?`${action.remove?'Remove':'Add'} ${code} as ${action.role}`:'Remove a selected station before adding '+code;
  button.setAttribute('aria-label',label);button.title=action?`${action.remove?'Remove':'Set as'} ${action.role}`:'Remove Start or End first';
  button.dataset.role=action?.role||'';button.dataset.remove=String(Boolean(action?.remove));
  button.onclick=event=>{event.stopPropagation();if(!action)return;setEndpoint(action.role,code);stationPopup(feature);render();};
  element.append(button);
 }
 const label=document.createElement('div');label.className='station-label';
 const heading=document.createElement('strong'),detail=document.createElement('span');heading.textContent=title(code);detail.textContent=code+(state.start===code?' · Start':state.end===code?' · End':'');label.append(heading,detail);element.append(label);
 // Marker controls stay attached to their point; route geometry never moves them away.
 const point=map.project(feature.geometry.coordinates),container=map.getContainer();
 label.style.maxWidth=Math.max(80,Math.min(document.documentElement.classList.contains('embedded')?144:174,Math.max(point.x,container.clientWidth-point.x)-66))+'px';
 element.style.position='absolute';element.style.visibility='hidden';container.append(element);const size=element.getBoundingClientRect();
 const place=stationControlPlacement(point,{width:container.clientWidth,height:container.clientHeight},size);element.classList.toggle('opens-left',place.anchor==='right');
 popup=new maplibregl.Marker({element,anchor:place.anchor,offset:place.offset}).setLngLat(feature.geometry.coordinates).addTo(map);element.style.visibility='';render();
}
async function init(){
 try{
  const [stationData,routeData,times,manifest]=await Promise.all(['stations.geojson','routes.geojson','timetable.json','manifest.json'].map(async file=>{const response=await fetch(base+'data/'+file);if(!response.ok)throw Error('Could not load '+file);return response.json();}));stations=stationData;routes=routeData;metadata=manifest;routes.features.forEach((f,i)=>f.properties.edgeId=i);findPath=createRoutePaths(routes);byCode=new Map(stations.features.map(f=>[f.properties.Code,f]));timetable=createTimetable(times);
  for(const station of [...stations.features].sort((a,b)=>a.properties.title.localeCompare(b.properties.title))){const option=document.createElement('option');option.value=station.properties.Code;option.label=station.properties.title;$('station-options').append(option);}for(const role of ['start','end'])if(byCode.has(params.get(role)))state[role]=params.get(role);if(state.start===state.end)state.end=null;const routeNames=new Set(routes.features.map(routeName));if(routeNames.has(params.get('route')))state.route=params.get('route');
  map=new maplibregl.Map({container:'map',style:'https://tiles.openfreemap.org/styles/fiord',bounds:[[-125,24],[-66,50]],fitBoundsOptions:{padding:35},maxZoom:16});$('zoom-in').onclick=()=>map.zoomIn();$('zoom-out').onclick=()=>map.zoomOut();
  map.on('load',()=>{
   const baseLayers=new Set(map.getStyle().layers.map(l=>l.id)),baseSources=new Set(Object.keys(map.getStyle().sources));
   const empty=collection([]);for(const [id,data]of [['single',singleNetwork(routes)],['stations',stations],['focus',empty]])map.addSource(id,{type:'geojson',tolerance:0,data});
   map.addLayer({id:'single',type:'line',source:'single',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#91baa8','line-width':3}});map.addLayer({id:'route-hit',type:'line',source:'single',paint:{'line-width':16,'line-opacity':0}});
   map.addLayer({id:'focus-outline',type:'line',source:'focus',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#fffdf7','line-width':6}});map.addLayer({id:'focus',type:'line',source:'focus',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#b3e1c8','line-width':4}});
   map.addLayer({id:'stations',type:'circle',source:'stations',paint:{'circle-radius':6,'circle-color':'#183d33','circle-stroke-color':'#fffdf7','circle-stroke-width':1.2}});
   const canvas=document.createElement('canvas');canvas.width=canvas.height=48;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.beginPath();ctx.roundRect(11,5,26,31,5);ctx.fill();ctx.fillStyle='#183d33';ctx.fillRect(15,11,18,11);ctx.fillStyle='#fff';for(const x of [17,31]){ctx.beginPath();ctx.arc(x,29,2,0,Math.PI*2);ctx.fill();}ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(17,35);ctx.lineTo(12,42);ctx.moveTo(31,35);ctx.lineTo(36,42);ctx.moveTo(15,39);ctx.lineTo(33,39);ctx.stroke();map.addImage('train',ctx.getImageData(0,0,48,48));
   map.addLayer({id:'station-icons',type:'symbol',source:'stations',layout:{'icon-image':'train','icon-size':.30,'icon-allow-overlap':true,'icon-ignore-placement':true}});map.addLayer({id:'station-hit',type:'circle',source:'stations',paint:{'circle-radius':matchMedia('(pointer:coarse)').matches?22:18,'circle-opacity':0}});
   let basemapMode='fiord';
   const trainImage=ctx.getImageData(0,0,48,48);
   map.on('style.load',()=>{if(!map.hasImage('train'))map.addImage('train',trainImage);render();});
   for(const button of document.querySelectorAll('[data-basemap]'))button.onclick=async()=>{
    const mode=button.dataset.basemap;if(mode===basemapMode)return;
    const buttons=[...document.querySelectorAll('[data-basemap]')];buttons.forEach(b=>b.disabled=true);closePopup();
    try{
     const response=await fetch('https://tiles.openfreemap.org/styles/'+mode);if(!response.ok)throw Error('Basemap unavailable');
     const base=await response.json(),current=map.getStyle(),layers=current.layers.filter(l=>!baseLayers.has(l.id)),sources=Object.fromEntries(Object.entries(current.sources).filter(([id])=>!baseSources.has(id)));
     const light=mode==='positron';for(const layer of layers)if(['single','focus','focus-outline'].includes(layer.id))layer.paint['line-color']=layer.id==='single'?(light?'#466f5e':'#91baa8'):layer.id==='focus'?(light?'#146a5a':'#b3e1c8'):'#fffdf7';
     baseLayers.clear();base.layers.forEach(l=>baseLayers.add(l.id));baseSources.clear();Object.keys(base.sources).forEach(id=>baseSources.add(id));
     map.setStyle({...base,sources:{...base.sources,...sources},layers:[...base.layers,...layers]});basemapMode=mode;buttons.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    }catch(error){console.error(error);$('map-status').textContent='Basemap unavailable. Try again.';}finally{buttons.forEach(b=>b.disabled=false);}
   };
   map.on('zoomend',closePopup);map.on('dragstart',closePopup);map.on('resize',closePopup);
   const stationAt=point=>map.queryRenderedFeatures(point,{layers:['station-hit']}).filter(f=>!allowed||allowed.has(f.properties.Code)).sort((a,b)=>{const p=map.project(a.geometry.coordinates),q=map.project(b.geometry.coordinates);return Math.hypot(p.x-point.x,p.y-point.y)-Math.hypot(q.x-point.x,q.y-point.y);})[0];
   const routeAt=point=>{const hits=map.queryRenderedFeatures(point,{layers:['route-hit']});let best=null,distance=Infinity;for(const f of hits)for(let i=1;i<f.geometry.coordinates.length;i++){const a=map.project(f.geometry.coordinates[i-1]),b=map.project(f.geometry.coordinates[i]),dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy);if(d<distance){distance=d;best=routeName(f);}}return best;};
   map.on('mousemove',event=>{if(withinStationControl(event.point))return;const station=stationAt(event.point),code=station?.properties.Code||'',route=station?(!state.showStations?hoveredRoute:null):routeAt(event.point);map.getCanvas().style.cursor=station||route?'pointer':'';if(code!==hoveredStation||route!==hoveredRoute){hoveredStation=code;hoveredRoute=route;render();}if(station)stationPopup(station);});
   map.getCanvas().addEventListener('mouseleave',()=>{hoveredStation='';hoveredRoute=null;render();});
   map.on('click',event=>{const station=stationAt(event.point);if(station){stationPopup(station);return;}closePopup();const name=routeAt(event.point);state.route=state.route===name?null:name;hoveredRoute=null;syncURL();render();});
   updateJourney();if(state.start&&state.end)fitJourney();else if(!state.start&&!state.end)fitNetwork();
   $('journey-panel').addEventListener('toggle',()=>{if(!state.start&&!state.end)fitNetwork();});map.on('resize',()=>{if(!state.start&&!state.end)fitNetwork();});
  });
  const resolveStation=value=>{const query=value.trim().toUpperCase();if(byCode.has(query))return query;const found=stations.features.filter(f=>f.properties.title.toLowerCase().includes(value.trim().toLowerCase()));return found.length===1?found[0].properties.Code:null;};
  $('journey-form').onsubmit=event=>event.preventDefault();
  for(const role of ['start','end']){
   const input=$(role),update=()=>{const value=input.value,code=value.trim()?resolveStation(value):null,other=role==='start'?'end':'start';if(code&&code===state[other]){state[role]=null;closePopup();updateJourney();input.value=value;$('journey-status').textContent='Choose two different stations.';return;}if(code===state[role])return;state[role]=code;closePopup();updateJourney();if(!code)input.value=value;if(state.start&&state.end)fitJourney();};input.addEventListener('input',update);input.addEventListener('change',update);
  }
  for(const role of ['start','end'])$('clear-'+role).onclick=()=>{state[role]=null;closePopup();updateJourney();};$('swap').onclick=()=>{[state.start,state.end]=[state.end,state.start];closePopup();updateJourney();};
  $('toggle-stations').onclick=()=>{state.showStations=!state.showStations;hoveredStation='';closePopup();syncURL();render();};$('clear-route').onclick=()=>{state.route=null;hoveredRoute=null;syncURL();render();};$('home').onclick=fitNetwork;$('fit-journey').onclick=fitJourney;
 }catch(error){console.error(error);$('map-status').textContent='The map could not load. Please reload to try again.';}
}
init();
