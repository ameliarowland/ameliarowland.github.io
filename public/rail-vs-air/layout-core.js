import {createSchematicEngine} from './schematic.js?v=station-schematic-22';
export function createLayoutEngine(routes,stations) {
 const engine=createSchematicEngine(routes,stations);
 return job=>engine.render(job);
}
