import csv,importlib.util,io,json,tempfile,unittest,zipfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('builder',Path(__file__).with_name('build-amtrak-explorer.py'));builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
class TimetableBuild(unittest.TestCase):
 def test_overnight(self):self.assertEqual(builder.minutes('27:15:00')-builder.minutes('23:30:00'),225)
 def test_seconds(self):self.assertEqual(builder.minutes('01:00:30'),60.5)
 def test_calendar_modes_and_restrictions(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);source=root/'source';source.mkdir();out=root/'out';archive=root/'gtfs.zip'
   (source/'manifest.json').write_text(json.dumps({'start':'2026-10-12','end':'2026-10-18','feedVersion':'test','routeColors':{'Night Train':'#123456'}}))
   station=lambda code:{'type':'Feature','geometry':{'type':'Point','coordinates':[0,0]},'properties':{'Code':code,'title':code,'routeNames':['Night Train']}}
   (source/'stations.geojson').write_text(json.dumps({'type':'FeatureCollection','features':[station('A'),station('B')]}));(source/'routes.geojson').write_text(json.dumps({'type':'FeatureCollection','features':[]}))
   tables={'routes.txt':[{'route_id':'rail','route_type':'2','route_long_name':'Night Train'},{'route_id':'bus','route_type':'3','route_long_name':'Bus'},{'route_id':'commuter','route_type':'2','route_long_name':'Commuter Rail'}],
    'trips.txt':[{'trip_id':tid,'route_id':route,'service_id':service,'trip_short_name':tid} for tid,route,service in [('normal','rail','weekly'),('removed','rail','removed'),('added','rail','extra'),('bus','bus','weekly'),('commuter','commuter','weekly')]],
    'calendar.txt':[dict(service_id=service,start_date='20261012',end_date='20261018',monday='1',tuesday='0',wednesday='0',thursday='0',friday='0',saturday='0',sunday='0') for service in ['weekly','removed']],
    'calendar_dates.txt':[{'service_id':'removed','date':'20261012','exception_type':'2'},{'service_id':'extra','date':'20261015','exception_type':'1'}],
    'stops.txt':[{'stop_id':code,'stop_name':code,'stop_lon':'0','stop_lat':'0'} for code in ['A','B']],
    'stop_times.txt':[{'trip_id':tid,'stop_id':code,'stop_sequence':i,'arrival_time':time,'departure_time':time,'pickup_type':'1' if tid=='added' and i==0 else '0','drop_off_type':'0'} for tid in ['normal','removed','added','bus','commuter'] for i,(code,time) in enumerate([('A','23:00:00'),('B','27:00:00')])]}
   with zipfile.ZipFile(archive,'w') as z:
    for name,rows in tables.items():
     text=io.StringIO();writer=csv.DictWriter(text,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows);z.writestr(name,text.getvalue())
   builder.build(archive,source,out);trips={t['id']:t for t in json.loads((out/'timetable.json').read_text())['trips']}
   self.assertEqual(set(trips),{'normal','added'});self.assertEqual(trips['normal']['dates'],['2026-10-12']);self.assertEqual(trips['added']['dates'],['2026-10-15']);self.assertEqual(trips['added']['noPickup'],[0]);self.assertEqual(trips['normal']['arrival'][1]-trips['normal']['departure'][0],240)
if __name__=='__main__':unittest.main()
