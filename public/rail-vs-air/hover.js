// Choose the actual nearest stroke within the generous click/hover area.
export function closestRouteAtPoint(features,point,project,radius=9){
 let name=null,best=radius*radius;
 for(const f of features){const coordinates=f.geometry.type==='MultiLineString'?f.geometry.coordinates:[f.geometry.coordinates];
  for(const line of coordinates)for(let i=1;i<line.length;i++){
   const a=project(line[i-1]),b=project(line[i]),dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy||1))),distance=(point.x-a.x-t*dx)**2+(point.y-a.y-t*dy)**2;
   if(distance<best){best=distance;name=f.properties.symbologyName||f.properties.name;}
  }
 }
 return name;
}
