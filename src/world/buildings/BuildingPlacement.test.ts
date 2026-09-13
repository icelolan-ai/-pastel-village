import { describe, expect, it } from 'vitest';
import { RoadGraph } from '../road/RoadGraph';
import { ROAD_EDGES, ROAD_NODES, ZONES, type Zone } from '../villageData';
import { BUILDING_TYPES, footprintHalfDiagonal } from './buildingTypes';
import {
  clearanceToNearestRoad,
  isPointInPolygon,
  placeAllBuildings,
  placeBuildingsInZone,
} from './BuildingPlacement';

const graph = new RoadGraph(ROAD_NODES, ROAD_EDGES);

function findZone(id: string): Zone {
  const zone = ZONES.find((z) => z.id === id);
  if (!zone) throw new Error(`test fixture problem: zone "${id}" not found`);
  return zone;
}

describe('isPointInPolygon', () => {
  it('correctly classifies inside/outside for a simple square', () => {
    const square: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    expect(isPointInPolygon(5, 5, square)).toBe(true);
    expect(isPointInPolygon(-1, 5, square)).toBe(false);
    expect(isPointInPolygon(15, 5, square)).toBe(false);
  });
});

describe('placeBuildingsInZone (using the real village data)', () => {
  const residentialA = findZone('zone-residential-a');

  it('AC #5: the same seed produces byte-identical placements every time', () => {
    const runA = placeBuildingsInZone(residentialA, graph, 42, ['small-house', 'large-house'], 3);
    const runB = placeBuildingsInZone(residentialA, graph, 42, ['small-house', 'large-house'], 3);
    expect(runB).toEqual(runA);
  });

  it('a different seed produces a different layout', () => {
    const runA = placeBuildingsInZone(residentialA, graph, 42, ['small-house', 'large-house'], 3);
    const runB = placeBuildingsInZone(residentialA, graph, 999, ['small-house', 'large-house'], 3);
    expect(runB).not.toEqual(runA);
  });

  it('AC #3: every placement is actually inside the zone polygon', () => {
    const placements = placeBuildingsInZone(residentialA, graph, 42, ['small-house', 'large-house'], 3);
    expect(placements.length).toBeGreaterThan(0); // sanity: the algorithm actually placed something
    for (const placement of placements) {
      const [x, z] = placement.position;
      expect(isPointInPolygon(x, z, residentialA.polygon), `placement at (${x}, ${z})`).toBe(true);
    }
  });

  it('AC #4: every placement respects road clearance (halfDiagonal + road half-width)', () => {
    const placements = placeBuildingsInZone(residentialA, graph, 42, ['small-house', 'large-house'], 3);
    for (const placement of placements) {
      const [x, z] = placement.position;
      const halfDiagonal = footprintHalfDiagonal(BUILDING_TYPES[placement.typeId]);
      const clearance = clearanceToNearestRoad(x, z, graph);
      expect(clearance, `placement at (${x}, ${z})`).toBeGreaterThanOrEqual(halfDiagonal);
    }
  });

  it('AC #4: no two placements in the same zone overlap each other', () => {
    const placements = placeBuildingsInZone(residentialA, graph, 42, ['small-house', 'large-house'], 3);
    for (let i = 0; i < placements.length; i++) {
      for (let j = i + 1; j < placements.length; j++) {
        const a = placements[i];
        const b = placements[j];
        const requiredSeparation =
          footprintHalfDiagonal(BUILDING_TYPES[a.typeId]) + footprintHalfDiagonal(BUILDING_TYPES[b.typeId]);
        const actualDistance = Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1]);
        expect(actualDistance).toBeGreaterThan(requiredSeparation);
      }
    }
  });
});

describe('placeAllBuildings (full village)', () => {
  it('AC #5: deterministic end-to-end across the whole village for a fixed seed', () => {
    const runA = placeAllBuildings(ZONES, graph, 1234);
    const runB = placeAllBuildings(ZONES, graph, 1234);
    expect(runB).toEqual(runA);
  });

  it('total building count is within the 6-12 target range', () => {
    const placements = placeAllBuildings(ZONES, graph, 1234);
    expect(placements.length).toBeGreaterThanOrEqual(6);
    expect(placements.length).toBeLessThanOrEqual(12);
  });

  it('AC #4: no two buildings overlap anywhere in the village, even across different zones', () => {
    const placements = placeAllBuildings(ZONES, graph, 1234);
    for (let i = 0; i < placements.length; i++) {
      for (let j = i + 1; j < placements.length; j++) {
        const a = placements[i];
        const b = placements[j];
        const requiredSeparation =
          footprintHalfDiagonal(BUILDING_TYPES[a.typeId]) + footprintHalfDiagonal(BUILDING_TYPES[b.typeId]);
        const actualDistance = Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1]);
        expect(actualDistance).toBeGreaterThan(requiredSeparation);
      }
    }
  });

  it('AC #4: no building anywhere in the village overlaps a road', () => {
    const placements = placeAllBuildings(ZONES, graph, 1234);
    for (const placement of placements) {
      const [x, z] = placement.position;
      const halfDiagonal = footprintHalfDiagonal(BUILDING_TYPES[placement.typeId]);
      const clearance = clearanceToNearestRoad(x, z, graph);
      expect(clearance).toBeGreaterThanOrEqual(halfDiagonal);
    }
  });

  it('AC #1: at least 3 distinct building types actually get placed somewhere in the village', () => {
    const placements = placeAllBuildings(ZONES, graph, 1234);
    const typesUsed = new Set(placements.map((p) => p.typeId));
    expect(typesUsed.size).toBeGreaterThanOrEqual(3);
  });
});
