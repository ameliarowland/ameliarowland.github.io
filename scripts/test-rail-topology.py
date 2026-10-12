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
