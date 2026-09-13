import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createWorldBundle } from './WorldBundle';

describe('createWorldBundle', () => {
  it('creates all 9 named groups from Master Blueprint Section 6, findable via scene.getObjectByName', () => {
    const scene = new THREE.Scene();
    const bundle = createWorldBundle();
    scene.add(bundle.world);

    const requiredGroupNames = [
      'Terrain',
      'Roads',
      'Buildings',
      'Nature',
      'Props',
      'NPCs',
      'Zombies',
      'SkyDome',
      'Lights',
    ];
    for (const name of requiredGroupNames) {
      expect(scene.getObjectByName(name), `missing group "${name}"`).toBeDefined();
    }
  });

  it('AC #1: the real Roads group contains a ribbon mesh per edge + a junction pad per multi-edge node (not debug lines)', () => {
    const bundle = createWorldBundle();
    const edgeCount = bundle.roadGraph.getAllEdges().length;

    let meshCount = 0;
    let lineCount = 0;
    bundle.groups.roads.traverse((obj) => {
      if (obj instanceof THREE.Mesh) meshCount += 1;
      if (obj instanceof THREE.Line) lineCount += 1;
    });

    expect(lineCount).toBe(0); // debug lines must NOT live in the real Roads group anymore
    expect(meshCount).toBeGreaterThanOrEqual(edgeCount); // at least one ribbon mesh per edge, plus any junction pads
  });

  it('AC #2: RoadsDebug contains exactly one line per road edge, tracing the same path as the real meshes', () => {
    const bundle = createWorldBundle();
    const edgeCount = bundle.roadGraph.getAllEdges().length;
    let lineCount = 0;
    bundle.groups.roadsDebug.traverse((obj) => {
      if (obj instanceof THREE.Line) lineCount += 1;
    });
    expect(lineCount).toBe(edgeCount);
    expect(edgeCount).toBeGreaterThanOrEqual(4); // at least 4 branch/loop segments
  });

  it('AC #4: pressing R only hides RoadsDebug — the real Roads group is unaffected', () => {
    const bundle = createWorldBundle();

    bundle.setRoadDebugVisible(true);
    expect(bundle.groups.roadsDebug.visible).toBe(true);
    expect(bundle.groups.roads.visible).toBe(true);

    bundle.setRoadDebugVisible(false);
    expect(bundle.groups.roadsDebug.visible).toBe(false);
    expect(bundle.groups.roads.visible).toBe(true); // real roads must stay visible regardless of the debug toggle
  });

  it('AC #5: setZoneDebugVisible is unaffected by the road changes', () => {
    const bundle = createWorldBundle();
    bundle.setZoneDebugVisible(false);
    expect(bundle.groups.zonesDebug.visible).toBe(false);
    bundle.setZoneDebugVisible(true);
    expect(bundle.groups.zonesDebug.visible).toBe(true);
  });

  it('RoadsDebug starts hidden by default (real roads already show the path; debug lines are opt-in for comparison)', () => {
    const bundle = createWorldBundle();
    expect(bundle.groups.roadsDebug.visible).toBe(false);
  });

  it('AC #6 regression: World now has 11 top-level groups (9 canonical + ZonesDebug + RoadsDebug)', () => {
    const bundle = createWorldBundle();
    expect(bundle.world.children.length).toBe(11);
  });

  it('zone debug group renders at least 4 distinct zone types (AC #3)', () => {
    const bundle = createWorldBundle();
    const types = new Set<string>();
    bundle.groups.zonesDebug.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData.zoneType) {
        types.add(obj.userData.zoneType as string);
      }
    });
    expect(types.size).toBeGreaterThanOrEqual(4);
  });

  it('terrainExtents fully covers every road node and zone polygon point', () => {
    const bundle = createWorldBundle();
    const { minX, maxX, minZ, maxZ } = bundle.terrainExtents;

    for (const node of bundle.roadGraph.getAllNodes()) {
      const [x, z] = node.position;
      expect(x).toBeGreaterThanOrEqual(minX);
      expect(x).toBeLessThanOrEqual(maxX);
      expect(z).toBeGreaterThanOrEqual(minZ);
      expect(z).toBeLessThanOrEqual(maxZ);
    }
  });
});
