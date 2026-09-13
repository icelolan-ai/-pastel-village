import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { RoadGraph } from './RoadGraph';
import { buildRoadMeshes } from './RoadMeshBuilder';
import type { RoadEdge, RoadNode } from '../villageData';

const nodes: RoadNode[] = [
  { id: 'a', position: [0, 0] },
  { id: 'b', position: [10, 0] },
  { id: 'c', position: [10, 10] },
  { id: 'd', position: [20, 0] },
];

// Node 'b' has 3 edges meeting it (junction); 'a', 'c', 'd' each have only 1 (dead ends).
const edges: RoadEdge[] = [
  { id: 'ab', fromNodeId: 'a', toNodeId: 'b', width: 4 },
  { id: 'bc', fromNodeId: 'b', toNodeId: 'c', width: 4 },
  { id: 'bd', fromNodeId: 'b', toNodeId: 'd', width: 6 },
];

describe('buildRoadMeshes (Phase 3a)', () => {
  it('creates exactly one mesh per road edge, named by edge id', () => {
    const graph = new RoadGraph(nodes, edges);
    const group = buildRoadMeshes(graph);
    for (const edge of edges) {
      expect(group.getObjectByName(`road-mesh-${edge.id}`), `mesh for edge "${edge.id}"`).toBeDefined();
    }
  });

  it('AC #7a: each edge mesh geometry covers both of its endpoint node positions', () => {
    const graph = new RoadGraph(nodes, edges);
    const group = buildRoadMeshes(graph);

    for (const edge of edges) {
      const mesh = group.getObjectByName(`road-mesh-${edge.id}`) as THREE.Mesh;
      mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox!;
      const from = graph.getNode(edge.fromNodeId)!;
      const to = graph.getNode(edge.toNodeId)!;
      // The centerline passes exactly through both nodes; the ribbon extends
      // halfWidth further out perpendicular to travel — so a margin of
      // halfWidth (plus a little float slack) is the tight, correct bound.
      const margin = edge.width / 2 + 0.1;

      for (const [x, z] of [from.position, to.position]) {
        expect(x).toBeGreaterThanOrEqual(box.min.x - margin);
        expect(x).toBeLessThanOrEqual(box.max.x + margin);
        expect(z).toBeGreaterThanOrEqual(box.min.z - margin);
        expect(z).toBeLessThanOrEqual(box.max.z + margin);
      }
    }
  });

  it('the ribbon is actually `width` wide (not just long) at its start', () => {
    const graph = new RoadGraph(nodes, edges);
    const group = buildRoadMeshes(graph);
    const mesh = group.getObjectByName('road-mesh-ab') as THREE.Mesh;
    const position = mesh.geometry.getAttribute('position');

    const left = new THREE.Vector3(position.getX(0), position.getY(0), position.getZ(0));
    const right = new THREE.Vector3(position.getX(1), position.getY(1), position.getZ(1));
    expect(left.distanceTo(right)).toBeCloseTo(4, 1); // edge "ab" width = 4
  });

  it('AC #7b: creates a junction pad where 2+ edges meet, radius from the widest connected edge', () => {
    const graph = new RoadGraph(nodes, edges);
    const group = buildRoadMeshes(graph);

    // node 'b': edges ab(4), bc(4), bd(6) meet -> radius = max(4,4,6)/2 = 3
    const junction = group.getObjectByName('road-junction-b') as THREE.Mesh;
    expect(junction).toBeDefined();
    junction.geometry.computeBoundingBox();
    const box = junction.geometry.boundingBox!;
    const radius = (box.max.x - box.min.x) / 2;
    expect(radius).toBeCloseTo(3, 1);
  });

  it('does NOT create a junction pad at a dead-end node (only 1 edge)', () => {
    const graph = new RoadGraph(nodes, edges);
    const group = buildRoadMeshes(graph);
    expect(group.getObjectByName('road-junction-a')).toBeUndefined();
    expect(group.getObjectByName('road-junction-c')).toBeUndefined();
    expect(group.getObjectByName('road-junction-d')).toBeUndefined();
  });
});
