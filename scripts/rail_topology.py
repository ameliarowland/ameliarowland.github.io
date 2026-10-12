"""Shared-track display topology using GEOS noding through Shapely.
A 1e-7-degree precision grid controls centimeter-scale numerical noise. Route
membership is matched within 2e-6 degrees (roughly 0.2 m), not by station proximity.
This affects cartographic geometry only, never timetable connectivity or duration.
"""
from collections import defaultdict
from shapely import union_all
from shapely.geometry import LineString,Point,box
from shapely.strtree import STRtree

GRID=1e-7
MEMBERSHIP_TOLERANCE=2e-6

def noded_route_edges(fc):
 lines=[];segments=[];names=[]
 for feature in fc['features']:
  geometry=feature['geometry']
  parts=geometry['coordinates'] if geometry['type']=='MultiLineString' else [geometry['coordinates']]
  for coordinates in parts:
   line=LineString(coordinates)
   if line.is_empty:continue
   lines.append(line)
   for a,b in zip(coordinates,coordinates[1:]):
    if a[:2]!=b[:2]:segments.append(LineString([a[:2],b[:2]]));names.append(feature['properties']['name'])
 tree=STRtree(segments)
 network=union_all(lines,grid_size=GRID)
 parts=list(network.geoms) if hasattr(network,'geoms') else [network]
 edges=defaultdict(set)
 for part in parts:
  points=list(part.coords)
  for a,b in zip(points,points[1:]):
   a=tuple(round(v,7) for v in a[:2]);b=tuple(round(v,7) for v in b[:2])
   if a==b:continue
   x,y=(a[0]+b[0])/2,(a[1]+b[1])/2;p=Point(x,y);tol=MEMBERSHIP_TOLERANCE
   candidates=tree.query(box(x-tol,y-tol,x+tol,y+tol))
   members={names[int(i)] for i in candidates if segments[int(i)].distance(p)<=tol}
   if not members:raise ValueError(f'No source route for noded display edge {a} / {b}')
   edges[tuple(sorted((a,b)))].update(members)
 return edges


def simplify_display_sections(fc,tolerance_meters=75):
 """Suppress shorter same-service paths wholly inside a longer path's 75 m
 corridor. This is cartographic generalization of duplicate/parallel track
 sections, not a deletion from the source snapshot or timetable network.
 """
 import math
 def projected(f):
  return LineString([(6378137*math.radians(x),6378137*math.log(math.tan(math.pi/4+math.radians(y)/2))) for x,y in f['geometry']['coordinates']])
 groups=defaultdict(list)
 for i,f in enumerate(fc['features']):groups[f['properties']['name']].append((i,projected(f)))
 removed=set()
 for group in groups.values():
  kept=[]
  for i,line in sorted(group,key=lambda item:-item[1].length):
   coords=fc['features'][i]['geometry']['coordinates'];latitude=sum(p[1] for p in coords)/len(coords)
   tolerance=tolerance_meters/math.cos(math.radians(latitude))
   envelope=line.envelope
   redundant=False
   nearby=[reference for j,reference in kept if envelope.intersects(reference.envelope.buffer(tolerance))]
   # An overlap can straddle two adjoining retained sections. Testing only one
   # feature at a time leaves duplicate tails at bends and section boundaries.
   if nearby and line.covered_by(union_all(nearby).buffer(tolerance,quad_segs=4)):
    # A short bridge can fit inside the buffered ends of two longer sections
    # even though neither section contains it. Preserve that real connection.
    # Use source precision here, not the much wider display cleanup tolerance.
    exact=.25/math.cos(math.radians(latitude))
    start,end=Point(line.coords[0]),Point(line.coords[-1])
    start_refs={j for j,reference in enumerate(nearby) if reference.distance(start)<=exact}
    end_refs={j for j,reference in enumerate(nearby) if reference.distance(end)<=exact}
    bridge=bool(start_refs and end_refs and not start_refs.intersection(end_refs))
    redundant=not bridge and not fc['features'][i]['properties'].get('preserveConnector')
   if redundant:removed.add(i)
   else:kept.append((i,line))
 return {'type':'FeatureCollection','features':[f for i,f in enumerate(fc['features']) if i not in removed]},len(removed)


