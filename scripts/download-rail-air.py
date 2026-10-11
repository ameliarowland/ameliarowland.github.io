#!/usr/bin/env python3
"""Download public source snapshots; retain originals to reproduce this build."""
import argparse,json,urllib.request,urllib.parse,concurrent.futures
from pathlib import Path
BASE='https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/'
def query(layer,**params):
 with urllib.request.urlopen(BASE+layer+'/FeatureServer/0/query?'+urllib.parse.urlencode(params),timeout=120) as r:d=json.load(r)
 if 'error' in d:raise RuntimeError(d['error'])
 if d.get('exceededTransferLimit'):raise RuntimeError('Partial ArcGIS response; pagination is required before updating the snapshot.')
 return d

def main():
 p=argparse.ArgumentParser();p.add_argument('--output-dir',required=True);p.add_argument('--flight-period',required=True,help='YYYY-MM');a=p.parse_args();out=Path(a.output_dir);out.mkdir(parents=True,exist_ok=True)
 year,month=map(int,a.flight_period.split('-'));assert 1<=month<=12
 urls={'amtrak.zip':'https://content.amtrak.com/content/gtfs/GTFS.zip','airports.csv':'https://davidmegginson.github.io/ourairports-data/airports.csv','flights.zip':f'https://www.transtats.bts.gov/PREZIP/On_Time_Reporting_Carrier_On_Time_Performance_1987_present_{year}_{month}.zip'}
 for name,url in urls.items():
  print('Downloading',name,flush=True)
  with urllib.request.urlopen(url,timeout=300) as r,(out/name).open('wb') as f:
   while chunk:=r.read(1024*1024):f.write(chunk)
 route_names=query('NTAD_Amtrak_Routes',where='1=1',outFields='name',returnGeometry='false',f='json')['features']
 def fetch_route(feature):
  name=feature['attributes']['name']
  return query('NTAD_Amtrak_Routes',where="name='"+name.replace("'","''")+"'",outFields='name,ROUTE_URL',outSR=4326,f='geojson')['features']
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:features=[f for result in ex.map(fetch_route,route_names) for f in result]
 assert len(features)==len(route_names)
 (out/'routes.geojson').write_text(json.dumps({'type':'FeatureCollection','features':features}),encoding='utf-8')
 stations=query('NTAD_Amtrak_Stations',where="StnType = 'TRAIN' AND StaType <> 'Curbside Bus Stop only (no shelter)'",outFields='*',outSR=4326,f='geojson')
 (out/'stations.geojson').write_text(json.dumps(stations),encoding='utf-8')
 print('Complete. Preserve these inputs; the live GTFS feed changes.')
if __name__=='__main__':main()
