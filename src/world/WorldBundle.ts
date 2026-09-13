import * as THREE from 'three';
import { createLights, createPlaceholder, createSkyDome, createTerrain, type TerrainBounds } from '../rendering/SceneSetup';
import { ROAD_EDGES, ROAD_NODES, ZONES, computeVillageBounds } from './villageData';
import { RoadGraph } from './road/RoadGraph';
import { createRoadGraphDebugGroup } from './road/RoadGraphDebugRenderer';
import { createZoneDebugGroup } from './ZoneDebugRenderer';

/**
 * Builds the `World > { Terrain, Roads, Buildings, Nature, Props, NPCs,
 * Zombies, SkyDome, Lights }` hierarchy from Master Blueprint Section 6.
 * Groups with no content yet are still created (empty) so later phases can
 * `worldBundle.groups.buildings.add(...)` etc. without touching this file.
 */
export interface WorldBundle {
  /** The single object to `scene.add()`. */
  world: THREE.Group;
  groups: {
    terrain: THREE.Group;
    roads: THREE.Group;
    buildings: THREE.Group;
    nature: THREE.Group;
    props: THREE.Group;
    npcs: THREE.Group;
    zombies: THREE.Group;
    skyDome: THREE.Group;
    lights: THREE.Group;
    /** Not one of the 9 canonical groups — a debug-only overlay for Zones (Section 8), toggled independently of Roads. */
    zonesDebug: THREE.Group;
  };
  roadGraph: RoadGraph;
  /** Phase 1 placeholder sphere, kept for now — direct reference so main.ts can animate it without reaching into groups.props.children. */
  placeholder: THREE.Mesh;
  /** The terrain's actual footprint — feed straight into CameraController's pan bounds. */
  terrainExtents: TerrainBounds;
  setRoadDebugVisible: (visible: boolean) => void;
  setZoneDebugVisible: (visible: boolean) => void;
  dispose: () => void;
}

function makeGroup(name: string): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  return group;
}

export function createWorldBundle(): WorldBundle {
  const bounds = computeVillageBounds();
  const { mesh: terrainMesh, extents: terrainExtents } = createTerrain(bounds);

  const roadGraph = new RoadGraph(ROAD_NODES, ROAD_EDGES);
  const roadDebugLines = createRoadGraphDebugGroup(roadGraph);
  const zoneDebugPatches = createZoneDebugGroup(ZONES);

  const terrainGroup = makeGroup('Terrain');
  terrainGroup.add(terrainMesh);

  const roadsGroup = makeGroup('Roads');
  roadsGroup.add(roadDebugLines);

  const buildingsGroup = makeGroup('Buildings'); // empty — Phase 3
  const natureGroup = makeGroup('Nature'); // empty — Phase 3
  const npcsGroup = makeGroup('NPCs'); // empty — Phase 5
  const zombiesGroup = makeGroup('Zombies'); // empty — Phase 7

  const propsGroup = makeGroup('Props');
  const placeholder = createPlaceholder();
  propsGroup.add(placeholder); // Phase 1 placeholder kept as a temp visual anchor until Phase 3 real props land

  const skyDomeGroup = makeGroup('SkyDome');
  skyDomeGroup.add(createSkyDome());

  const lightsGroup = makeGroup('Lights');
  lightsGroup.add(...createLights());

  const zonesDebugGroup = makeGroup('ZonesDebug');
  zonesDebugGroup.add(zoneDebugPatches);

  const world = makeGroup('World');
  world.add(
    terrainGroup,
    roadsGroup,
    buildingsGroup,
    natureGroup,
    propsGroup,
    npcsGroup,
    zombiesGroup,
    skyDomeGroup,
    lightsGroup,
    zonesDebugGroup,
  );

  const dispose = () => {
    world.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        object.geometry?.dispose();
        const material = object.material;
        if (Array.isArray(material)) {
          material.forEach((m) => m.dispose());
        } else {
          material?.dispose();
        }
      }
    });
  };

  return {
    world,
    groups: {
      terrain: terrainGroup,
      roads: roadsGroup,
      buildings: buildingsGroup,
      nature: natureGroup,
      props: propsGroup,
      npcs: npcsGroup,
      zombies: zombiesGroup,
      skyDome: skyDomeGroup,
      lights: lightsGroup,
      zonesDebug: zonesDebugGroup,
    },
    roadGraph,
    placeholder,
    terrainExtents,
    setRoadDebugVisible: (visible: boolean) => {
      roadsGroup.visible = visible;
    },
    setZoneDebugVisible: (visible: boolean) => {
      zonesDebugGroup.visible = visible;
    },
    dispose,
  };
}