def join_display_tails(fc,stations=None,tolerance_meters=75):
 """Trim overlapping loose tails and join them to the same service bundle.
 The source snapshot is untouched. Geometry changes are restricted to 75 m
 joins and at most 750 m of redundant tail; nearby station positions protect
 terminal/platform branches from trimming.
 """
 import math
 from shapely.ops import nearest_points
 def xy(p):return (6378137*math.radians(p[0]),6378137*math.log(math.tan(math.pi/4+math.radians(p[1])/2)))
 def ll(p):return [round(math.degrees(p[0]/6378137),7),round(math.degrees(2*math.atan(math.exp(p[1]/6378137))-math.pi/2),7)]
 groups={}
 for f in fc['features']:
  key=tuple(tuple(p) for p in f['geometry']['coordinates'])
  if key not in groups:groups[key]={'line':LineString([xy(p) for p in key]),'features':[],'joins':[]}
  groups[key]['features'].append(f)
 for g in groups.values():g['names']={f['properties']['name'] for f in g['features']}
 station_points=[Point(xy(f['geometry']['coordinates'])) for f in (stations or {}).get('features',[])]
 ordered=sorted(groups.values(),key=lambda g:-g['line'].length);joined=0
 for g in ordered:
  line=g['line'];latitude=ll(line.coords[0])[1];scale=1/math.cos(math.radians(latitude));tol=tolerance_meters*scale
  for ref in ordered:
   if ref is g or ref['line'].length<=line.length or ref['names']!=g['names']:continue
   reference=ref['line'];start,end=Point(line.coords[0]),Point(line.coords[-1]);near_start=start.distance(reference)<=tol;near_end=end.distance(reference)<=tol
   if near_start==near_end:continue
   outside=line.difference(reference.buffer(tol,quad_segs=4))
   if outside.geom_type!='LineString' or outside.is_empty:continue
   if line.length-outside.length>750*scale:continue
   # Never trim a real station-bearing branch to improve a drawing.
   if any(point.distance(line)<=100*scale and point.distance(outside)>100*scale for point in station_points):continue
   points=list(outside.coords)
   if Point(points[0]).distance(start)>1e-4 and Point(points[-1]).distance(start)<1e-4:points.reverse()
   side=0 if near_start else -1;cut=Point(points[side]);snap=nearest_points(cut,reference)[1]
   points[side]=snap.coords[0];g['line']=LineString(points);ref['joins'].append(snap);joined+=1;break
 result=[]
 for g in ordered:
  line=g['line'];positions=sorted({0,line.length,*[line.project(p) for p in g['joins']]});coords=list(line.coords)
  # Split at shared join positions so continuous-route assembly can connect.
  from shapely.ops import substring
  parts=[substring(line,a,b) for a,b in zip(positions,positions[1:]) if b-a>1e-5]
  for part in parts:
   if part.geom_type!='LineString':continue
   points=[ll(p) for p in part.coords]
   for f in g['features']:result.append({**f,'geometry':{'type':'LineString','coordinates':points}})
 return {'type':'FeatureCollection','features':result},joined


