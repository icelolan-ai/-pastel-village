import * as THREE from 'three';
import type { BuildingTypeDef } from './buildingTypes';

const DOOR_COLOR = '#8a5a44';
const WINDOW_COLOR = '#bde0fe';

/**
 * Walls: an extruded rectangular footprint with bevel — per Build Spec
 * ("ผนัง/หลังคาใช้ ExtrudeGeometry แบบมี Bevel"), giving the vertical
 * corners a soft, rounded edge instead of a sharp primitive-box look.
 */
function buildWalls(type: BuildingTypeDef): THREE.Mesh {
  const halfW = type.width / 2;
  const halfD = type.depth / 2;

  const shape = new THREE.Shape();
  shape.moveTo(-halfW, -halfD);
  shape.lineTo(halfW, -halfD);
  shape.lineTo(halfW, halfD);
  shape.lineTo(-halfW, halfD);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: type.wallHeight,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 2,
    curveSegments: 1,
  });
  // The shape lives in local XY; extrusion runs along local Z. Standing it
  // up (-90° about X) turns that extrusion into world-vertical (Y), with
  // the footprint flat on the XZ ground plane.
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.MeshStandardMaterial({ color: type.wallColor, roughness: 0.85 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'walls';
  return mesh;
}

/**
 * Roof: 'pyramid' uses a 4-sided cone — the correct, simple primitive for a
 * tapering form (a plain ExtrudeGeometry can't taper to a point, since it
 * keeps a constant cross-section along the extrusion, so it's reserved for
 * the genuinely flat 'flat' roof case below, where it applies exactly as
 * specified). Both remain fully procedural — no external assets either way.
 */
function buildRoof(type: BuildingTypeDef): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({ color: type.roofColor, roughness: 0.8 });

  if (type.roofStyle === 'pyramid') {
    const baseRadius = (Math.max(type.width, type.depth) / 2) * 1.12; // slight eave overhang
    const geometry = new THREE.ConeGeometry(baseRadius, type.roofHeight, 4, 1);
    geometry.rotateY(Math.PI / 4); // align the 4 pyramid faces to the box's flat walls, not its corners
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = type.wallHeight + type.roofHeight / 2;
    mesh.castShadow = true;
    mesh.name = 'roof';
    return mesh;
  }

  // Flat roof: a genuinely flat slab — this one really is a simple
  // ExtrudeGeometry with bevel, exactly per spec.
  const halfW = (type.width / 2) * 1.08;
  const halfD = (type.depth / 2) * 1.08;
  const shape = new THREE.Shape();
  shape.moveTo(-halfW, -halfD);
  shape.lineTo(halfW, -halfD);
  shape.lineTo(halfW, halfD);
  shape.lineTo(-halfW, halfD);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: type.roofHeight,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 2,
    curveSegments: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = type.wallHeight;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'roof';
  return mesh;
}

/**
 * A flat colored plane pressed just outside a wall face — the cheap,
 * stylized-toy way to read as a door/window without needing boolean/CSG
 * cutouts into the wall geometry (no CSG library is available without
 * adding a new dependency, which Out-of-Scope rules for this phase forbid).
 */
function buildAccentPlane(
  width: number,
  height: number,
  color: string,
  wallHalfExtentAlongFacing: number,
  facing: 'north' | 'south' | 'east' | 'west',
  yCenter: number,
): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(width, height);
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.6, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);

  const epsilon = 0.03; // sit just proud of the wall face to avoid z-fighting
  switch (facing) {
    case 'south':
      mesh.position.set(0, yCenter, -wallHalfExtentAlongFacing - epsilon);
      mesh.rotation.y = Math.PI;
      break;
    case 'north':
      mesh.position.set(0, yCenter, wallHalfExtentAlongFacing + epsilon);
      break;
    case 'east':
      mesh.position.set(wallHalfExtentAlongFacing + epsilon, yCenter, 0);
      mesh.rotation.y = Math.PI / 2;
      break;
    case 'west':
      mesh.position.set(-wallHalfExtentAlongFacing - epsilon, yCenter, 0);
      mesh.rotation.y = -Math.PI / 2;
      break;
  }
  return mesh;
}

/**
 * Builds one building: walls + roof + 1 door + `windowCount` windows.
 * Everything is in "building-local" space — door always faces local
 * "south" by convention. This doesn't need to correspond to any world
 * direction: Placement applies its own random yaw per building, so the
 * whole thing just needs to be internally consistent, which it is.
 */
export function buildBuildingMesh(type: BuildingTypeDef): THREE.Group {
  const group = new THREE.Group();
  group.name = `building-${type.id}`;

  const walls = buildWalls(type);
  const roof = buildRoof(type);
  group.add(walls, roof);

  const door = buildAccentPlane(type.doorWidth, type.doorHeight, DOOR_COLOR, type.depth / 2, 'south', type.doorHeight / 2);
  door.name = 'door';
  group.add(door);

  const windowFacings: Array<'north' | 'east' | 'west'> = ['north', 'east', 'west'];
  for (let i = 0; i < type.windowCount; i++) {
    const facing = windowFacings[i % windowFacings.length];
    const halfExtent = facing === 'north' ? type.depth / 2 : type.width / 2;
    const windowMesh = buildAccentPlane(type.windowWidth, type.windowHeight, WINDOW_COLOR, halfExtent, facing, type.wallHeight * 0.55);
    windowMesh.name = `window-${i}`;
    group.add(windowMesh);
  }

  return group;
}
