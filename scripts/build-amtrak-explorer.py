"""Build the rail-only explorer from retained Amtrak GTFS and schematic sources."""
import csv,datetime,hashlib,io,json,zipfile
from collections import defaultdict
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'public/amtrak-direct-route-explorer/data'
OUT=ROOT/'public/amtrak-direct-route-explorer/data'
def minutes(value):
    h,m,s=map(int,value.split(':'));return h*60+m+s/60

def build(raw=ROOT.parent/'amtrak.zip',source=SOURCE,out=OUT):
    out.mkdir(parents=True,exist_ok=True)
    manifest=json.loads((source/'manifest.json').read_text())
    start=datetime.date.fromisoformat(manifest.get('railStart',manifest.get('start')));end=datetime.date.fromisoformat(manifest.get('railEnd',manifest.get('end')))
    days=[start+datetime.timedelta(days=i) for i in range((end-start).days+1)]
    with zipfile.ZipFile(raw) as z:
        def read(name):return list(csv.DictReader(io.TextIOWrapper(z.open(name),encoding='utf-8-sig')))
        services=defaultdict(set)
        for row in read('calendar.txt'):
            for day in days:
                if row['start_date']<=day.strftime('%Y%m%d')<=row['end_date'] and row[day.strftime('%A').lower()]=='1':services[row['service_id']].add(day.isoformat())
        if 'calendar_dates.txt' in z.namelist():
            for row in read('calendar_dates.txt'):
                day=datetime.datetime.strptime(row['date'],'%Y%m%d').date()
                if start<=day<=end:
                    if row['exception_type']=='1':services[row['service_id']].add(day.isoformat())
                    else:services[row['service_id']].discard(day.isoformat())
        routes={r['route_id']:r['route_long_name'] for r in read('routes.txt') if r['route_type']=='2' and r['route_long_name']!='Commuter Rail'}
        trips={r['trip_id']:r for r in read('trips.txt') if r['route_id'] in routes and services[r['service_id']]}
        times=defaultdict(list)
        for row in read('stop_times.txt'):
            if row['trip_id'] in trips:times[row['trip_id']].append(row)
        gtfs_stops={r['stop_id']:r for r in read('stops.txt')}
    journeys=[]
    for tid,trip in trips.items():
        rows=sorted(times[tid],key=lambda r:int(r['stop_sequence']))
        rows=[r for r in rows if r['arrival_time'] and r['departure_time']]
        if len(rows)<2:continue
        item={'id':tid,'route':routes[trip['route_id']],'number':trip.get('trip_short_name',''),'dates':sorted(services[trip['service_id']]),'stops':[r['stop_id'] for r in rows],'arrival':[minutes(r['arrival_time']) for r in rows],'departure':[minutes(r['departure_time']) for r in rows]}
        for field,column in [('noPickup','pickup_type'),('noDropoff','drop_off_type')]:
            restricted=[i for i,r in enumerate(rows) if r.get(column)=='1']
            if restricted:item[field]=restricted
        journeys.append(item)
    scheduled={code for trip in journeys for code in trip['stops']}
    stations=json.loads((source/'stations.geojson').read_text());features=[]
    for f in stations['features']:
        p=f['properties'];names=[n for n in p.get('routeNames',[]) if n not in ['Capitol Limited','Silver Star']]
        if not names and p['Code'] not in scheduled:continue
        features.append({'type':'Feature','geometry':f['geometry'],'properties':{'Code':p['Code'],'title':p.get('title') or str(p.get('Name','')).strip() or p.get('StationName') or p['Code'],'routeNames':names}})
    known={f['properties']['Code'] for f in features}
    for code in sorted(scheduled-known):
        stop=gtfs_stops[code];features.append({'type':'Feature','geometry':{'type':'Point','coordinates':[float(stop['stop_lon']),float(stop['stop_lat'])]},'properties':{'Code':code,'title':stop['stop_name'],'routeNames':sorted({t['route'] for t in journeys if code in t['stops']})}})
    colors=manifest['routeColors'];route_data=json.loads((source/('station-schematic.geojson' if (source/'station-schematic.geojson').exists() else 'routes.geojson')).read_text())
    route_data['features']=[f for f in route_data['features'] if f['properties']['name'] not in ['Capitol Limited','Silver Star']]
    for f in route_data['features']:
        p=f['properties'];name=p.get('symbologyName') or p['name'];p['color']=colors.get(name,colors.get(p['name'],'#efbd43'))
    outputs={'stations.geojson':{'type':'FeatureCollection','features':features},'routes.geojson':route_data,'timetable.json':{'start':start.isoformat(),'end':end.isoformat(),'trips':journeys},'manifest.json':{'name':'Amtrak direct route explorer','feedVersion':manifest['feedVersion'],'start':start.isoformat(),'end':end.isoformat(),'source':'https://content.amtrak.com/content/gtfs/GTFS.zip','sha256':hashlib.sha256(raw.read_bytes()).hexdigest(),'routeColors':colors,'tripCount':len(journeys),'stationCount':len(features)}}
    for name,data in outputs.items():(out/name).write_text(json.dumps(data,separators=(',',':'))+'\n')
    print(len(journeys),'scheduled trips;',len(features),'stations')
if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--gtfs',type=Path,required=True);parser.add_argument('--source',type=Path,default=SOURCE);parser.add_argument('--out',type=Path,default=OUT);args=parser.parse_args();build(args.gtfs,args.source,args.out)