def restore_north_philadelphia_connector(fc):
 """Repair documented source gaps using existing shared track, display only.
 No timetable, scheduled stop, or journey duration is inferred or changed.
 """
 from copy import deepcopy
 features=deepcopy(fc['features'])
 for f in features:f['geometry']['coordinates']=[list(p) for p in f['geometry']['coordinates']]
 repairs=[
  ('Crescent',(-75.1585532,39.995913),(-75.1575273,39.9962988),'North Philadelphia'),
  ('Palmetto',(-75.1818291,39.9599444),(-75.18414,39.96235),'Philadelphia 30th Street'),
  ('Vermonter',(-72.8977453,41.3192796),(-72.8976368,41.3194073),'New Haven')]
 for name,a,b,location in repairs:
  route=[f for f in features if f['properties']['name']==name]
  endpoints={tuple(p) for f in route for p in [f['geometry']['coordinates'][0],f['geometry']['coordinates'][-1]]}
  section=[f for f in features if f['geometry']['coordinates']==[list(a),list(b)]]
  if not section or not {a,b}.issubset(endpoints):raise ValueError(f'{location} source connector changed; review repair')
  if any(f['properties']['name']==name for f in section):continue
  template=next(f for f in route if tuple(f['geometry']['coordinates'][-1])==a)
  connector=deepcopy(template);connector['geometry']['coordinates']=[list(a),list(b)]
  connector['properties']['displayRepair']=f'{location} source gap; existing shared track'
  section.append(connector);features.append(connector)
  symbols={f['properties'].get('symbologyName',f['properties']['name']) for f in section}
  priority={f['properties'].get('symbologyName',f['properties']['name']):f['properties'].get('lanePriority') for f in section}
  south={f['properties'].get('symbologyName',f['properties']['name']):f['properties'].get('laneSouthPriority') for f in section}
  ordered=sorted(symbols,key=lambda name:(2,south[name]) if south[name] is not None else (0,priority[name]) if priority[name] is not None else (1,name))
  for f in section:
   f['properties']['preserveConnector']=True
   f['properties']['lane']=ordered.index(f['properties'].get('symbologyName',f['properties']['name']))-(len(ordered)-1)/2
   f['properties']['shared']=len(section)
 # Preserve the NE Regional branch approach preceding the tiny shared bridge.
 for f in features:
  if f['properties']['name']=='Northeast Regional' and f['geometry']['coordinates']==[[-72.904287,41.3146575],[-72.8977453,41.3192796]]:
   f['properties']['preserveConnector']=True
 return {'type':'FeatureCollection','features':features}


def connect_keystone_philadelphia(fc):
 """Snap the west approach to the existing NEC within 50 m for display.
 Omit a disconnected source spur with no station; source snapshots stay intact.
 """
 import math
 from copy import deepcopy
 from shapely.ops import nearest_points
 features=deepcopy(fc['features'])
 spur=[[-75.2024265,39.9703628],[-75.1935289,39.9679935]]
 features=[f for f in features if not(f['properties']['name']=='Keystone Service' and f['geometry']['coordinates']==spur)]
 west=next(f for f in features if f['properties']['name']=='Keystone Service' and f['geometry']['coordinates'][-1]==[-75.1985969,39.9720838])
 center=next(f for f in features if f['properties']['name']=='Keystone Service' and f['geometry']['coordinates'][0]==[-75.1907425,39.9669957] and len(f['geometry']['coordinates'])==8)
 # Local metric projection avoids longitude/latitude distance distortion.
 cos=math.cos(math.radians(39.972));xy=lambda p:(p[0]*cos*111320,p[1]*111320)
 path=center['geometry']['coordinates'];line=LineString([xy(p) for p in path]);point=Point(xy(west['geometry']['coordinates'][-1]));snap=nearest_points(point,line)[1]
 if point.distance(snap)>50:raise ValueError('Keystone approach moved; review display snap')
 target=[round(snap.x/(cos*111320),7),round(snap.y/111320,7)]
 best=min(range(len(path)-1),key=lambda i:LineString([xy(path[i]),xy(path[i+1])]).distance(snap))
 # Split all coincident service sections at the same centerline join.
 result=[]
 for f in features:
  if f is west:
   # Bundle members share coordinate arrays; isolate this service's edit.
   f['geometry']=deepcopy(f['geometry'])
   f['geometry']['coordinates'][-1]=target;f['properties']['displayRepair']='Keystone west approach snapped to shared NEC';result.append(f)
  elif f['geometry']['coordinates']==path:
   for coordinates in [path[:best+1]+[target],[target]+path[best+1:]]:
    part=deepcopy(f);part['geometry']['coordinates']=coordinates;result.append(part)
  else:result.append(f)
 return {'type':'FeatureCollection','features':result}


