import {AIRPORT_OVERHEAD,delta,qualifies,duration,networkHighlights,offsetNetwork,alignLaneFrames,routeDrawingStyle,stationSymbols,overviewStations} from './model.js';
const $=id=>document.getElementById(id);
const empty=()=>({type:'FeatureCollection',features:[]});
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let map,records=[],filtered=[],shapes={},stations={},airports={},manifest={},selected=null,shown=40;
let colors=new Map(),networkData=null,stationDataCache=null,qualifiedRecords=[],activeRouteName=null,lastRenderZoom=null,available=false;
const color=name=>colors.get(name)||'#c1673e';
const stationName=code=>stations[code]?.properties.StationName || code;
const coords=code=>stations[code]?.geometry.coordinates;
const tolerance=()=>Number($('tolerance').value);
const badge=r=>delta(r)<=0 ? `Train saves ${duration(-delta(r))}` : delta(r)<=tolerance() ? `Within ${Math.ceil(delta(r))} min` : `Train adds ${duration(delta(r))}`;
const params=new URLSearchParams(location.search);
$('search').value=params.get('q')||'';
const initialTolerance=Number(params.get('tolerance')??60);
$('tolerance').value=Number.isFinite(initialTolerance)?Math.min(120,Math.max(0,initialTolerance)):60;
$('view').value=params.get('view')==='all'?'all':'qualifying';
function syncURL() {
 const p=new URLSearchParams(location.search);
 for(const [key,value] of [['q',$('search').value],['route',$('route').value],['tolerance',$('tolerance').value],['view',$('view').value]]) {if(value)p.set(key,value);else p.delete(key);}
 history.replaceState(null,'',`${location.pathname}?${p}`);
}
function draw() {
 const query=$('search').value.trim().toLowerCase(),route=$('route').value,t=tolerance();
 $('tolerance-output').textContent=`${t} min`;$('formula').textContent=`flight time + 3 hours${t?` + ${t} minutes`:''}`;
 filtered=records.filter(r=>(!route||r.route===route)&&(!query||`${r.origin} ${r.destination} ${stationName(r.origin)} ${stationName(r.destination)} ${r.airports.join(' ')}`.toLowerCase().includes(query))&&($('view').value==='all'||qualifies(r,t))).sort((a,b)=>delta(a)-delta(b)||a.railMinutes-b.railMinutes);
 $('match-count').textContent=filtered.length.toLocaleString();$('service-count').textContent=new Set(filtered.map(r=>r.route)).size;
 $('download').disabled=!filtered.length;
 const qualified=filtered.filter(r=>qualifies(r,t));
 $('status').textContent=filtered.length?`${qualified.length.toLocaleString()} qualify. Directions and train services count separately.`:'No matched journeys for these filters. This is not evidence that flying is faster.';
 if(available) {
  qualifiedRecords=qualified;
  renderRouteGeometry();
  // Service filters narrow comparisons, while the full route network stays visible.
  map.setFilter('network',null);
  map.setPaintProperty('network','line-opacity',1);
 }
 if(selected&&!filtered.some(r=>r.id===selected.id))closeSelection();
 shown=40;renderResults();syncURL();
}
function renderRouteGeometry() {
 if(!available)return;
 const zoom=map.getZoom();lastRenderZoom=zoom;
 const drawingStyle=routeDrawingStyle(networkData,zoom);
 const displayed=offsetNetwork(networkData,zoom,drawingStyle,stationDataCache);
 map.getSource('network').setData(displayed);
 const focus={type:'FeatureCollection',features:displayed.features.filter(f=>(f.properties.symbologyName||f.properties.name)===activeRouteName)};
 map.getSource('route-focus').setData(focus);
 map.setPaintProperty('route-focus-outline','line-width',drawingStyle.highlightWidth+1.5);
 map.setPaintProperty('route-focus','line-width',drawingStyle.highlightWidth);
 $('route-focus-label').hidden=!activeRouteName;
 $('route-focus-label').textContent=activeRouteName?`Selected: ${activeRouteName==='Floridian'?'Floridian / Silver Star':activeRouteName}`:'';
 // Clip coverage from the final displayed lines, never offset a second copy.
 map.getSource('qualifying').setData(networkHighlights(qualifiedRecords,shapes,displayed,color));
 map.setPaintProperty('network','line-width',drawingStyle.baseWidth);
 map.setPaintProperty('qualified','line-width',drawingStyle.highlightWidth);
 const symbols=stationSymbols(stationDataCache,networkData,displayed,zoom,drawingStyle);
 map.getSource('stations').setData(symbols.dots);
 map.getSource('station-passes').setData(symbols.passes);
 map.getSource('station-overview').setData(overviewStations(symbols.dots,zoom));
}
// Selection is a transient map state, never restored from URL filters.
const deselectionClicks=new WeakSet();
document.addEventListener('click',event=>{
 if(!activeRouteName&&!selected)return;
 // These controls explicitly choose a new route or journey.
 if(event.target.closest('.route-choice,.journey,#route'))return;
 activeRouteName=null;
 if(selected)closeSelection();
 if(available)renderRouteGeometry();
 deselectionClicks.add(event);
},true);
function renderResults() {
 $('results').innerHTML=filtered.slice(0,shown).map(r=>`<button class="journey" data-id="${r.id}" aria-pressed="${selected?.id===r.id}"><strong>${esc(stationName(r.origin))} → ${esc(stationName(r.destination))}</strong><small>${esc(r.route)} · ${esc(r.origin)} → ${esc(r.destination)}</small><span class="duration"><span>Rail <b>${duration(r.railMinutes)}</b></span><span>Air + 3h <b>${duration(r.flightMinutes+AIRPORT_OVERHEAD)}</b></span></span><span class="badge ${qualifies(r,tolerance())?'':'slower'}">${badge(r)}</span></button>`).join('') || '<p class="help">Try another city, show all matched journeys, or expand the time tolerance.</p>';
 $('more').hidden=shown>=filtered.length;
}
function closeSelection() {selected=null;$('selection').hidden=true;if(available)map.getSource('selected').setData(empty());renderResults();}
function select(r) {
 selected=r;
 const rail=r.railMinutes,air=r.flightMinutes+AIRPORT_OVERHEAD,max=Math.max(rail,air);
 $('selection').innerHTML=`<button class="close" aria-label="Close journey details">×</button><p class="eyebrow">${esc(r.route)}</p><h2>${esc(stationName(r.origin))} → ${esc(stationName(r.destination))}</h2><span class="badge ${qualifies(r,tolerance())?'':'slower'}">${badge(r)}</span><div class="bars">Rail · ${duration(rail)}<div class="bar" style="width:${rail/max*100}%"></div>Flight + airport · ${duration(air)}<div class="bar air" style="width:${air/max*100}%"></div></div><p>Flight: ${esc(r.airports[0])} → ${esc(r.airports[1])}<br />${duration(r.flightMinutes)} median scheduled gate-to-gate<br />+ 2 hours before departure + 1 hour after arrival.</p><p>Airports are ${r.airportDistanceKm[0]} km and ${r.airportDistanceKm[1]} km from the train stations (straight-line). Ground access is excluded.</p><details><summary>Inspect source evidence</summary><p>Train ${esc(r.trainNumber||r.tripId)} · GTFS trip ${esc(r.tripId)}<br />Departure ${esc(r.departure)} / arrival ${esc(r.arrival)} in the GTFS agency time zone, with hours above 24 for overnight service.<br />Runs on: ${esc(r.serviceDates.join(', '))}<br />Flight sample: ${r.flightSamples.toLocaleString()} scheduled flights · ${esc(manifest.flightPeriod)}.</p><small>${r.shapeRange?'Highlight follows this train’s GTFS shape.':'This timetable trip has no usable shape. No journey line is drawn; endpoints are shown.'}</small></details><p><a href="https://www.amtrak.com/stations/${encodeURIComponent(r.origin.toLowerCase())}" target="_blank" rel="noopener">Origin station ↗</a> · <a href="/maps/rail-vs-air/" target="_blank" rel="noopener">Methods ↗</a></p>`;
 $('selection').hidden=false;$('selection').querySelector('.close').onclick=closeSelection;
 if(available) {
  const points=r.shapeRange?shapes[r.shapeId]?.slice(r.shapeRange[0],r.shapeRange[1]+1):null;
  map.getSource('selected').setData(points?.length>1?{type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:points}}]}:empty());
  const bounds=new maplibregl.LngLatBounds();
  for(const p of points||[coords(r.origin),coords(r.destination)])if(p)bounds.extend(p);
  if(!bounds.isEmpty())map.fitBounds(bounds,{padding:{top:90,bottom:90,left:40,right:window.innerWidth>850?350:40},maxZoom:10,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:700});
 }
 renderResults();
}
$('results').onclick=e=>{const button=e.target.closest('[data-id]');if(button)select(records.find(r=>r.id===Number(button.dataset.id)));};
$('more').onclick=()=>{shown+=40;renderResults();};
let timer;
$('search').oninput=()=>{clearTimeout(timer);timer=setTimeout(draw,180);};
$('view').onchange=draw;
$('route').onchange=()=>{activeRouteName=records.find(r=>r.route===$('route').value)?.ntadName||$('route').value||null;draw();};
$('tolerance').oninput=draw;
$('reset').onclick=()=>{closeSelection();if(map)map.fitBounds([[-125,24],[-66,50]],{padding:35,duration:0});};
$('layers').onclick=()=>{$('legend').hidden=!$('legend').hidden;$('layers').setAttribute('aria-expanded',String(!$('legend').hidden));};
$('download').onclick=()=>{
 const headers=['route','origin','destination','railMinutes','flightMinutes','airPlus180Minutes','railMinusAirPlus180Minutes','qualifies','originAirport','destinationAirport','originAirportDistanceKm','destinationAirportDistanceKm','flightSamples','tripId','trainNumber','serviceDates','flightPeriod','feedVersion'];
 const quote=v=>'"'+String(v).replace(/"/g,'""')+'"';
 const rows=filtered.map(r=>[r.route,r.origin,r.destination,r.railMinutes,r.flightMinutes,r.flightMinutes+180,delta(r),qualifies(r,tolerance()),...r.airports,...r.airportDistanceKm,r.flightSamples,r.tripId,r.trainNumber,r.serviceDates.join(';'),manifest.flightPeriod,manifest.feedVersion]);
 const url=URL.createObjectURL(new Blob([[headers,...rows].map(row=>row.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download=`rail-vs-air-tolerance-${tolerance()}min.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
async function load(name) {const response=await fetch(`/rail-vs-air/data/${name}`);if(!response.ok)throw Error(`${name}: HTTP ${response.status}`);return response.json();}
async function init() {
 try {
  const [routeData,stationData,comparisons,shapeData,airportData,metadata]=await Promise.all(['routes.geojson','stations.geojson','comparisons.json','shapes.json','airports.json','manifest.json'].map(load));
  stationDataCache=stationData;records=comparisons;shapes=shapeData;networkData=routeData;airports=airportData;manifest=metadata;stations=Object.fromEntries(stationData.features.map(f=>[f.properties.Code,f]));
  const names=[...new Set([...routeData.features.map(f=>f.properties.name),...records.map(r=>r.ntadName||r.route)])].sort();
  const colorNames=[...new Set([...(manifest.sourceRouteNames||names),...names])].sort();
  colors=new Map(colorNames.map((name,i)=>[name,`hsl(${Math.round(i*137.508)%360}, ${55+(i%3)*8}%, ${58+(i%2)*10}%)`]));
  for(const feature of routeData.features)feature.properties.color=color(feature.properties.symbologyName||feature.properties.name);
  networkData=alignLaneFrames(routeData);
  const services=[...new Set(records.map(r=>r.route))].sort();
  for(const name of services){const o=document.createElement('option');o.value=name;o.textContent=name;$('route').append(o);}
  if(services.includes(params.get('route')))$('route').value=params.get('route');
  const legendNames=[...new Set(names.map(name=>manifest.symbologyGroups?.[name]||name))].sort();
  $('legend-list').innerHTML=legendNames.map(name=>`<div class="legend-row"><span class="swatch" style="background:${color(name)}"></span>${esc(name==='Floridian'?'Floridian / Silver Star':name)}</div>`).join('');
  $('dates').textContent=`Train service: ${manifest.railStart} through ${manifest.railEnd}. Flights: ${manifest.flightPeriod}. Built: ${manifest.generatedDate}.`;
  $('coverage').textContent=`${manifest.routeCount} NTAD routes · ${manifest.stationCount} filtered train stations · ${manifest.matchedPairs.toLocaleString()} matched comparisons of ${manifest.directRailPairs.toLocaleString()} direct rail service/station/direction pairs. ${manifest.geometryMissing} comparisons have no usable journey geometry. Source snapshots, not live booking information.`;
  draw();
  if(!window.maplibregl){$('status').textContent+=' Map library unavailable; the comparison list and CSV still work.';return;}
  map=new maplibregl.Map({container:'map',style:{version:8,sources:{basemap:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}},layers:[{id:'background',type:'background',paint:{'background-color':'#101b2a'}},{id:'basemap',type:'raster',source:'basemap',paint:{'raster-saturation':-1,'raster-brightness-min':.015,'raster-brightness-max':.28,'raster-contrast':.15,'raster-opacity':.8}}]},bounds:[[-125,24],[-66,50]],fitBoundsOptions:{padding:35},maxZoom:16});
  map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
  map.on('load',()=>{
   map.addSource('network',{type:'geojson',data:routeData});
   map.addLayer({id:'network',type:'line',source:'network',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':['get','color'],'line-width':['interpolate',['linear'],['zoom'],3,2.5,7,3.2,11,4],'line-offset':0,'line-opacity':1}});
   map.addSource('qualifying',{type:'geojson',data:empty()});
   map.addLayer({id:'qualified',type:'line',source:'qualifying',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':['get','color'],'line-width':['interpolate',['linear'],['zoom'],3,3.5,7,4.2,11,5],'line-offset':0,'line-opacity':1}});
   map.addSource('route-focus',{type:'geojson',data:empty()});
   map.addLayer({id:'route-focus-outline',type:'line',source:'route-focus',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#ffffff','line-width':7.8}});
   map.addLayer({id:'route-focus',type:'line',source:'route-focus',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':['get','color'],'line-width':6.3}});
   map.addSource('selected',{type:'geojson',data:empty()});
   map.addLayer({id:'selected',type:'line',source:'selected',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#e5fff2','line-width':6}});
   map.addSource('stations',{type:'geojson',data:empty()});
   map.addSource('station-passes',{type:'geojson',data:empty()});
   map.addLayer({id:'station-pass-gap',minzoom:7,type:'line',source:'station-passes',layout:{'line-cap':'butt'},paint:{'line-color':'#3d3f42','line-width':['interpolate',['linear'],['zoom'],3,1.8,12,3,16,3.4]}});
   map.addLayer({id:'station-passes',minzoom:7,type:'line',source:'station-passes',layout:{'line-cap':'butt'},paint:{'line-color':'#c7cdd0','line-width':['interpolate',['linear'],['zoom'],3,.6,12,1,16,1.2]}});
   map.addLayer({id:'stations',minzoom:7,type:'circle',source:'stations',paint:{'circle-radius':['get','radius'],'circle-color':'#3d3f42','circle-stroke-width':['get','ringWidth'],'circle-stroke-color':['get','color']}});
   map.addSource('station-overview',{type:'geojson',data:empty()});
   map.addLayer({id:'station-overview',maxzoom:7,type:'circle',source:'station-overview',paint:{'circle-radius':['interpolate',['linear'],['zoom'],3,2.4,6,2.8],'circle-color':'#3d3f42','circle-stroke-color':['get','color'],'circle-stroke-width':1.1}});
   const stationPopup=e=>{const p=e.features[0].properties;const div=document.createElement('div');const strong=document.createElement('strong');strong.textContent=p.StationName;div.append(strong,document.createElement('br'));const served=document.createElement('small');const routes=typeof p.symbolRoutes==='string'?JSON.parse(p.symbolRoutes):p.symbolRoutes||[];served.textContent=`${p.stopStatus==='no-stop'?'Passes without stopping':'Stops on'}: ${routes.join(', ')}`;div.append(served,document.createElement('br'));const b=document.createElement('button');b.textContent=`Find journeys from/to ${p.Code}`;b.onclick=()=>{$('search').value=p.Code;draw();};div.append(b);new maplibregl.Popup().setLngLat(e.lngLat).setDOMContent(div).addTo(map);};
   for(const id of ['station-overview','stations','station-passes'])map.on('click',id,stationPopup);
   function chooseRoute(name) {
    activeRouteName=name;
    const service=records.find(r=>(r.ntadName||r.route)===name)?.route;
    $('route').value=service||'';draw();
   }
   // Query a generous screen-space area rather than requiring a pixel-perfect
   // hit on a thin stroke. Ambiguous hits offer explicit route choices.
   const nearbyRoutes=point=>[...new Set(map.queryRenderedFeatures([[point.x-9,point.y-9],[point.x+9,point.y+9]],{layers:['network']}).map(f=>f.properties.symbologyName||f.properties.name))].sort();
   map.on('click',e=>{
    // A click that clears a selection must not immediately select a nearby line.
    if(deselectionClicks.has(e.originalEvent))return;
    if(map.queryRenderedFeatures(e.point,{layers:['station-overview','stations','station-passes']}).length)return;
    const names=nearbyRoutes(e.point);if(!names.length)return;
    if(names.length===1){chooseRoute(names[0]);return;}
    const div=document.createElement('div'),title=document.createElement('strong');title.textContent='Choose a route';div.append(title);
    const popup=new maplibregl.Popup().setLngLat(e.lngLat);
    for(const name of names){const button=document.createElement('button');button.className='route-choice';button.textContent=name==='Floridian'?'Floridian / Silver Star':name;button.style.borderLeft=`5px solid ${color(name)}`;button.onclick=()=>{chooseRoute(name);popup.remove();};div.append(button);}
    popup.setDOMContent(div).addTo(map);
   });
   map.on('mousemove',e=>{map.getCanvas().style.cursor=nearbyRoutes(e.point).length||map.queryRenderedFeatures(e.point,{layers:['station-overview','stations','station-passes']}).length?'pointer':'';});
   for(const id of ['station-overview','stations','station-passes','network']){map.on('mouseenter',id,()=>map.getCanvas().style.cursor='pointer');map.on('mouseleave',id,()=>map.getCanvas().style.cursor='');}
   const updateZoomReadout=()=>{const value=map.getZoom().toFixed(1);$('map-zoom').hidden=false;$('map-zoom').textContent=`Zoom ${value}`;$('map-zoom').setAttribute('aria-label',`Map zoom level ${value}`);};
   updateZoomReadout();map.on('zoom',updateZoomReadout);
   available=true;draw();
   // Offsets remain pixel-sized while zooming; the final frame always refreshes.
   let geometryFrame=null;
   map.on('zoom',()=>{
    if(Math.abs(map.getZoom()-lastRenderZoom)<.2||geometryFrame!==null)return;
    geometryFrame=requestAnimationFrame(()=>{geometryFrame=null;renderRouteGeometry();});
   });
   map.on('zoomend',renderRouteGeometry);
  });
  map.on('error',()=>{$('status').textContent='Some map resources could not load. The sourced journey list and CSV remain available.';});
 }catch(error){$('status').textContent=`Could not load the source data. ${error.message}. Please reload or read the article.`;console.error(error);}
}
init();
