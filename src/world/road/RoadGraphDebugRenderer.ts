import * as THREE from 'three';
import type { RoadGraph } from './RoadGraph';

const LINE_COLOR = 0x7a6a72; // muted mauve — visible against the pastel-green ground
const LINE_Y = 0.05; // lift slightly off the terrain to avoid z-fighting

/**
 * Phase 2 scope: roads are not real meshes yet, just thin debug lines so the
 * layout is checkable by eye. Curved edges (with controlPoints) are smoothed
 * through a Catmull-Rom spline; straight edges are a single segment.
 */
export function createRoadGraphDebugGroup(roadGraph: RoadGraph): THREE.Group {
  const group = new THREE.Group();
  group.name = 'RoadGraphDebug';

  const material = new THREE.LineBasicMaterial({ color: LINE_COLOR, linewidth: 2 });

  for (const edge of roadGraph.getAllEdges()) {
    const pathPoints = roadGraph.getEdgePathPoints(edge);
    const vector3Points = pathPoints.map(([x, z]) => new THREE.Vector3(x, LINE_Y, z));

    const curve = new THREE.CatmullRomCurve3(vector3Points, false, 'catmullrom', 0.2);
    const sampleCount = Math.max(8, vector3Points.length * 8);
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(sampleCount));

    const line = new THREE.Line(geometry, material);
    line.name = `road-${edge.id}`;
    group.add(line);
  }

  return group;
}
