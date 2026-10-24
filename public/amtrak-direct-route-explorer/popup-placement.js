// Keep the action next to the station. Only flip sides or nudge at map edges.
export function stationControlPlacement(point,viewport,{width=200,height=38}={}){
 const gap=12,margin=8,leftSpace=point.x-margin,rightSpace=viewport.width-point.x-margin;
 const left=rightSpace<width+gap&&leftSpace>rightSpace;
 const y=Math.max(margin,Math.min(point.y-height/2,viewport.height-margin-height));
 return {anchor:left?'right':'left',offset:[left?-gap:gap,y-(point.y-height/2)]};
}
