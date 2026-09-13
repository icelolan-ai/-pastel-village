import * as THREE from 'three';
import { createLights, createPlaceholder, createSkyDome, createTerrain, type TerrainBounds } from '../rendering/SceneSetup';
import { ROAD_EDGES, ROAD_NODES, ZONES, computeVillageBounds } from './villageData';
import { RoadGraph } from './road/RoadGraph';
import { createRoadGraphDebugGroup } from './road/RoadGraphDebugRenderer';
import { buildRoadMeshes } from './road/RoadMeshBuilder';
import { createZoneDebugGroup } from './ZoneDebugRenderer';
import { buildBuildingMesh } from './buildings/BuildingMeshBuilder';
import { BUILDING_TYPES } from './buildings/buildingTypes';
import { placeAllBuildings } from './buildings/BuildingPlacement';

/**
 * Builds the `World > { Terrain, Roads, Buildings, Nature, Props, NPCs,
 * Zombies, SkyDome, Lights }` hierarchy from Master Blueprint Section 6.
 * Groups with no content yet are still created (empty) so later phases can
 * `worldBundle.groups.buildings.add(...)` etc. without touching this file.
 *
 * As of Phase 3a, `Roads` holds the real road meshes (always visible) and
 * `RoadsDebug` holds the thin debug lines from Phase 2 (toggle with R) —
 * pressing R no longer hides the real road surface, only the debug overlay.
 * Note: `RoadsDebug` is — like `ZonesDebug` — not one of the 9 canonical
 * Section 6 groups; it's a second non-canonical debug group living directly
 * under `World` alongside them (total top-level children of World = 11:
 * the 9 canonical groups + ZonesDebug + RoadsDebug).
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
    /** Not one of the 9 canonical groups — the Phase 2 thin debug lines, now separate from the real road surface in `roads`. */
    roadsDebug: THREE.Group;
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
  const realRoadMeshes = buildRoadMeshes(roadGraph);
  const zoneDebugPatches = createZoneDebugGroup(ZONES);

  const terrainGroup = makeGroup('Terrain');
  terrainGroup.add(terrainMesh);

  const roadsGroup = makeGroup('Roads');
  roadsGroup.add(realRoadMeshes); // real, always-visible road surface (Phase 3a)

  const roadsDebugGroup = makeGroup('RoadsDebug');
  roadsDebugGroup.add(roadDebugLines); // thin centerline overlay, toggled with R — no longer hides the real roads

  const buildingsGroup = makeGroup('Buildings');
  const VILLAGE_SEED = 42; // fixed — Phase 3b AC #5 requires identical layout across every reload
  const buildingPlacements = placeAllBuildings(ZONES, roadGraph, VILLAGE_SEED);
  const buildingLift = 0.01; // avoid z-fighting with Terrain at the wall base, same technique as Roads
  for (const placement of buildingPlacements) {
    const mesh = buildBuildingMesh(BUILDING_TYPES[placement.typeId]);
    mesh.position.set(placement.position[0], buildingLift, placement.position[1]);
    mesh.rotation.y = placement.rotationY;
    mesh.userData.typeId = placement.typeId;
    buildingsGroup.add(mesh);
  }

  const natureGroup = makeGroup('Nature'); // empty — Phase 3c
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

  // Now that real road surfaces exist, the thin centerline overlay is
  // redundant by default — it's a QC aid (AC #2: compare it against the
  // real mesh), so it starts OFF and is toggled on with R.
  roadsDebugGroup.visible = false;

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
    roadsDebugGroup,
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
      roadsDebug: roadsDebugGroup,
    },
    roadGraph,
    placeholder,
    terrainExtents,
    setRoadDebugVisible: (visible: boolean) => {
      roadsDebugGroup.visible = visible;
    },
    setZoneDebugVisible: (visible: boolean) => {
      zonesDebugGroup.visible = visible;
    },
    dispose,
  };
}
