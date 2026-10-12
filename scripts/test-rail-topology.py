"""Check that cartographic duplicate removal preserves distinct branches/services."""
from rail_topology import simplify_display_sections

def feature(name,coords):
 return {'type':'Feature','properties':{'name':name,'lane':0},'geometry':{'type':'LineString','coordinates':coords}}
main=feature('A',[[-74.02,40],[-74,40],[-73.98,40]])
duplicate=feature('A',[[-74.01,40.0002],[-73.99,40.0002]])
branch=feature('A',[[-74,40],[-73.999,40.004]])
other_service=feature('B',[[-74.01,40.0002],[-73.99,40.0002]])
fc={'type':'FeatureCollection','features':[main,duplicate,branch,other_service]}
result,count=simplify_display_sections(fc)
assert count==1
assert main in result['features'] and branch in result['features'] and other_service in result['features']
assert duplicate not in result['features']
print('Verified redundant-track generalization preserves distinct branches and services.')

# North Philadelphia: buffered adjoining sections must not erase their bridge.
west=feature('A',[[-75.17,39.99],[-75.1585532,39.995913]])
bridge=feature('A',[[-75.1585532,39.995913],[-75.1575273,39.9962988]])
east=feature('A',[[-75.1575273,39.9962988],[-75.14,40.003]])
result,count=simplify_display_sections({'type':'FeatureCollection','features':[west,bridge,east]})
assert count==0 and bridge in result['features']
print('Verified short connecting track segments are retained between longer sections.')

# A tiny branch connector must survive even inside another track's buffer.
protected=feature('A',[[-74.001,40],[-74,40.0001]])
protected['properties']['preserveConnector']=True
result,count=simplify_display_sections({'type':'FeatureCollection','features':[main,protected]})
assert protected in result['features'] and count==0

# A shallow through-line vertex is still a real branch junction. Simplification
# must retain it even when route membership/lane slots do not change there.
import importlib.util
spec=importlib.util.spec_from_file_location('builder','scripts/build-rail-air.py');builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
junction=[-74,40.0001]
source={'type':'FeatureCollection','features':[feature('A',[[-74.02,40],junction,[-73.98,40]]),feature('A',[junction,[-74,40.01]])]}
drawn,_=builder.parallel_routes(source)
assert any(tuple(junction) in [tuple(p) for p in f['geometry']['coordinates'][1:-1]] for f in drawn['features'])
assert sum(tuple(junction) in [tuple(p) for p in f['geometry']['coordinates']] for f in drawn['features'])==2
print('Verified a shared source junction survives shallow-bend simplification.')
