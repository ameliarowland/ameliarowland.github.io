// Run the unchanged upstream math engine without Leaflet's DOM dependencies.
export async function loadOffsetEngine() {
 if(globalThis.L?.PolylineOffset)return globalThis.L.PolylineOffset;
 const L={bind:(fn,context)=>fn.bind(context),LineUtil:{simplify:points=>points},Polyline:{include:()=>{}}};
 globalThis.L=L;globalThis.window={L};
 await import('./vendor/leaflet.polylineoffset.js');
 return L.PolylineOffset;
}
