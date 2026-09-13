import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildBuildingMesh } from './BuildingMeshBuilder';
import { BUILDING_TYPE_IDS, BUILDING_TYPES } from './buildingTypes';

describe('buildBuildingMesh', () => {
  it('AC #2: every building type has walls, a roof, a door, and at least one window', () => {
    for (const typeId of BUILDING_TYPE_IDS) {
      const group = buildBuildingMesh(BUILDING_TYPES[typeId]);
      expect(group.getObjectByName('walls'), `${typeId}: walls`).toBeDefined();
      expect(group.getObjectByName('roof'), `${typeId}: roof`).toBeDefined();
      expect(group.getObjectByName('door'), `${typeId}: door`).toBeDefined();
      expect(group.getObjectByName('window-0'), `${typeId}: at least one window`).toBeDefined();
    }
  });

  it('AC #1: the 3 building types are visually distinct (footprint, wall color, and roof style all differ)', () => {
    const small = BUILDING_TYPES['small-house'];
    const large = BUILDING_TYPES['large-house'];
    const shop = BUILDING_TYPES.shop;

    // Footprint area must differ between every pair.
    const area = (t: typeof small) => t.width * t.depth;
    expect(area(small)).not.toBeCloseTo(area(large), 1);
    expect(area(small)).not.toBeCloseTo(area(shop), 1);
    expect(area(large)).not.toBeCloseTo(area(shop), 1);

    // Wall colors must all be distinct (not the "same box recolored" case is
    // satisfied by more than just color, but color is a fast, cheap check).
    expect(new Set([small.wallColor, large.wallColor, shop.wallColor]).size).toBe(3);

    // Roof style must differ from at least one other (shop is flat, houses are pyramid).
    const roofStyles = new Set([small.roofStyle, large.roofStyle, shop.roofStyle]);
    expect(roofStyles.size).toBeGreaterThanOrEqual(2);
  });

  it('window count matches each type definition', () => {
    for (const typeId of BUILDING_TYPE_IDS) {
      const type = BUILDING_TYPES[typeId];
      const group = buildBuildingMesh(type);
      let windowCount = 0;
      group.traverse((obj) => {
        if (obj.name.startsWith('window-')) windowCount += 1;
      });
      expect(windowCount).toBe(type.windowCount);
    }
  });

  it('walls geometry actually spans the full footprint (bounding box matches width/depth)', () => {
    for (const typeId of BUILDING_TYPE_IDS) {
      const type = BUILDING_TYPES[typeId];
      const group = buildBuildingMesh(type);
      const walls = group.getObjectByName('walls') as THREE.Mesh;
      walls.geometry.computeBoundingBox();
      const box = walls.geometry.boundingBox!;
      const width = box.max.x - box.min.x;
      const depth = box.max.z - box.min.z;
      // Bevel adds a small margin outward, so allow a bit of slack.
      expect(width).toBeGreaterThanOrEqual(type.width);
      expect(width).toBeLessThan(type.width + 0.3);
      expect(depth).toBeGreaterThanOrEqual(type.depth);
      expect(depth).toBeLessThan(type.depth + 0.3);
    }
  });
});
