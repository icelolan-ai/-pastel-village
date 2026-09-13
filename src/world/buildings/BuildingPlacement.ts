import type { RoadGraph } from '../road/RoadGraph';
import { sampleEdgeCenterline } from '../road/RoadMeshBuilder';
import type { Zone } from '../villageData';
import { BUILDING_TYPES, footprintHalfDiagonal, type BuildingTypeId } from './buildingTypes';
import { createSeededRandom } from './seededRandom';

export interface BuildingPlacement {
  typeId: BuildingTypeId;
  position: [x: number, z: number];
  rotationY: number; // radians
}

/**
 * Extra clearance beyond the Build Spec's literal minimum
 * (halfDiagonal + road-half-width) — a safety margin against the fact that
 * `sampleEdgeCenterline` gives a *sampled* curve, not an exact closed form,
 * so a small buffer protects against sampling-resolution edge cases.
 */
const ROAD_CLEARANCE_SAFETY_MARGIN = 0.5;
/** Extra gap beyond two buildings' half-diagonals just touching. */
const BUILDING_MIN_SPACING = 1.0;
const MAX_ATTEMPTS_PER_BUILDING = 300;

/** Standard ray-casting point-in-polygon test. */
export function isPointInPolygon(x: number, z: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    const crosses = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function polygonBounds(polygon: [number, number][]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of polygon) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { minX, maxX, minZ, maxZ };
}

function distanceToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const abx = bx - ax;
  const abz = bz - az;
  const lengthSq = abx * abx + abz * abz;
  let t = lengthSq > 1e-9 ? ((px - ax) * abx + (pz - az) * abz) / lengthSq : 0;
  t = Math.max(0, Math.min(1, t));
  const projX = ax + t * abx;
  const projZ = az + t * abz;
  return Math.hypot(px - projX, pz - projZ);
}

/**
 * Distance from (x, z) to the nearest road's *surface* (already subtracting
 * that road's half-width) — sampled from the same smooth curve
 * RoadMeshBuilder actually renders, not an approximated straight polyline,
 * so this matches what's really on screen.
 */
export function clearanceToNearestRoad(x: number, z: number, roadGraph: RoadGraph): number {
  let minClearance = Infinity;
  for (const edge of roadGraph.getAllEdges()) {
    const centerline = sampleEdgeCenterline(roadGraph, edge);
    for (let i = 0; i < centerline.length - 1; i++) {
      const a = centerline[i];
      const b = centerline[i + 1];
      const distance = distanceToSegment(x, z, a.x, a.z, b.x, b.z) - edge.width / 2;
      if (distance < minClearance) minClearance = distance;
    }
  }
  return minClearance;
}

/**
 * Places up to `targetCount` buildings inside `zone` using rejection
 * sampling: repeatedly try a random point (from the seeded RNG) and accept
 * it only if it's inside the zone polygon, far enough from every road, and
 * far enough from every other building placed so far (including ones
 * passed in via `existingPlacements`, so multiple zones can share one
 * global spacing check). If a slot can't find a valid spot within the
 * attempt budget, it's simply skipped — AC #4/#5 need "no overlaps" and
 * "deterministic", not "exactly N no matter what".
 */
export function placeBuildingsInZone(
  zone: Zone,
  roadGraph: RoadGraph,
  seed: number,
  typeIds: BuildingTypeId[],
  targetCount: number,
  existingPlacements: BuildingPlacement[] = [],
): BuildingPlacement[] {
  const random = createSeededRandom(seed);
  const bounds = polygonBounds(zone.polygon);
  const newPlacements: BuildingPlacement[] = [];
  const allPlacements = [...existingPlacements];

  for (let i = 0; i < targetCount; i++) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_BUILDING; attempt++) {
      const typeId = typeIds[Math.floor(random() * typeIds.length)];
      const type = BUILDING_TYPES[typeId];
      const halfDiagonal = footprintHalfDiagonal(type);

      const x = bounds.minX + random() * (bounds.maxX - bounds.minX);
      const z = bounds.minZ + random() * (bounds.maxZ - bounds.minZ);

      if (!isPointInPolygon(x, z, zone.polygon)) continue;

      const roadClearance = clearanceToNearestRoad(x, z, roadGraph);
      if (roadClearance < halfDiagonal + ROAD_CLEARANCE_SAFETY_MARGIN) continue;

      const overlapsOther = allPlacements.some((other) => {
        const otherHalfDiagonal = footprintHalfDiagonal(BUILDING_TYPES[other.typeId]);
        const requiredSeparation = halfDiagonal + otherHalfDiagonal + BUILDING_MIN_SPACING;
        const dist = Math.hypot(x - other.position[0], z - other.position[1]);
        return dist < requiredSeparation;
      });
      if (overlapsOther) continue;

      const rotationY = random() * Math.PI * 2;
      const placement: BuildingPlacement = { typeId, position: [x, z], rotationY };
      newPlacements.push(placement);
      allPlacements.push(placement);
      break; // this slot is filled, move to the next one
    }
  }

  return newPlacements;
}

/** Which zones get buildings, which types, and how many — per Phase 3b scope (6-12 total). */
const ZONE_BUILDING_CONFIG: Record<string, { typeIds: BuildingTypeId[]; count: number }> = {
  'zone-residential-a': { typeIds: ['small-house', 'large-house'], count: 3 },
  'zone-residential-b': { typeIds: ['small-house', 'large-house'], count: 3 },
  'zone-shop': { typeIds: ['shop'], count: 3 },
};

/** Orchestrates placement across every configured zone with one base seed (WorldBundle's single entry point). */
export function placeAllBuildings(zones: Zone[], roadGraph: RoadGraph, baseSeed: number): BuildingPlacement[] {
  const all: BuildingPlacement[] = [];
  let seedOffset = 0;
  for (const zone of zones) {
    const config = ZONE_BUILDING_CONFIG[zone.id];
    if (!config) continue;
    const placements = placeBuildingsInZone(zone, roadGraph, baseSeed + seedOffset, config.typeIds, config.count, all);
    all.push(...placements);
    seedOffset += 1000; // keep each zone's RNG stream distinct even sharing one base seed
  }
  return all;
}
