import { ROAD_EDGES, ROAD_NODES, type RoadEdge, type RoadNode } from '../villageData';

/**
 * Thin query layer over the hardcoded road data. Phase 3+ (real road
 * meshes) and later Phase 5+ (NPC navigation waypoints) both read through
 * this instead of touching villageData arrays directly.
 */
export class RoadGraph {
  private readonly nodesById = new Map<string, RoadNode>();
  private readonly edges: RoadEdge[];

  constructor(nodes: RoadNode[] = ROAD_NODES, edges: RoadEdge[] = ROAD_EDGES) {
    for (const node of nodes) this.nodesById.set(node.id, node);
    this.edges = edges;
  }

  public getNode(id: string): RoadNode | undefined {
    return this.nodesById.get(id);
  }

  public getAllNodes(): RoadNode[] {
    return Array.from(this.nodesById.values());
  }

  public getAllEdges(): RoadEdge[] {
    return this.edges;
  }

  /**
   * Returns the ordered [x, z] points describing an edge's path, including
   * its endpoints — a straight 2-point line if there are no control points,
   * or the full through-points otherwise (the debug renderer smooths this
   * into a curve; Phase 3's road mesh generator will do its own sampling).
   */
  public getEdgePathPoints(edge: RoadEdge): [number, number][] {
    const from = this.getNode(edge.fromNodeId);
    const to = this.getNode(edge.toNodeId);
    if (!from || !to) {
      const missingId = !from ? edge.fromNodeId : edge.toNodeId;
      throw new Error(`[RoadGraph] Edge "${edge.id}" references a missing node: "${missingId}".`);
    }
    return [from.position, ...(edge.controlPoints ?? []), to.position];
  }
}
