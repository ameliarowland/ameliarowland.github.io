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
    redundant=True
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
