import { describe, expect, it } from 'vitest';
import { ROAD_EDGES, ROAD_NODES, ZONES, computeVillageBounds } from './villageData';

describe('villageData', () => {
  it('every road edge references nodes that actually exist', () => {
    const nodeIds = new Set(ROAD_NODES.map((n) => n.id));
    for (const edge of ROAD_EDGES) {
      expect(nodeIds.has(edge.fromNodeId), `edge "${edge.id}" fromNodeId`).toBe(true);
      expect(nodeIds.has(edge.toNodeId), `edge "${edge.id}" toNodeId`).toBe(true);
    }
  });

  it('has no duplicate node or edge ids', () => {
    expect(new Set(ROAD_NODES.map((n) => n.id)).size).toBe(ROAD_NODES.length);
    expect(new Set(ROAD_EDGES.map((e) => e.id)).size).toBe(ROAD_EDGES.length);
  });

  it('every zone has a non-degenerate polygon (3+ points)', () => {
    for (const zone of ZONES) {
      expect(zone.polygon.length, `zone "${zone.id}"`).toBeGreaterThanOrEqual(3);
    }
  });

  it('includes at least one zone of each required type', () => {
    const types = new Set(ZONES.map((z) => z.type));
    expect(types.has('residential')).toBe(true);
    expect(types.has('shop')).toBe(true);
    expect(types.has('park')).toBe(true);
    expect(types.has('village-center')).toBe(true);
    expect(types.has('nature-buffer')).toBe(true);
  });

  it('computeVillageBounds returns a valid, finite, non-empty box', () => {
    const bounds = computeVillageBounds();
    expect(Number.isFinite(bounds.minX)).toBe(true);
    expect(Number.isFinite(bounds.maxX)).toBe(true);
    expect(Number.isFinite(bounds.minZ)).toBe(true);
    expect(Number.isFinite(bounds.maxZ)).toBe(true);
    expect(bounds.maxX).toBeGreaterThan(bounds.minX);
    expect(bounds.maxZ).toBeGreaterThan(bounds.minZ);
  });

  it('computeVillageBounds actually encloses every road node', () => {
    const bounds = computeVillageBounds();
    for (const node of ROAD_NODES) {
      const [x, z] = node.position;
      expect(x).toBeGreaterThanOrEqual(bounds.minX);
      expect(x).toBeLessThanOrEqual(bounds.maxX);
      expect(z).toBeGreaterThanOrEqual(bounds.minZ);
      expect(z).toBeLessThanOrEqual(bounds.maxZ);
    }
  });
});