def extend_pennsylvanian_to_philadelphia(fc):
 """Represent the scheduled Philadelphia stop on the existing NEC approach.
 The retained NTAD Pennsylvanian shortcut omits this station approach; reuse
 shared source track and keep timetable membership independent of the drawing.
 """
 from copy import deepcopy
 features=deepcopy(fc['features'])
 # Remove the shortcut across the junction, then use the shared station approach.
 shortcuts=[([-75.1985969,39.9720838],[-75.1928297,39.977063]),([-75.1928297,39.977063],[-75.1912282,39.9780567])]
 features=[f for f in features if not(f['properties']['name']=='Pennsylvanian' and (f['geometry']['coordinates'][0],f['geometry']['coordinates'][-1]) in shortcuts)]
 west=next(f for f in features if f['properties']['name']=='Pennsylvanian' and f['geometry']['coordinates'][0]==[-76.8938411,40.306624])
 key_west=next(f for f in features if f['properties']['name']=='Keystone Service' and f['geometry']['coordinates'][0]==[-76.8938411,40.306624])
 west['geometry']=deepcopy(west['geometry']);west['geometry']['coordinates'][-1]=list(key_west['geometry']['coordinates'][-1])
 # All shared sections between the station and the northern NEC junction.
 additions=[]
 for f in features:
  if f['properties']['name']!='Acela':continue
  points=f['geometry']['coordinates']
  if all(-75.201<p[0]<-75.175 and 39.9516<=p[1]<=39.97806 for p in points):
   clone=deepcopy(f);clone['properties'].update(name='Pennsylvanian',symbologyName='Pennsylvanian',lanePriority=0,laneSouthPriority=None,displayRepair='Philadelphia scheduled stop approach; existing shared NEC track');additions.append(clone)
 features.extend(additions)
 return {'type':'FeatureCollection','features':features}


def reorder_display_bundles(fc,priorities):
 """Recompute shared lane slots after documented display repairs."""
 groups=defaultdict(list)
 for f in fc['features']:groups[tuple(tuple(p) for p in f['geometry']['coordinates'])].append(f)
 for group in groups.values():
  if not all(-75.201<p[0]<-75.175 and 39.9516<=p[1]<=39.97806 for p in group[0]['geometry']['coordinates']):continue
  symbols={f['properties'].get('symbologyName',f['properties']['name']) for f in group}
  south={f['properties'].get('symbologyName',f['properties']['name']):f['properties'].get('laneSouthPriority') for f in group}
  ordered=sorted(symbols,key=lambda name:(2,south[name]) if south[name] is not None else (0,priorities.index(name)) if name in priorities else (1,name))
  for f in group:
   name=f['properties']['name'];symbol=f['properties'].get('symbologyName',name)
   f['properties']['lane']=ordered.index(symbol)-(len(ordered)-1)/2
   f['properties']['lanePriority']=priorities.index(name) if name in priorities else None
   f['properties']['shared']=len(group)
 return fc


def trim_philadelphia_station_branches(fc):
 from copy import deepcopy
 features=deepcopy(fc['features'])
 # Both services reverse at Philadelphia: end their station branches at the
 # station projection, rather than extending to the source track section end.
 import math
 station=(-75.1810427766141,39.9556230655432)
 project=lambda p:(p[0],math.log(math.tan(math.pi/4+math.radians(p[1])/2))*180/math.pi)
 q=project(station)
 for f in features:
  p=f['geometry']['coordinates']
  if f['properties']['name'] not in ['Pennsylvanian','Keystone Service'] or p[0]!=[-75.1829788,39.9516484]:continue
  a,b=project(p[0]),project(p[1]);dx,dy=b[0]-a[0],b[1]-a[1]
  t=max(0,min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/(dx*dx+dy*dy)))
  target=[a[0]+t*dx,math.degrees(2*math.atan(math.exp(math.radians(a[1]+t*dy)))-math.pi/2)]
  f['geometry']={'type':'LineString','coordinates':[target]+[list(point) for point in p[1:]]}
 return {'type':'FeatureCollection','features':features}


