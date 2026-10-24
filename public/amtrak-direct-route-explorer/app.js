import {stationControlPlacement} from './popup-placement.js?v=amtrak-21';
import {collection,createTimetable,duration,routeKey,singleNetwork,createRoutePaths,stationAction} from './model.js?v=amtrak-21';
const $=id=>document.getElementById(id),base='/amtrak-direct-route-explorer/',params=new URLSearchParams(location.search);
document.documentElement.classList.toggle('embedded',window.self!==window.top||params.get('embed')==='1');
const state={start:null,end:null,route:null};
const endpointMarkers=new Map();
let basemapMode='fiord';
let map,timetable,stations,routes,metadata,byCode,findPath=null,journeyPaths=[],allowed=null,options=[],hoveredStation='',hoveredRoute=null,popup=null,popupCode=null;
const routeName=f=>f.properties.symbologyName||f.properties.name;
const title=code=>byCode.get(code)?.properties.title||code;
const color=name=>metadata.routeColors[name]||Object.entries(metadata.routeColors).find(([key])=>routeKey(key)===routeKey(name))?.[1]||'#e9bc4c';
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function syncURL(){const p=new URLSearchParams();for(const field of ['start','end','route'])if(state[field])p.set(field,state[field]);history.replaceState(null,'',location.pathname+(p.size?'?'+p:''));}
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
function render(){
 if(!map?.getSource('stations'))return;const focus=hoveredRoute||state.route,active=Boolean(state.start||state.end);
 source('stations',stations);for(const id of ['stations','station-hit'])map.setFilter(id,null);
 const selected=['any',['==',['get','Code'],state.start||''],['==',['get','Code'],state.end||'']],reachable=allowed?['in',['get','Code'],['literal',[...allowed]]]:true;
 map.setPaintProperty('stations','circle-radius',['interpolate',['linear'],['zoom'],3,['case',selected,5.5,['==',['get','Code'],hoveredStation],5,3],8,['case',selected,6,['==',['get','Code'],hoveredStation],6,4.5]]);
 map.setPaintProperty('stations','circle-color',['case',['==',['get','Code'],state.start||''],'#146a5a',['==',['get','Code'],state.end||''],'#b75634',basemapMode==='positron'?'#fffdf7':'#43516b']);
  map.setPaintProperty('stations','circle-stroke-width',['case',selected,1.8,1.3]);
 // An opaque basemap-colored interior cuts the route out beneath the ring.
 map.setPaintProperty('stations','circle-opacity',1);map.setPaintProperty('stations','circle-stroke-opacity',['case',reachable,1,.35]);
 syncEndpointMarkers();
 const features=routes.features,journeyIds=new Set(journeyPaths),selectedOptions=state.route?options.filter(o=>routeKey(o.trip.route)===routeKey(state.route)):options;
 const selectedNames=new Set(selectedOptions.map(o=>routeKey(o.trip.route)));const highlighted=active&&!(state.start&&state.end)?features.filter(f=>journeyIds.has(f.properties.edgeId)):state.start&&state.end?features.filter(f=>journeyIds.has(f.properties.edgeId)&&(!state.route||selectedNames.has(routeKey(routeName(f))))):focus?features.filter(f=>routeKey(routeName(f))===routeKey(focus)):[];
 const highlightedCodes=new Set(highlighted.flatMap(f=>[f.properties.from,f.properties.to])),highlightedStation=['in',['get','Code'],['literal',[...highlightedCodes]]];
 map.setPaintProperty('stations','circle-stroke-color',['case',selected,'#fffdf7',highlightedStation,basemapMode==='positron'?'#146a5a':'#b3e1c8',basemapMode==='positron'?'#466f5e':'#91baa8']);
 map.setPaintProperty('single','line-opacity',active?.35:1);
 source('focus',collection(highlighted));
 $('clear-route').hidden=!state.route;$('fit-journey').hidden=!state.start||!state.end;$('route-name').hidden=!focus;$('route-name').textContent=focus||'';if(focus)$('route-name').style.setProperty('--route-color',color(focus));
 $('map-status').textContent=state.start&&state.end?`${allowed.size} stations on direct trains between your endpoints`:allowed?`${Math.max(0,allowed.size-1)} directly accessible stations`:focus?`${focus} · route highlighted`:`${stations.features.length} stations · Tap a circle to add Start, then End`;
}
function fitJourney(){const codes=allowed||new Set([state.start,state.end].filter(Boolean));const bounds=new maplibregl.LngLatBounds();for(const f of stations.features)if(codes.has(f.properties.Code))bounds.extend(f.geometry.coordinates);if(!bounds.isEmpty())map.fitBounds(bounds,{padding:map.getContainer().clientWidth>650?{top:60,bottom:65,left:$('journey-panel').getBoundingClientRect().width+30,right:110}:{top:$('journey-panel').open?Math.min($('journey-panel').getBoundingClientRect().height+30,map.getContainer().clientHeight*.65):70,bottom:80,left:35,right:55},maxZoom:10,duration:reduced()?0:650});}
function fitNetwork(){
 const bounds=new maplibregl.LngLatBounds();for(const f of routes.features)for(const point of f.geometry.coordinates)bounds.extend(point);
 const panel=$('journey-panel'),wide=map.getContainer().clientWidth>650,padding=wide?{left:panel.getBoundingClientRect().width+30,right:110,top:30,bottom:45}:{left:20,right:95,top:panel.open?panel.getBoundingClientRect().height+25:65,bottom:45};
 map.fitBounds(bounds,{padding,duration:0});
}
function syncEndpointMarkers(){
 for(const role of ['start','end']){
  const existing=endpointMarkers.get(role),code=state[role];if(existing?.code===code)continue;
  if(existing){existing.marker.remove();endpointMarkers.delete(role);}if(!code)continue;
  const button=document.createElement('button');button.type='button';button.className='station-remove';button.dataset.role=role;button.setAttribute('aria-label',`Remove ${role} station ${code}`);button.title=`Remove ${role}`;button.innerHTML='<span aria-hidden="true">−</span>';
  button.onclick=event=>{event.stopPropagation();setEndpoint(role,code);};
  const marker=new maplibregl.Marker({element:button,anchor:'center',offset:[14,-13]}).setLngLat(byCode.get(code).geometry.coordinates).addTo(map);endpointMarkers.set(role,{code,marker});
 }
}
function stationPopup(feature){
 const code=feature.properties.Code;if(popupCode===code&&popup)return;closePopup();popupCode=code;
 const label=document.createElement('div');label.className='station-name';label.textContent=title(code);label.style.position='absolute';label.style.visibility='hidden';
 const container=map.getContainer(),point=map.project(feature.geometry.coordinates);container.append(label);const size=label.getBoundingClientRect(),place=stationControlPlacement(point,{width:container.clientWidth,height:container.clientHeight},size);
 popup=new maplibregl.Marker({element:label,anchor:place.anchor,offset:place.offset}).setLngLat(feature.geometry.coordinates).addTo(map);label.style.visibility='';
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
   map.addLayer({id:'station-hit',type:'circle',source:'stations',paint:{'circle-radius':matchMedia('(pointer:coarse)').matches?22:18,'circle-opacity':0}});
   map.on('style.load',render);
   for(const button of document.querySelectorAll('[data-basemap]'))button.onclick=async()=>{
    const mode=button.dataset.basemap;if(mode===basemapMode)return;
    const buttons=[...document.querySelectorAll('[data-basemap]')];buttons.forEach(b=>b.disabled=true);closePopup();
    try{
     const response=await fetch('https://tiles.openfreemap.org/styles/'+mode);if(!response.ok)throw Error('Basemap unavailable');
     const base=await response.json(),current=map.getStyle(),layers=current.layers.filter(l=>!baseLayers.has(l.id)),sources=Object.fromEntries(Object.entries(current.sources).filter(([id])=>!baseSources.has(id)));
     const light=mode==='positron';for(const layer of layers)if(['single','focus','focus-outline'].includes(layer.id))layer.paint['line-color']=layer.id==='single'?(light?'#466f5e':'#91baa8'):layer.id==='focus'?(light?'#146a5a':'#b3e1c8'):'#fffdf7';
     baseLayers.clear();base.layers.forEach(l=>baseLayers.add(l.id));baseSources.clear();Object.keys(base.sources).forEach(id=>baseSources.add(id));
     map.setStyle({...base,sources:{...base.sources,...sources},layers:[...base.layers,...layers]});basemapMode=mode;render();buttons.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    }catch(error){console.error(error);$('map-status').textContent='Basemap unavailable. Try again.';}finally{buttons.forEach(b=>b.disabled=false);}
   };
   map.on('zoomend',closePopup);map.on('dragstart',closePopup);map.on('resize',closePopup);
   const stationAt=point=>map.queryRenderedFeatures(point,{layers:['station-hit']}).sort((a,b)=>{const p=map.project(a.geometry.coordinates),q=map.project(b.geometry.coordinates);return Math.hypot(p.x-point.x,p.y-point.y)-Math.hypot(q.x-point.x,q.y-point.y);})[0];
   const routeAt=point=>{const hits=map.queryRenderedFeatures(point,{layers:['route-hit']});let best=null,distance=Infinity;for(const f of hits)for(let i=1;i<f.geometry.coordinates.length;i++){const a=map.project(f.geometry.coordinates[i-1]),b=map.project(f.geometry.coordinates[i]),dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy);if(d<distance){distance=d;best=routeName(f);}}return best;};
   map.on('mousemove',event=>{const station=stationAt(event.point),code=station?.properties.Code||'',route=station?null:routeAt(event.point);map.getCanvas().style.cursor=station||route?'pointer':'';if(code!==hoveredStation||route!==hoveredRoute){hoveredStation=code;hoveredRoute=route;render();}if(station)stationPopup(station);else closePopup();});
   map.getCanvas().addEventListener('mouseleave',()=>{hoveredStation='';hoveredRoute=null;closePopup();render();});
   map.on('click',event=>{const station=stationAt(event.point);if(station){const code=station.properties.Code,action=timetable.has(code)?stationAction(state,code):null;if(action&&!action.remove&&(!allowed||allowed.has(code)))setEndpoint(action.role,code);return;}closePopup();const name=routeAt(event.point);state.route=state.route===name?null:name;hoveredRoute=null;syncURL();render();});
   updateJourney();if(state.start&&state.end)fitJourney();else if(!state.start&&!state.end)fitNetwork();
   $('journey-panel').addEventListener('toggle',()=>{if(!state.start&&!state.end)fitNetwork();});map.on('resize',()=>{if(!state.start&&!state.end)fitNetwork();});
  });
  const resolveStation=value=>{const query=value.trim().toUpperCase();if(byCode.has(query))return query;const found=stations.features.filter(f=>f.properties.title.toLowerCase().includes(value.trim().toLowerCase()));return found.length===1?found[0].properties.Code:null;};
  $('journey-form').onsubmit=event=>event.preventDefault();
  for(const role of ['start','end']){
   const input=$(role),update=()=>{const value=input.value,code=value.trim()?resolveStation(value):null,other=role==='start'?'end':'start';if(code&&code===state[other]){state[role]=null;closePopup();updateJourney();input.value=value;$('journey-status').textContent='Choose two different stations.';return;}if(code===state[role])return;state[role]=code;closePopup();updateJourney();if(!code)input.value=value;if(state.start&&state.end)fitJourney();};input.addEventListener('input',update);input.addEventListener('change',update);
  }
  for(const role of ['start','end'])$('clear-'+role).onclick=()=>{state[role]=null;closePopup();updateJourney();};$('swap').onclick=()=>{[state.start,state.end]=[state.end,state.start];closePopup();updateJourney();};
  $('clear-route').onclick=()=>{state.route=null;hoveredRoute=null;syncURL();render();};$('home').onclick=fitNetwork;$('fit-journey').onclick=fitJourney;
 }catch(error){console.error(error);$('map-status').textContent='The map could not load. Please reload to try again.';}
}
init();
