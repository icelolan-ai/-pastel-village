import * as THREE from 'three';
import type { Zone } from './villageData';

const FILL_Y = 0.03; // just above the terrain, below road debug lines
const FILL_OPACITY = 0.38;

/**
 * Renders each Zone's polygon as a flat colored patch on the ground.
 * Debug-only, per Master Blueprint Section 8/31 note on Zone.debugColor —
 * this is never meant to be the final gameplay look.
 */
export function createZoneDebugGroup(zones: Zone[]): THREE.Group {
  const group = new THREE.Group();
  group.name = 'ZoneDebug';

  for (const zone of zones) {
    const shape = new THREE.Shape(zone.polygon.map(([x, z]) => new THREE.Vector2(x, z)));
    const geometry = new THREE.ShapeGeometry(shape);
    const material = new THREE.MeshBasicMaterial({
      color: zone.debugColor,
      transparent: true,
      opacity: FILL_OPACITY,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    // ShapeGeometry is built in the local XY plane. Rotating +90° about X maps
    // local Y -> world Z directly (unflipped), so the polygon's [x, z] data
    // lines up with world space the same way RoadGraph's [x, z] points do.
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = FILL_Y;
    mesh.name = `zone-${zone.id}`;
    mesh.userData.zoneType = zone.type;
    group.add(mesh);
  }

  return group;
}
