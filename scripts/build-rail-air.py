#!/usr/bin/env python3
"""Rebuild auditable rail/air comparisons from downloaded primary-source files.
No modeled speeds or invented flight durations. Shapely is used for shared-track display topology.
"""
import argparse,csv,io,json,zipfile,math,statistics,datetime,hashlib,colorsys
from collections import defaultdict,Counter
from pathlib import Path

ROUTES_URL='https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Amtrak_Routes/FeatureServer/0'
STATIONS_URL='https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Amtrak_Stations/FeatureServer/0'
GTFS_URL='https://content.amtrak.com/content/gtfs/GTFS.zip'
AIRPORTS_URL='https://davidmegginson.github.io/ourairports-data/airports.csv'
DISPLAY_ROUTE_PRIORITY=['Pennsylvanian','Keystone Service']
DISPLAY_ROUTE_SOUTHERN=['Northeast Regional','Vermonter','Acela']
STATION_SQL="StnType = 'TRAIN' AND StaType <> 'Curbside Bus Stop only (no shelter)'"
US_STATES=set('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split())

def readzip(z,name):return list(csv.DictReader(io.TextIOWrapper(z.open(name),encoding='utf-8-sig')))
def minutes(t):
 h,m,s=map(int,t.split(':'));return h*60+m+s/60

def distance(a,b):
 lon1,lat1,lon2,lat2=map(math.radians,[a[0],a[1],b[0],b[1]])
 return 6371*2*math.asin(min(1,math.sqrt(math.sin((lat2-lat1)/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2)))

def simplify(points,tolerance=.0003):
 # Iterative Douglas-Peucker; retain endpoints, in degrees for display only.
 if len(points)<3:return points
 keep={0,len(points)-1};stack=[(0,len(points)-1)]
 while stack:
  lo,hi=stack.pop();a,b=points[lo],points[hi];dx,dy=b[0]-a[0],b[1]-a[1];den=dx*dx+dy*dy
  best=-1;idx=lo
  for i in range(lo+1,hi):
   p=points[i];t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)) if den else 0
   d=(p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2
   if d>best:best=d;idx=i
  if best>tolerance*tolerance:keep.add(idx);stack.extend([(lo,idx),(idx,hi)])
 return [points[i] for i in sorted(keep)]

def corridor_chains(edges):
 # Prefer the continuation carrying the same service bundle, then its angle.
 # Orient the complete corridor once, not each membership run or individual edge.
 adjacency=defaultdict(list)
 for a,b in edges:adjacency[a].append(b);adjacency[b].append(a)
 continuation={}
 for vertex,neighbors in adjacency.items():
  remaining=set(neighbors)
  while len(remaining)>=2:
   candidates=[]
   ns=sorted(remaining)
   for i,a in enumerate(ns):
    for b in ns[i+1:]:
     ax,ay=a[0]-vertex[0],a[1]-vertex[1];bx,by=b[0]-vertex[0],b[1]-vertex[1]
     cosine=(ax*bx+ay*by)/math.sqrt((ax*ax+ay*ay)*(bx*bx+by*by))
     shared=len(edges[tuple(sorted((vertex,a)))] & edges[tuple(sorted((vertex,b)))])
     candidates.append((-shared,cosine,a,b))
   _shared,cosine,a,b=min(candidates)
   if len(neighbors)>2 and cosine>-.25:break
   continuation[(vertex,a)]=b;continuation[(vertex,b)]=a
   remaining.remove(a);remaining.remove(b)
 unused=set(edges);chains=[]
 def walk(a,b):
  points=[a,b];unused.remove(tuple(sorted((a,b))))
  while (b,a) in continuation:
   c=continuation[(b,a)];edge=tuple(sorted((b,c)))
   if edge not in unused:break
   unused.remove(edge);points.append(c);a,b=b,c
  if points[0]>points[-1]:points.reverse()
  chains.append(points)
 starts=sorted((v,n) for v,neighbors in adjacency.items() for n in neighbors if (v,n) not in continuation)
 for a,b in starts:
  if tuple(sorted((a,b))) in unused:walk(a,b)
 while unused:
  a,b=min(unused);walk(a,b)
 return chains

def parallel_routes(fc):
 from rail_topology import noded_route_edges
 edges=noded_route_edges(fc)
 degree=Counter(p for edge in edges for p in edge)
 features=[]
 for points in corridor_chains(edges):
  memberships=[edges[tuple(sorted((a,b)))] for a,b in zip(points,points[1:])]
  # Center only the routes present on this track; do not reserve empty lanes
  # for services that join hundreds of miles away.
  slots=[]
  for members in memberships:
   symbol=lambda name:'Floridian' if name=='Silver Star' else name
   ordered=sorted({symbol(name) for name in members},key=lambda name:(2,DISPLAY_ROUTE_SOUTHERN.index(name)) if name in DISPLAY_ROUTE_SOUTHERN else (0,DISPLAY_ROUTE_PRIORITY.index(name)) if name in DISPLAY_ROUTE_PRIORITY else (1,name))
   slots.append({name:ordered.index(symbol(name))-(len(ordered)-1)/2 for name in members})
  # Simplify each common section once so every route uses identical bend vertices.
  breaks=[0]+[i for i in range(1,len(memberships)) if memberships[i]!=memberships[i-1] or slots[i]!=slots[i-1] or degree[points[i]]!=2]+[len(memberships)]
  display=[];display_index={}
  for lo,hi in zip(breaks,breaks[1:]):
   part=simplify(points[lo:hi+1]);display_index[lo]=len(display)
   display.extend(part[:-1])
  display_index[breaks[-1]]=len(display);display.append(points[-1])
  # One continuous path per route/lane run, even when another service joins/leaves.
  for name in sorted(set().union(*memberships)):
   i=0
   while i<len(slots):
    if name not in slots[i]:i+=1;continue
    start=i;lane=slots[i][name]
    while i<len(slots) and slots[i].get(name)==lane:i+=1
    coords=display[display_index[start]:display_index[i]+1]
    features.append({'type':'Feature','properties':{'name':name,'symbologyName':'Floridian' if name=='Silver Star' else name,'lane':lane,'lanePriority':DISPLAY_ROUTE_PRIORITY.index(name) if name in DISPLAY_ROUTE_PRIORITY else None,'laneSouthPriority':DISPLAY_ROUTE_SOUTHERN.index(name) if name in DISPLAY_ROUTE_SOUTHERN else None,'shared':max(len(m) for m in memberships[start:i])},'geometry':{'type':'LineString','coordinates':coords}})
 shared=sum(len(names)>1 for names in edges.values())
 return {'type':'FeatureCollection','features':features},shared

def route_colors(fc):
 # Greedy perceptual contrast assignment: services sharing an exact source
 # edge constrain each other, instead of receiving neighboring hues by name.
 groups={f['properties'].get('symbologyName',f['properties']['name']) for f in fc['features']}
 edges=defaultdict(set)
 for f in fc['features']:
  name=f['properties'].get('symbologyName',f['properties']['name']);p=f['geometry']['coordinates']
  for a,b in zip(p,p[1:]):edges[tuple(sorted((tuple(a),tuple(b))))].add(name)
 neighbors={name:set() for name in groups}
 for members in edges.values():
  for name in members:neighbors[name].update(members-{name})
 def lab(rgb):
  r,g,b=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
  xyz=[(.4124564*r+.3575761*g+.1804375*b)/.95047,.2126729*r+.7151522*g+.072175*b,(.0193339*r+.119192*g+.9503041*b)/1.08883]
  x,y,z=[v**(1/3) if v>.008856 else 7.787*v+16/116 for v in xyz]
  return (116*y-16,500*(x-y),200*(y-z))
 palette=[]
 for hue in range(0,360,15):
  for lightness in [.58,.70]:
   for saturation in [.65,.85]:
    rgb=colorsys.hls_to_rgb(hue/360,lightness,saturation);palette.append((lab(rgb),'#'+''.join(f'{round(v*255):02x}' for v in rgb),hue))
 distance=lambda a,b:math.sqrt(sum((x-y)**2 for x,y in zip(a,b)))
 assigned={};used=set()
 for name in sorted(groups,key=lambda n:(-len(neighbors[n]),n)):
  nearby=[assigned[n][0] for n in neighbors[name] if n in assigned]
  def score(candidate):
   color,hexcode,hue=candidate
   primary=min((distance(color,c) for c in nearby),default=70-abs(hue-210)/10)
   spread=min((distance(color,c[0]) for c in assigned.values()),default=0)
   return primary+.08*spread
  choice=max((c for c in palette if c[1] not in used),key=score);assigned[name]=choice;used.add(choice[1])
 result={name:entry[1] for name,entry in assigned.items()}
 for f in fc['features']:result[f['properties']['name']]=result[f['properties'].get('symbologyName',f['properties']['name'])]
 return result

def station_services(stations,routes,trips,times,ntad_names):
 memberships=defaultdict(set)
 for tid,rows in times.items():
  route=routes[trips[tid]['route_id']]
  if route['route_long_name']=='Commuter Rail':continue
  name=route['display_name']
  name=ntad_names.get(name.casefold(),name)
  for row in rows:
   if row.get('pickup_type')=='1' and row.get('drop_off_type')=='1':continue
   memberships[row['stop_id']].add(name)
 for feature in stations['features']:
  feature['properties']['routeNames']=sorted(memberships[feature['properties']['Code']])
 return stations

def build(args):
 root=Path(args.input_dir);out=Path(args.output_dir);out.mkdir(parents=True,exist_ok=True)
 def dump(name,data): (out/name).write_text(json.dumps(data,separators=(',',':')),encoding='utf-8')
 stations=json.loads((root/'stations.geojson').read_text())
 assert all(f['properties']['StnType']=='TRAIN' and f['properties']['StaType']!='Curbside Bus Stop only (no shelter)' for f in stations['features'])
 route_geo=json.loads((root/'routes.geojson').read_text())
 ntad_names={f['properties']['name'].casefold():f['properties']['name'] for f in route_geo['features']}
 z=zipfile.ZipFile(root/'amtrak.zip');info=readzip(z,'feed_info.txt')[0]
 routes={r['route_id']:r for r in readzip(z,'routes.txt') if r['route_type']=='2'}
 agencies={a['agency_id']:a for a in readzip(z,'agency.txt')}
 for route in routes.values():route['display_name']=agencies[route['agency_id']]['agency_name'] if route['route_long_name']=='Commuter Rail' else route['route_long_name']
 stops={s['stop_id']:s for s in readzip(z,'stops.txt')}
 valid={f['properties']['Code']:f for f in stations['features'] if f['properties']['State'] in US_STATES}
 start=datetime.datetime.strptime(info['feed_start_date'],'%Y%m%d').date();end=datetime.datetime.strptime(info['feed_end_date'],'%Y%m%d').date()
 days=[start+datetime.timedelta(days=i) for i in range((end-start).days+1)]
 services={}
 for c in readzip(z,'calendar.txt'):
  dates=[d.isoformat() for d in days if c['start_date']<=d.strftime('%Y%m%d')<=c['end_date'] and c[d.strftime('%A').lower()]=='1']
  if dates:services[c['service_id']]=dates
 if 'calendar_dates.txt' in z.namelist():
  for c in readzip(z,'calendar_dates.txt'):
   d=datetime.datetime.strptime(c['date'],'%Y%m%d').date()
   if start<=d<=end:
    ds=services.setdefault(c['service_id'],[])
    if c['exception_type']=='1' and d.isoformat() not in ds:ds.append(d.isoformat())
    if c['exception_type']=='2' and d.isoformat() in ds:ds.remove(d.isoformat())
 trips={t['trip_id']:t for t in readzip(z,'trips.txt') if t['route_id'] in routes and services.get(t['service_id'])}
 times=defaultdict(list)
 for t in readzip(z,'stop_times.txt'):
  if t['trip_id'] in trips:times[t['trip_id']].append(t)
 # Supplement comparison endpoints from actual commuter stop coordinates.
 # The filtered NTAD station inventory and its map symbols stay separate.
 commuter_ids={tid for tid,t in trips.items() if routes[t['route_id']]['route_long_name']=='Commuter Rail'}
 commuter_codes={row['stop_id'] for tid in commuter_ids for row in times[tid]}
 for code in sorted(commuter_codes):
  if code in valid:continue
  stop=stops[code];lat,lon=float(stop['stop_lat']),float(stop['stop_lon'])
  # The two commuter agencies in this retained feed are MARC and Shore Line
  # East; their GTFS stop coordinates are in Maryland/DC/Connecticut/New York.
  valid[code]={'type':'Feature','properties':{'Code':code,'StationName':stop['stop_name'],'source':'GTFS commuter stop','comparisonOnly':True},'geometry':{'type':'Point','coordinates':[lon,lat]}}
 comparison_memberships=defaultdict(set)
 for tid,rows in times.items():
  label=routes[trips[tid]['route_id']]['display_name']
  for row in rows:
   if row.get('pickup_type')=='1' and row.get('drop_off_type')=='1':continue
   comparison_memberships[row['stop_id']].add(label)
 for code,station in valid.items():station['properties']['comparisonRouteNames']=sorted(comparison_memberships[code])
 dump('comparison-stations.json',{'type':'FeatureCollection','features':list(valid.values())})
 from rail_topology import restore_north_philadelphia_connector,add_pennsylvanian_station_approach,reorder_display_bundles
 parallel,shared=parallel_routes(route_geo)
 parallel=restore_north_philadelphia_connector(parallel)
 # Do not suppress, trim or move source sections: those operations severed
 # connections and removed original route geometry in the former pipeline.
 suppressed=joined=0
 parallel=add_pennsylvanian_station_approach(parallel)
 parallel=reorder_display_bundles(parallel,DISPLAY_ROUTE_PRIORITY)
 dump('routes.geojson',parallel)
 station_services(stations,routes,trips,times,ntad_names)
 dump('stations.geojson',stations)
 # BTS scheduled gate-to-gate durations, including scheduled flights later cancelled.
 fz=zipfile.ZipFile(root/'flights.zip');filename=next(n for n in fz.namelist() if n.endswith('.csv'))
 flight_times=defaultdict(list);flight_rows=0;periods=set()
 for f in csv.DictReader(io.TextIOWrapper(fz.open(filename),encoding='utf-8-sig')):
  if not f['CRSElapsedTime']:continue
  v=float(f['CRSElapsedTime'])
  if v<=0:continue
  periods.add(f['FlightDate'][:7]);flight_times[(f['Origin'],f['Dest'])].append(v);flight_rows+=1
 assert periods=={args.flight_period},f'Flight periods mismatch: {periods}'
 medians={pair:statistics.median(v) for pair,v in flight_times.items()}
 airport_codes={a for pair in flight_times for a in pair}
 airports={}
 with (root/'airports.csv').open(encoding='utf-8-sig') as fp:
  for a in csv.DictReader(fp):
   if a['iata_code'] in airport_codes and a['iso_country']=='US':
    airports[a['iata_code']]={'code':a['iata_code'],'name':a['name'],'coordinates':[float(a['longitude_deg']),float(a['latitude_deg'])]}
 nearby={}
 for code,station in valid.items():
  ds=[(a,round(distance(station['geometry']['coordinates'],v['coordinates']),2)) for a,v in airports.items()]
  nearby[code]=[(a,d) for a,d in ds if d<=args.airport_radius]
 best={};direct_pairs=set();commuter_best={}
 for tid,ts in times.items():
  trip=trips[tid];route=routes[trip['route_id']]['display_name'];ts.sort(key=lambda s:int(s['stop_sequence']))
  for i,a in enumerate(ts):
   if a['stop_id'] not in valid or a.get('pickup_type')=='1' or not a['departure_time']:continue
   for b in ts[i+1:]:
    if b['stop_id'] not in valid or b.get('drop_off_type')=='1' or not b['arrival_time'] or a['stop_id']==b['stop_id']:continue
    origin,dest=a['stop_id'],b['stop_id'];direct_pairs.add((route,origin,dest))
    duration=minutes(b['arrival_time'])-minutes(a['departure_time'])
    if duration<=0:continue
    if tid in commuter_ids:
     key=(route,origin,dest)
     if key not in commuter_best or commuter_best[key]['railMinutes']>duration:
      commuter_best[key]={'route':route,'origin':origin,'destination':dest,'railMinutes':duration,'tripId':tid,'trainNumber':trip.get('trip_short_name',''),'departure':a['departure_time'],'arrival':b['arrival_time'],'serviceDates':services[trip['service_id']]}
    candidates=[(medians[(aa,bb)],aa,bb,da,db) for aa,da in nearby[origin] for bb,db in nearby[dest] if aa!=bb and (aa,bb) in medians]
    if not candidates:continue
    flight,aa,bb,da,db=min(candidates);key=(route,origin,dest)
    if key in best and best[key]['railMinutes']<=duration:continue
    lookup=route.casefold()
    if lookup=='lincoln service missouri river runner':lookup='lincol service missouri river runner'
    best[key]={'route':route,'ntadName':ntad_names.get(lookup),'origin':origin,'destination':dest,'railMinutes':duration,'flightMinutes':flight,'airports':[aa,bb],'airportDistanceKm':[da,db],'flightSamples':len(flight_times[(aa,bb)]),'tripId':tid,'trainNumber':trip.get('trip_short_name',''),'departure':a['departure_time'],'arrival':b['arrival_time'],'serviceDates':services[trip['service_id']],'shapeId':trip['shape_id']}
 # Use GTFS trip shapes for the station-to-station highlight, not full-route lines.
 shape_ids={v['shapeId'] for v in best.values()};raw_shapes=defaultdict(list)
 for s in readzip(z,'shapes.txt'):
  if s['shape_id'] in shape_ids:raw_shapes[s['shape_id']].append((int(s['shape_pt_sequence']),[float(s['shape_pt_lon']),float(s['shape_pt_lat'])]))
 shapes={sid:simplify([p for _,p in sorted(ps)],.0002) for sid,ps in raw_shapes.items()}
 indexes={};oriented_shapes={};geometry_missing=0
 for tid in {r['tripId'] for r in best.values()}:
  sid=trips[tid]['shape_id'];pts=shapes.get(sid);last=0;ix={}
  if not pts:indexes[tid]=ix;continue
  def nearest_global(stop_id):
   st=stops[stop_id];p=[float(st['stop_lon']),float(st['stop_lat'])]
   return min(range(len(pts)),key=lambda j:(p[0]-pts[j][0])**2*math.cos(math.radians(p[1]))**2+(p[1]-pts[j][1])**2)
  if nearest_global(times[tid][0]['stop_id'])>nearest_global(times[tid][-1]['stop_id']):
   sid=sid+'~reverse';pts=list(reversed(pts));shapes[sid]=pts
  oriented_shapes[tid]=sid
  for t in times[tid]:
   stop=stops[t['stop_id']];p=[float(stop['stop_lon']),float(stop['stop_lat'])]
   j=min(range(last,len(pts)),key=lambda j:(p[0]-pts[j][0])**2*math.cos(math.radians(p[1]))**2+(p[1]-pts[j][1])**2);gap=distance(p,pts[j])
   if gap<=3:ix[t['stop_id']]=j;last=j
  indexes[tid]=ix
 records=[]
 for idx,(_,r) in enumerate(sorted(best.items())):
  r['id']=idx;r['sourceShapeId']=r['shapeId'];r['shapeId']=oriented_shapes.get(r['tripId'],r['shapeId']);ix=indexes[r['tripId']];a=ix.get(r['origin']);b=ix.get(r['destination'])
  r['shapeRange']=[a,b] if a is not None and b is not None and b>a else None
  if r['shapeRange'] is None:geometry_missing+=1
  records.append(r)
 dump('commuter-journeys.json',list(commuter_best.values()))
 dump('comparisons.json',records);dump('shapes.json',shapes);dump('airports.json',airports)
 evidence={};selected_ids={r['tripId'] for r in records}|commuter_ids
 for filename in ['feed_info.txt','agency.txt','routes.txt','calendar.txt','trips.txt','stop_times.txt','stops.txt']:
  rows=readzip(z,filename)
  if filename in ['trips.txt','stop_times.txt']:rows=[r for r in rows if r['trip_id'] in selected_ids]
  evidence[filename]=rows
 if 'calendar_dates.txt' in z.namelist():evidence['calendar_dates.txt']=readzip(z,'calendar_dates.txt')
 dump('gtfs-evidence.json',evidence)
 manifest={'generatedDate':args.as_of,'railStart':start.isoformat(),'railEnd':end.isoformat(),'feedVersion':info['feed_version'],'flightPeriod':args.flight_period,'airportRadiusKm':args.airport_radius,'flightRows':flight_rows,'routeCount':len(ntad_names),'comparisonStationCount':len(valid),'railServices':sorted({r['display_name'] for r in routes.values()}),'commuterServices':sorted({r['display_name'] for r in routes.values() if r['route_long_name']=='Commuter Rail'}),'commuterDirectPairs':sum(route in {r['display_name'] for r in routes.values() if r['route_long_name']=='Commuter Rail'} for route,origin,destination in direct_pairs),'routeLanePriority':DISPLAY_ROUTE_PRIORITY,'routeSouthernPriority':DISPLAY_ROUTE_SOUTHERN,'routeColors':route_colors(parallel),'sourceRouteNames':sorted(ntad_names.values()),'symbologyGroups':{'Silver Star':'Floridian'},'serviceChangeSource':'https://www.amtrak.com/routes/silver-service-palmetto-train.html','stationCount':len(stations['features']),'directRailPairs':len(direct_pairs),'matchedPairs':len(records),'geometryMissing':geometry_missing,'sharedEdges':shared,'displayTopology':{'engine':'Shapely 2.1.2 / GEOS','precisionDegrees':1e-7,'membershipToleranceDegrees':2e-6,'sourceSectionsPreserved':True,'junctionVerticesProtected':True,'redundantSectionToleranceMeters':0,'suppressedSections':suppressed,'joinedDisplayBundles':joined,'maximumTailLengthMeters':0,'preserveConnectingSections':True,'sourceGapDisplayRepairs':['Crescent at North Philadelphia; existing shared NEC track','Palmetto at Philadelphia; existing shared NEC track','Vermonter at New Haven; existing shared track','Pennsylvanian Philadelphia stop approach added without removing original source sections']},'stationFilter':STATION_SQL,'sources':{'routes':ROUTES_URL,'stations':STATIONS_URL,'rail':GTFS_URL,'flights':f'https://www.transtats.bts.gov/PREZIP/On_Time_Reporting_Carrier_On_Time_Performance_1987_present_{args.flight_period.replace("-","_").replace("_0","_")}.zip','airports':AIRPORTS_URL},'sha256':{p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in ['amtrak.zip','flights.zip','airports.csv','stations.geojson','routes.geojson']}}
 dump('manifest.json',manifest)
 print(json.dumps(manifest,indent=2))
 print('Default qualifying route/station/direction records:',sum(r['railMinutes']<=r['flightMinutes']+240 for r in records))

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--input-dir',required=True);p.add_argument('--output-dir',default='public/rail-vs-air/data');p.add_argument('--flight-period',required=True);p.add_argument('--airport-radius',type=float,default=50);p.add_argument('--as-of',required=True);build(p.parse_args())
