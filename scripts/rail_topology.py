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
   for j,reference in kept:
    if not envelope.intersects(reference.envelope.buffer(tolerance)):continue
    if line.covered_by(reference.buffer(tolerance,quad_segs=4)):
     redundant=True;break
   if redundant:removed.add(i)
   else:kept.append((i,line))
 return {'type':'FeatureCollection','features':[f for i,f in enumerate(fc['features']) if i not in removed]},len(removed)
