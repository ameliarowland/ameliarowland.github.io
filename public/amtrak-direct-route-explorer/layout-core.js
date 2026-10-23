import {connectHubRoutes} from './hub-connections.js?v=amtrak-5';
import {finalizeLayout} from './finalize-layout.js?v=amtrak-5';
import {overviewApproaches} from './overview-approaches.js?v=amtrak-5';
import {newYorkTerminalBox,losAngelesTerminalBox,washingtonTerminalBox,springfieldTerminalBox} from './terminal-box.js?v=amtrak-5';
import {createNortheastBundleLayout} from './northeast-bundle.js?v=amtrak-5';
import {createSchematicEngine,chicagoOverviewDrawing,stationBarDrawing} from './schematic.js?v=amtrak-5';
export function createLayoutEngine(routes,stations) {
 const engine=createSchematicEngine(routes,stations),bundle=createNortheastBundleLayout(routes,stations);
 const render=job=>{
  let result=bundle(job,stationBarDrawing(chicagoOverviewDrawing(engine.render(job))));
  for(const enclose of [newYorkTerminalBox,losAngelesTerminalBox,washingtonTerminalBox,springfieldTerminalBox])result=enclose(result);
  result=finalizeLayout(overviewApproaches(result,stations),stations);
  // Reallocate Penn's border ports after the final approach vertices move.
  return connectHubRoutes(newYorkTerminalBox(result));
 };
 render.journey=engine.journey;return render;
}
