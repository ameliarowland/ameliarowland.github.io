"""Compare connected components against the original route snapshot."""
import argparse,json
from collections import defaultdict

def route_components(fc):
 groups=defaultdict(list)
 for f in fc['features']:
  g=f['geometry'];groups[f['properties']['name']].extend(g['coordinates'] if g['type']=='MultiLineString' else [g['coordinates']])
 result={}
 for name,parts in groups.items():
  parent={}
  def find(p):
   parent.setdefault(p,p)
   if parent[p]!=p:parent[p]=find(parent[p])
   return parent[p]
  for line in parts:
   points=[tuple(round(v,7) for v in p[:2]) for p in line]
   for a,b in zip(points,points[1:]):
    ra,rb=find(a),find(b)
    if ra!=rb:parent[rb]=ra
  result[name]=len({find(p) for p in parent})
 return result

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--display',default='public/rail-vs-air/data/routes.geojson');p.add_argument('--report');args=p.parse_args()
 source_data=json.load(open(args.source));display_data=json.load(open(args.display));original=route_components(source_data);display=route_components(display_data)
 vertex_keys=defaultdict(set)
 for f in display_data['features']:vertex_keys[f['properties']['name']].update(tuple(round(v*1e7) for v in point[:2]) for point in f['geometry']['coordinates'])
 for f in source_data['features']:
  g=f['geometry'];parts=g['coordinates'] if g['type']=='MultiLineString' else [g['coordinates']]
  for part in parts:
   for point in part:
    x,y=[round(v*1e7) for v in point[:2]]
    assert any((x+dx,y+dy) in vertex_keys[f['properties']['name']] for dx in [-1,0,1] for dy in [-1,0,1]),f"Original vertex removed from {f['properties']['name']}: {point}"
 report={name:{'originalComponents':count,'displayComponents':display.get(name),'newDisconnection':display.get(name,0)>count} for name,count in original.items()}
 if args.report:json.dump(report,open(args.report,'w'),indent=2)
 broken={name:row for name,row in report.items() if row['newDisconnection']}
 assert not broken,json.dumps(broken)
 assert original['Pennsylvanian']==display['Pennsylvanian']==1
 print(f'All {len(original)} routes preserve original connectivity; Pennsylvanian has one connected component.')
