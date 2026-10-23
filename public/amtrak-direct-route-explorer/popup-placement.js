// Clip route segments against the popup, including a little breathing room.
function covered(a,b,rect){
 const delta=b.map((v,i)=>v-a[i]);let lo=0,hi=1;
 for(let i=0;i<2;i++){
  const low=i?rect.y:rect.x,high=low+(i?rect.height:rect.width);
  if(Math.abs(delta[i])<1e-9){if(a[i]<low||a[i]>high)return 0;continue;}
  let t=(low-a[i])/delta[i],u=(high-a[i])/delta[i];if(t>u)[t,u]=[u,t];
  lo=Math.max(lo,t);hi=Math.min(hi,u);if(lo>hi)return 0;
 }
 return Math.hypot(...delta)*Math.max(0,hi-lo);
}
export function corridorPopupPlacement(point,viewport,paths,{width=200,height=120,priorityPaths=paths}={}){
 const margin=12,gap=14,w=Math.min(width,viewport.width-2*margin),h=Math.min(height,viewport.height-2*margin),obstacles=viewport.obstacles||[];
 const clamp=(v,max)=>Math.max(margin,Math.min(v,max-margin));
 const xs=[point.x+gap,point.x-gap-w,point.x-w/2,...obstacles.flatMap(o=>[o.x-w-8,o.x+o.width+8])];
 const ys=[point.y-h/2,point.y+gap,point.y-gap-h,...obstacles.flatMap(o=>[o.y-h-8,o.y+o.height+8])];
 // Sample all four sides, so a diagonal or branching route can use a clear corner.
 for(let d=-Math.max(w,h);d<=Math.max(w,h);d+=20){xs.push(point.x-w/2+d);ys.push(point.y-h/2+d);}
 const length=(routes,rect)=>routes.reduce((sum,path)=>sum+path.slice(1).reduce((n,p,i)=>n+covered(path[i],p,rect),0),0);
 const candidates=[];
 for(const wantedX of xs)for(const wantedY of ys){
  const x=clamp(wantedX,viewport.width-w),y=clamp(wantedY,viewport.height-h),rect={x,y,width:w,height:h};
  const controlOverlap=obstacles.reduce((sum,o)=>sum+Math.max(0,Math.min(x+w,o.x+o.width)-Math.max(x,o.x))*Math.max(0,Math.min(y+h,o.y+o.height)-Math.max(y,o.y)),0);
  const padded={x:x-6,y:y-6,width:w+12,height:h+12},priorityOverlap=length(priorityPaths,padded),tip=popupTip(point,rect),distance=Math.hypot(x+tip.x-point.x,y+tip.y-point.y);
  const coversStation=point.x>=padded.x&&point.x<=padded.x+padded.width&&point.y>=padded.y&&point.y<=padded.y+padded.height;
  candidates.push({anchor:x+w/2<point.x?'right':'left',rect,tip,offset:[x-point.x,y-point.y],blocked:controlOverlap>0||coversStation,priorityOverlap,score:controlOverlap*10000+priorityOverlap*100+distance+Math.hypot(x+w/2-point.x,y+h/2-point.y)*.05});
 }
 // A clear view of the station's own route takes precedence over a shorter tether.
 return candidates.sort((a,b)=>Number(a.blocked)-Number(b.blocked)||Number(a.priorityOverlap>0)-Number(b.priorityOverlap>0)||a.score-b.score)[0];
}

// The pointer slides along the nearest box edge, independently of placement.
export function popupTip(point,rect){
 const clamp=(v,lo,hi)=>Math.max(lo,Math.min(v,hi)),x=clamp(point.x-rect.x,12,rect.width-12),y=clamp(point.y-rect.y,12,rect.height-12);
 return [{side:'left',x:0,y},{side:'right',x:rect.width,y},{side:'top',x,y:0},{side:'bottom',x,y:rect.height}].sort((a,b)=>Math.hypot(rect.x+a.x-point.x,rect.y+a.y-point.y)-Math.hypot(rect.x+b.x-point.x,rect.y+b.y-point.y))[0];
}
