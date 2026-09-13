import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { RoadGraph } from './RoadGraph';
import { JUNCTION_PAD_MARGIN, sampleEdgeCenterline } from './RoadMeshBuilder';
import { ROAD_EDGES, ROAD_NODES, type RoadEdge } from '../villageData';

/**
 * CORRECTION investigation (Z-fighting fix): Chat A asked us to check
 * whether two road ribbons meeting at the same junction overlap each other
 * *beyond* the junction pad's radius (the pad is expected/designed to cover
 * overlap right at the node — that's its job). This test answers that with
 * real geometry against the actual village data, rather than guessing.
 *
 * Method: for every pair of edges sharing a junction node, walk every
 * boundary sample point of ribbon A's *outer* zone (beyond the pad radius,
 * measured from the shared node) and check whether it falls inside ribbon
 * B's footprint (perpendicular distance to B's centerline ≤ B's half-width,
 * and not past B's own ends) — and vice versa.
 */

interface PolylineProjection {
  distance: number;
  arcLength: number;
}

function projectOntoPolyline(x: number, z: number, polyline: THREE.Vector3[]): PolylineProjection {
  let best: PolylineProjection = { distance: Infinity, arcLength: 0 };
  let cumulativeLength = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const segX = b.x - a.x;
    const segZ = b.z - a.z;
    const segLenSq = segX * segX + segZ * segZ;
    const segLen = Math.sqrt(segLenSq);

    let t = segLenSq > 1e-12 ? ((x - a.x) * segX + (z - a.z) * segZ) / segLenSq : 0;
    t = Math.max(0, Math.min(1, t));

    const projX = a.x + t * segX;
    const projZ = a.z + t * segZ;
    const distance = Math.hypot(x - projX, z - projZ);
    const arcLength = cumulativeLength + t * segLen;

    if (distance < best.distance) best = { distance, arcLength };
    cumulativeLength += segLen;
  }
  return best;
}

function polylineLength(polyline: THREE.Vector3[]): number {
  let length = 0;
  for (let i = 0; i < polyline.length - 1; i++) length += polyline[i].distanceTo(polyline[i + 1]);
  return length;
}

function isInsideRibbon(x: number, z: number, centerline: THREE.Vector3[], halfWidth: number): boolean {
  const { distance, arcLength } = projectOntoPolyline(x, z, centerline);
  const totalLength = polylineLength(centerline);
  const endMargin = 0.05; // the very tips legitimately sit inside the junction pad — not a violation
  return distance <= halfWidth && arcLength > endMargin && arcLength < totalLength - endMargin;
}

describe('Road ribbon overlap near junctions — real village data (Correction investigation)', () => {
  const graph = new RoadGraph(ROAD_NODES, ROAD_EDGES);

  const edgesByNode = new Map<string, RoadEdge[]>();
  for (const edge of ROAD_EDGES) {
    for (const nodeId of [edge.fromNodeId, edge.toNodeId]) {
      if (!edgesByNode.has(nodeId)) edgesByNode.set(nodeId, []);
      edgesByNode.get(nodeId)!.push(edge);
    }
  }

  for (const [nodeId, edges] of edgesByNode) {
    if (edges.length < 2) continue; // not a junction — RoadMeshBuilder skips these too

    const maxWidth = Math.max(...edges.map((e) => e.width));
    const padRadius = maxWidth / 2 + JUNCTION_PAD_MARGIN;

    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        const edgeA = edges[i];
        const edgeB = edges[j];

        it(`node "${nodeId}" (pad r=${padRadius}): "${edgeA.id}" and "${edgeB.id}" don't overlap beyond the pad`, () => {
          const centerlineA = sampleEdgeCenterline(graph, edgeA);
          const centerlineB = sampleEdgeCenterline(graph, edgeB);
          const halfA = edgeA.width / 2;
          const halfB = edgeB.width / 2;
          const nodeEndA = edgeA.fromNodeId === nodeId ? centerlineA[0] : centerlineA[centerlineA.length - 1];
          const nodeEndB = edgeB.fromNodeId === nodeId ? centerlineB[0] : centerlineB[centerlineB.length - 1];

          const violations: string[] = [];

          const checkBoundary = (
            centerline: THREE.Vector3[],
            halfWidth: number,
            nodeEnd: THREE.Vector3,
            otherCenterline: THREE.Vector3[],
            otherHalfWidth: number,
            label: string,
          ) => {
            for (let k = 0; k < centerline.length; k++) {
              const point = centerline[k];
              const distFromSharedNode = point.distanceTo(nodeEnd);
              if (distFromSharedNode <= padRadius) continue; // inside the pad — that overlap is intentional/covered

              const prev = centerline[Math.max(0, k - 1)];
              const next = centerline[Math.min(centerline.length - 1, k + 1)];
              const tangent = new THREE.Vector3().subVectors(next, prev);
              tangent.y = 0;
              if (tangent.lengthSq() < 1e-8) continue;
              tangent.normalize();
              const perpendicular = new THREE.Vector3(-tangent.z, 0, tangent.x);

              for (const sign of [1, -1]) {
                const boundaryPoint = point.clone().addScaledVector(perpendicular, halfWidth * sign);
                if (isInsideRibbon(boundaryPoint.x, boundaryPoint.z, otherCenterline, otherHalfWidth)) {
                  violations.push(`${label} @ ${distFromSharedNode.toFixed(2)}u from node`);
                }
              }
            }
          };

          checkBoundary(centerlineA, halfA, nodeEndA, centerlineB, halfB, edgeA.id);
          checkBoundary(centerlineB, halfB, nodeEndB, centerlineA, halfA, edgeB.id);

          expect(violations, `ribbon overlap beyond junction pad: ${violations.join(', ')}`).toEqual([]);
        });
      }
    }
  }
});
