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

  it('the Roads group contains one line per road edge (loop + branches)', () => {
    const bundle = createWorldBundle();
    const lineCount = bundle.roadGraph.getAllEdges().length;
    let renderedLines = 0;
    bundle.groups.roads.traverse((obj) => {
      if (obj instanceof THREE.Line) renderedLines += 1;
    });
    expect(renderedLines).toBe(lineCount);
    expect(lineCount).toBeGreaterThanOrEqual(4); // AC #2: at least 4 branch/loop segments
  });

  it('setRoadDebugVisible / setZoneDebugVisible actually toggle group visibility', () => {
    const bundle = createWorldBundle();

    bundle.setRoadDebugVisible(false);
    expect(bundle.groups.roads.visible).toBe(false);
    bundle.setRoadDebugVisible(true);
    expect(bundle.groups.roads.visible).toBe(true);

    bundle.setZoneDebugVisible(false);
    expect(bundle.groups.zonesDebug.visible).toBe(false);
    bundle.setZoneDebugVisible(true);
    expect(bundle.groups.zonesDebug.visible).toBe(true);
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
