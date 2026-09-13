/**
 * Hardcoded Phase 2 village layout data — the "skeleton" that Phase 3 will
 * hang real road/building/nature assets on. Deliberately irregular (Master
 * Blueprint Section 8: no rigid grid).
 *
 * Coordinates are on the XZ ground plane (Y is up), in the same world units
 * as everything else in the scene.
 */

export interface RoadNode {
  id: string;
  position: [x: number, z: number];
}

export interface RoadEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  /** Extra points the road curves through — omit for a straight segment. */
  controlPoints?: [x: number, z: number][];
  /** Meters. Unused for rendering yet — Phase 3 will use it for road mesh width. */
  width: number;
}

export type ZoneType = 'residential' | 'shop' | 'park' | 'village-center' | 'nature-buffer';

export interface Zone {
  id: string;
  type: ZoneType;
  /** Simple polygon (no self-intersection), points on the XZ ground plane. */
  polygon: [x: number, z: number][];
  /** Debug-overlay-only color — never shown in real gameplay rendering. */
  debugColor: string;
}

// --- Main loop road: an asymmetric hexagonal loop around the village center ---
export const ROAD_NODES: RoadNode[] = [
  { id: 'loop-1', position: [11, 5] },
  { id: 'loop-2', position: [15, -5] },
  { id: 'loop-3', position: [5, -13] },
  { id: 'loop-4', position: [-9, -11] },
  { id: 'loop-5', position: [-14, 4] },
  { id: 'loop-6', position: [-3, 13] },
  { id: 'shop-entrance', position: [24, -2] },
  { id: 'park-entrance', position: [-1, 22] },
  { id: 'residential-a-entrance', position: [-18, -20] },
  { id: 'residential-b-entrance', position: [-24, 9] },
];

export const ROAD_EDGES: RoadEdge[] = [
  // Main loop (curved, not straight hexagon edges) — 6 segments
  { id: 'loop-1-2', fromNodeId: 'loop-1', toNodeId: 'loop-2', width: 4, controlPoints: [[15, 2]] },
  { id: 'loop-2-3', fromNodeId: 'loop-2', toNodeId: 'loop-3', width: 4 },
  { id: 'loop-3-4', fromNodeId: 'loop-3', toNodeId: 'loop-4', width: 4, controlPoints: [[-2, -16]] },
  { id: 'loop-4-5', fromNodeId: 'loop-4', toNodeId: 'loop-5', width: 4 },
  { id: 'loop-5-6', fromNodeId: 'loop-5', toNodeId: 'loop-6', width: 4, controlPoints: [[-11, 10]] },
  { id: 'loop-6-1', fromNodeId: 'loop-6', toNodeId: 'loop-1', width: 4 },
  // Branches out to each zone entrance
  { id: 'branch-shop', fromNodeId: 'loop-2', toNodeId: 'shop-entrance', width: 3 },
  { id: 'branch-park', fromNodeId: 'loop-6', toNodeId: 'park-entrance', width: 3 },
  { id: 'branch-residential-a', fromNodeId: 'loop-4', toNodeId: 'residential-a-entrance', width: 3 },
  { id: 'branch-residential-b', fromNodeId: 'loop-5', toNodeId: 'residential-b-entrance', width: 3 },
];

// --- Zones ---
const VILLAGE_CENTER_POLYGON: [number, number][] = ROAD_NODES.slice(0, 6).map(
  (n) => [n.position[0] * 0.45, n.position[1] * 0.45] as [number, number],
);

export const ZONES: Zone[] = [
  { id: 'zone-village-center', type: 'village-center', polygon: VILLAGE_CENTER_POLYGON, debugColor: '#fff3b0' },
  {
    id: 'zone-shop',
    type: 'shop',
    polygon: [
      [19, -8],
      [29, -8],
      [29, 6],
      [19, 6],
    ],
    debugColor: '#ffd6a5',
  },
  {
    id: 'zone-park',
    type: 'park',
    polygon: [
      [-9, 17],
      [7, 17],
      [7, 27],
      [-9, 27],
    ],
    debugColor: '#caffbf',
  },
  {
    id: 'zone-residential-a',
    type: 'residential',
    polygon: [
      [-25, -27],
      [-11, -27],
      [-11, -14],
      [-25, -14],
    ],
    debugColor: '#ffc6ff',
  },
  {
    id: 'zone-residential-b',
    type: 'residential',
    polygon: [
      [-31, 2],
      [-17, 2],
      [-17, 16],
      [-31, 16],
    ],
    debugColor: '#a0c4ff',
  },
  // Nature-buffer: an outer ring, split into gap segments so it never
  // self-intersects and roughly frames the named zones from outside.
  ...createNatureBufferRing(24, 33, [
    [30, 60],
    [110, 140],
    [185, 210],
    [258, 292],
    [300, 340],
  ]),
];

/** Builds simple trapezoid "ring segment" zones between two radii, for a set of angle ranges (degrees). */
function createNatureBufferRing(
  innerRadius: number,
  outerRadius: number,
  angleRangesDeg: [number, number][],
): Zone[] {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  return angleRangesDeg.map(([startDeg, endDeg], i) => {
    const a1 = toRad(startDeg);
    const a2 = toRad(endDeg);
    const polygon: [number, number][] = [
      [innerRadius * Math.cos(a1), innerRadius * Math.sin(a1)],
      [outerRadius * Math.cos(a1), outerRadius * Math.sin(a1)],
      [outerRadius * Math.cos(a2), outerRadius * Math.sin(a2)],
      [innerRadius * Math.cos(a2), innerRadius * Math.sin(a2)],
    ];
    return {
      id: `zone-nature-buffer-${i}`,
      type: 'nature-buffer' as const,
      polygon,
      debugColor: '#d0f4de',
    };
  });
}

export interface VillageBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Scans every road node, road edge control point, and zone polygon point to
 * find the bounding box the terrain must cover. Terrain sizing is derived
 * from this (see SceneSetup.createTerrain) so it automatically stays correct
 * if this data file changes — nothing about terrain size is hand-tuned to
 * match these specific coordinates.
 */
export function computeVillageBounds(): VillageBounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  const consider = (x: number, z: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  };

  for (const node of ROAD_NODES) consider(node.position[0], node.position[1]);
  for (const edge of ROAD_EDGES) {
    if (!edge.controlPoints) continue;
    for (const [x, z] of edge.controlPoints) consider(x, z);
  }
  for (const zone of ZONES) {
    for (const [x, z] of zone.polygon) consider(x, z);
  }

  return { minX, maxX, minZ, maxZ };
}