def add_pennsylvanian_station_approach(fc):
 """Add the verified Philadelphia stop approach without deleting or moving
 any original NTAD Pennsylvanian section. The timetable establishes the stop;
 geometry comes from the existing NEC track in the original source.
 """
 from copy import deepcopy
 features=deepcopy(fc['features'])
 for f in fc['features']:
  if f['properties']['name']!='Acela':continue
  if not all(-75.201<p[0]<-75.175 and 39.9516<=p[1]<=39.97806 for p in f['geometry']['coordinates']):continue
  clone=deepcopy(f);clone['properties'].update(name='Pennsylvanian',symbologyName='Pennsylvanian',lanePriority=0,laneSouthPriority=None,displayRepair='Philadelphia scheduled stop approach; existing shared NEC track; original Pennsylvanian preserved')
  features.append(clone)
 return {'type':'FeatureCollection','features':features}


def connect_verified_route_gaps(fc,shapes_by_route,maximum_length=750,maximum_deviation=100):
 """Fill gaps only along existing original track, corroborated by official
 GTFS geometry. No straight bridges, station changes or travel times inferred.
 """
 import math,heapq
 from copy import deepcopy
 edges=noded_route_edges(fc);adj=defaultdict(list);degrees=defaultdict(lambda:defaultdict(int));parents=defaultdict(dict)
 def distance(a,b):return math.hypot((a[0]-b[0])*math.cos((a[1]+b[1])*math.pi/360),a[1]-b[1])*111320
 def find(name,p):
  parent=parents[name];parent.setdefault(p,p)
  root=p
  while parent[root]!=root:root=parent[root]
  while parent[p]!=p:p,parent[p]=parent[p],root
  return root
 for (a,b),names in edges.items():
  length=distance(a,b);adj[a].append((b,length));adj[b].append((a,length))
  for name in names:
   degrees[name][a]+=1;degrees[name][b]+=1
   ra,rb=find(name,a),find(name,b)
   if ra!=rb:parents[name][rb]=ra
 repairs=[];rejected=[]
 for name,counts in degrees.items():
  ends={p for p,count in counts.items() if count==1}
  for start in sorted(ends):
   queue=[(0,start)];seen={start:0};previous={};target=None
   while queue:
    length,p=heapq.heappop(queue)
    if length>maximum_length:break
    if p!=start and p in ends and find(name,p)!=find(name,start):target=p;break
    for q,segment_length in adj[p]:
     if name in edges[tuple(sorted((p,q)))]:continue
     candidate=length+segment_length
     if candidate<=maximum_length and candidate<seen.get(q,float('inf')):seen[q]=candidate;previous[q]=p;heapq.heappush(queue,(candidate,q))
   if target is None or start>=target:continue
   path=[target]
   while path[-1]!=start:path.append(previous[path[-1]])
   path.reverse();cos=math.cos(start[1]*math.pi/180);xy=lambda p:(p[0]*cos*111320,p[1]*111320)
   verification_name='Floridian' if name=='Silver Star' else name
   lines=[LineString([xy(p) for p in shape]) for shape in shapes_by_route.get(verification_name.casefold(),[]) if len(shape)>1]
   deviation=min((max(line.distance(Point(xy(p))) for p in path) for line in lines),default=None)
   record={'route':name,'lengthMeters':round(seen[target],1),'coordinates':[list(p) for p in path],'verificationRoute':verification_name,'gtfsMaximumDeviationMeters':round(deviation,1) if deviation is not None else None,'method':'Existing NTAD track path; GTFS shape corroboration'}
   if deviation is None or deviation>maximum_deviation:rejected.append(record);continue
   repairs.append(record);parents[name][find(name,target)]=find(name,start)
 features=deepcopy(fc['features'])
 for repair in repairs:
  template=next(f for f in fc['features'] if f['properties']['name']==repair['route'])
  features.append({'type':'Feature','properties':{**template['properties'],'displayRepair':repair['method']},'geometry':{'type':'LineString','coordinates':repair['coordinates']}})
 return {**fc,'features':features},repairs,rejected
