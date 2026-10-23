// Compare side placements using the amount of visible route covered by each.
export function corridorPopupPlacement(point,viewport,paths,{width=220,height=300,near=false}={}){
 const margin=12,gap=near?12:16,w=Math.min(width,viewport.width-2*margin),h=Math.min(height,viewport.height-2*margin);
 function covered(a,b,rect){const delta=b.map((v,i)=>v-a[i]);let lo=0,hi=1;for(let i=0;i<2;i++){const low=i?rect.y:rect.x,high=low+(i?rect.height:rect.width);if(Math.abs(delta[i])<1e-9){if(a[i]<low||a[i]>high)return 0;continue;}let t=(low-a[i])/delta[i],u=(high-a[i])/delta[i];if(t>u)[t,u]=[u,t];lo=Math.max(lo,t);hi=Math.min(hi,u);if(lo>hi)return 0;}return Math.hypot(...delta)*Math.max(0,hi-lo);}
 const obstacles=viewport.obstacles||[],overlapArea=(a,b)=>Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
 const candidates=['left','right'].flatMap(anchor=>{const wanted=anchor==='left'?point.x+gap:point.x-gap-w,x=Math.max(margin,Math.min(wanted,viewport.width-margin-w)),ys=[point.y-h*.5,point.y-h*.2,point.y-h*.8,...obstacles.flatMap(o=>[o.y-h-8,o.y+o.height+8])];return ys.map(wantedY=>{const y=Math.max(margin,Math.min(wantedY,viewport.height-margin-h)),rect={x,y,width:w,height:h};let overlap=0;for(const path of paths)for(let i=1;i<path.length;i++)overlap+=covered(path[i-1],path[i],rect);const clipping=Math.abs(x-wanted),controlOverlap=obstacles.reduce((sum,o)=>sum+overlapArea(rect,o),0);const tip=popupTip(point,rect),distance=Math.hypot(rect.x+tip.x-point.x,rect.y+tip.y-point.y);return {anchor,rect,score:controlOverlap*10000+overlap*(near?.02:1)+clipping*10+(near?distance*10+Math.abs(y+h/2-point.y)*.1:distance*.35+Math.abs(y+h/2-point.y)*.3),offset:[x-point.x,y-point.y],tip:popupTip(point,rect)};});});
 return candidates.sort((a,b)=>a.score-b.score)[0];
}

// The pointer slides along the nearest box edge, independently of placement.
export function popupTip(point,rect){
 const clamp=(v,lo,hi)=>Math.max(lo,Math.min(v,hi)),x=clamp(point.x-rect.x,12,rect.width-12),y=clamp(point.y-rect.y,12,rect.height-12);
 return [{side:'left',x:0,y},{side:'right',x:rect.width,y},{side:'top',x,y:0},{side:'bottom',x,y:rect.height}].sort((a,b)=>Math.hypot(rect.x+a.x-point.x,rect.y+a.y-point.y)-Math.hypot(rect.x+b.x-point.x,rect.y+b.y-point.y))[0];
}
