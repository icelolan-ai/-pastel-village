import { describe, expect, it } from 'vitest';
import { createTerrain } from './SceneSetup';
import { computeVillageBounds } from '../world/villageData';

describe('createTerrain', () => {
  it('the generated extents fully cover the requested bounds (Phase 2 AC #4)', () => {
    const bounds = { minX: -20, maxX: 20, minZ: -15, maxZ: 15 };
    const { extents } = createTerrain(bounds);

    expect(extents.minX).toBeLessThanOrEqual(bounds.minX);
    expect(extents.maxX).toBeGreaterThanOrEqual(bounds.maxX);
    expect(extents.minZ).toBeLessThanOrEqual(bounds.minZ);
    expect(extents.maxZ).toBeGreaterThanOrEqual(bounds.maxZ);
  });

  it('covers the real village bounds computed from villageData.ts', () => {
    const bounds = computeVillageBounds();
    const { extents } = createTerrain(bounds);

    expect(extents.minX).toBeLessThanOrEqual(bounds.minX);
    expect(extents.maxX).toBeGreaterThanOrEqual(bounds.maxX);
    expect(extents.minZ).toBeLessThanOrEqual(bounds.minZ);
    expect(extents.maxZ).toBeGreaterThanOrEqual(bounds.maxZ);
  });

  it('produces a non-empty, indexed geometry (a real mesh, not a degenerate shape)', () => {
    const { mesh } = createTerrain({ minX: -10, maxX: 10, minZ: -10, maxZ: 10 });
    const position = mesh.geometry.getAttribute('position');
    expect(position.count).toBeGreaterThan(0);
    expect(mesh.geometry.getIndex()?.count).toBeGreaterThan(0);
  });

  it('is not a perfect circle (organic perturbation actually varies the radius)', () => {
    const { extents } = createTerrain({ minX: -10, maxX: 10, minZ: -10, maxZ: 10 });
    const width = extents.maxX - extents.minX;
    const depth = extents.maxZ - extents.minZ;
    // A perfect circle would make these numerically ~equal; the organic
    // wobble plus an asymmetric input box should make them visibly differ.
    expect(Math.abs(width - depth)).toBeGreaterThan(0.01);
  });
});
