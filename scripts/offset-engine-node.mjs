import fs from 'node:fs';
import vm from 'node:vm';
const L={bind:(f,c)=>f.bind(c),LineUtil:{simplify:p=>p},Polyline:{include:()=>{}}};
vm.runInNewContext(fs.readFileSync(new URL('../public/rail-vs-air/vendor/leaflet.polylineoffset.js',import.meta.url),'utf8'),{window:{L},L});
globalThis.L=L;
