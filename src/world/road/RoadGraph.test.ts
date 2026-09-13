import { describe, expect, it } from 'vitest';
import { RoadGraph } from './RoadGraph';
import type { RoadEdge, RoadNode } from '../villageData';

const nodes: RoadNode[] = [
  { id: 'a', position: [0, 0] },
  { id: 'b', position: [10, 0] },
  { id: 'c', position: [10, 10] },
];

const edges: RoadEdge[] = [
  { id: 'ab', fromNodeId: 'a', toNodeId: 'b', width: 4 },
  { id: 'bc', fromNodeId: 'b', toNodeId: 'c', width: 4, controlPoints: [[12, 5]] },
];

describe('RoadGraph', () => {
  it('looks up nodes by id', () => {
    const graph = new RoadGraph(nodes, edges);
    expect(graph.getNode('a')?.position).toEqual([0, 0]);
    expect(graph.getNode('does-not-exist')).toBeUndefined();
  });

  it('returns a straight 2-point path for an edge with no control points', () => {
    const graph = new RoadGraph(nodes, edges);
    const path = graph.getEdgePathPoints(edges[0]);
    expect(path).toEqual([
      [0, 0],
      [10, 0],
    ]);
  });

  it('includes control points in the middle of the path, in order', () => {
    const graph = new RoadGraph(nodes, edges);
    const path = graph.getEdgePathPoints(edges[1]);
    expect(path).toEqual([
      [10, 0],
      [12, 5],
      [10, 10],
    ]);
  });

  it('throws a clear error for an edge referencing a missing node', () => {
    const graph = new RoadGraph(nodes, edges);
    const badEdge: RoadEdge = { id: 'broken', fromNodeId: 'a', toNodeId: 'ghost', width: 4 };
    expect(() => graph.getEdgePathPoints(badEdge)).toThrow(/ghost|missing node/i);
  });

  it('getAllNodes / getAllEdges reflect what was passed in', () => {
    const graph = new RoadGraph(nodes, edges);
    expect(graph.getAllNodes()).toHaveLength(3);
    expect(graph.getAllEdges()).toHaveLength(2);
  });
});
