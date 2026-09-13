import * as THREE from 'three';
import type { RoadGraph } from './RoadGraph';
import type { RoadEdge } from '../villageData';

const ROAD_Y = 0.02; // just above Terrain (y=0), below the Zone-debug fill (0.03) and Road-debug lines (0.05)
const JUNCTION_Y = 0.021; // a hair above the ribbon ends so junction pads always win z-fighting at seams
const ROAD_COLOR = '#c9beae'; // pastel tan-gray
/**
 * CORRECTION (Z-fighting fix): a curved edge's `controlPoints` can bend its
 * departure direction at a node sharply enough that its ribbon still
 * overlaps a neighboring edge's ribbon just past the "half of widest edge"
 * radius (confirmed geometrically for node "loop-2" — see
 * RoadJunctionOverlap.test.ts). This margin is added on top of that radius
 * so the pad reliably covers the overlap instead of relying on
 * polygonOffset to hide two same-material, same-Y meshes fighting.
 */
export const JUNCTION_PAD_MARGIN = 0.4;

/**
 * Samples the same centerline `RoadGraphDebugRenderer` draws (a Catmull-Rom
 * spline through [fromNode, ...controlPoints, toNode]) so the real mesh and
 * the debug line are guaranteed to trace the same path (Phase 3a AC #2).
 */
export function sampleEdgeCenterline(graph: RoadGraph, edge: RoadEdge): THREE.Vector3[] {
  const pathPoints = graph.getEdgePathPoints(edge).map(([x, z]) => new THREE.Vector3(x, ROAD_Y, z));
  const curve = new THREE.CatmullRomCurve3(pathPoints, false, 'catmullrom', 0.2);
  const sampleCount = Math.max(12, pathPoints.length * 10);
  return curve.getPoints(sampleCount);
}

/** Extrudes a flat ribbon of the given width along a centerline, on the XZ plane. */
function buildRibbonGeometry(centerline: THREE.Vector3[], width: number): THREE.BufferGeometry {
  const halfWidth = width / 2;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < centerline.length; i++) {
    const point = centerline[i];
    const prev = centerline[Math.max(0, i - 1)];
    const next = centerline[Math.min(centerline.length - 1, i + 1)];

    const tangent = new THREE.Vector3().subVectors(next, prev);
    tangent.y = 0;
    if (tangent.lengthSq() < 1e-8) tangent.set(1, 0, 0); // degenerate fallback (shouldn't happen with real data)
    tangent.normalize();

    const perpendicular = new THREE.Vector3(-tangent.z, 0, tangent.x); // rotate 90° in the XZ plane

    const left = point.clone().addScaledVector(perpendicular, halfWidth);
    const right = point.clone().addScaledVector(perpendicular, -halfWidth);
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
  }

  for (let i = 0; i < centerline.length - 1; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = (i + 1) * 2;
    const d = (i + 1) * 2 + 1;
    indices.push(a, c, b, b, c, d);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Builds one Group containing one ribbon Mesh per road edge plus one circular
 * "junction pad" Mesh at every node where 2+ edges meet (radius = half the
 * widest connected edge), to hide the seam where ribbons come together.
 */
export function buildRoadMeshes(graph: RoadGraph): THREE.Group {
  const group = new THREE.Group();
  group.name = 'RoadMeshes';

  const roadMaterial = new THREE.MeshStandardMaterial({
    color: ROAD_COLOR,
    roughness: 0.95,
    metalness: 0,
    side: THREE.DoubleSide, // safety net against ribbon winding, matches Terrain's approach
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });

  for (const edge of graph.getAllEdges()) {
    const centerline = sampleEdgeCenterline(graph, edge);
    const geometry = buildRibbonGeometry(centerline, edge.width);
    const mesh = new THREE.Mesh(geometry, roadMaterial);
    mesh.receiveShadow = true;
    mesh.name = `road-mesh-${edge.id}`;
    mesh.userData.edgeId = edge.id;
    group.add(mesh);
  }

  // Group edges by the nodes they touch, so we know which nodes are junctions (2+ edges).
  const edgesByNode = new Map<string, RoadEdge[]>();
  for (const edge of graph.getAllEdges()) {
    for (const nodeId of [edge.fromNodeId, edge.toNodeId]) {
      if (!edgesByNode.has(nodeId)) edgesByNode.set(nodeId, []);
      edgesByNode.get(nodeId)!.push(edge);
    }
  }

  const junctionMaterial = new THREE.MeshStandardMaterial({
    color: ROAD_COLOR,
    roughness: 0.95,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });

  for (const [nodeId, connectedEdges] of edgesByNode) {
    if (connectedEdges.length < 2) continue; // dead ends don't need a pad
    const node = graph.getNode(nodeId);
    if (!node) continue;

    const maxWidth = Math.max(...connectedEdges.map((e) => e.width));
    const radius = maxWidth / 2 + JUNCTION_PAD_MARGIN;
    const geometry = new THREE.CircleGeometry(radius, 24);
    // CircleGeometry is radially symmetric, so the rotation direction (+/-90°)
    // doesn't affect its shape the way it would for an asymmetric polygon.
    geometry.rotateX(-Math.PI / 2);

    const mesh = new THREE.Mesh(geometry, junctionMaterial);
    mesh.position.set(node.position[0], JUNCTION_Y, node.position[1]);
    mesh.receiveShadow = true;
    mesh.name = `road-junction-${nodeId}`;
    mesh.userData.nodeId = nodeId;
    group.add(mesh);
  }

  return group;
}
