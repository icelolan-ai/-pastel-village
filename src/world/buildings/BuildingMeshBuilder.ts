import * as THREE from 'three';
import type { BuildingTypeDef } from './buildingTypes';
import { createSeededRandom } from './seededRandom';

const DOOR_COLOR = '#8a5a44';
const WINDOW_PANE_COLOR = '#bde0fe';
const WINDOW_FRAME_COLOR = '#5f7d95'; // darker than the pane — reads as mullions between panes

/** CORRECTION (Clay style): rounded-rectangle footprint via 4 arced corners instead of sharp lineTo corners. */
function createRoundedRectShape(width: number, depth: number, cornerRadius: number): THREE.Shape {
  const halfW = width / 2;
  const halfD = depth / 2;
  const r = Math.min(cornerRadius, halfW, halfD); // never let the radius exceed the shape itself

  const shape = new THREE.Shape();
  shape.moveTo(-halfW + r, -halfD);
  shape.lineTo(halfW - r, -halfD);
  shape.absarc(halfW - r, -halfD + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(halfW, halfD - r);
  shape.absarc(halfW - r, halfD - r, r, 0, Math.PI / 2, false);
  shape.lineTo(-halfW + r, halfD);
  shape.absarc(-halfW + r, halfD - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(-halfW, -halfD + r);
  shape.absarc(-halfW + r, -halfD + r, r, Math.PI, 1.5 * Math.PI, false);
  shape.closePath();
  return shape;
}

/** CORRECTION (Clay style): thicker, smoother bevel — shared by walls and the flat roof. */
const CLAY_EXTRUDE_SETTINGS = {
  bevelEnabled: true,
  bevelThickness: 0.18,
  bevelSize: 0.15,
  bevelSegments: 4,
  curveSegments: 4,
};

/** CORRECTION (Clay style): matte-ish, faintly satin surface — not a shiny plastic look. */
function createClayMaterial(color: THREE.Color | string): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.55,
    metalness: 0,
    clearcoat: 0.2,
    clearcoatRoughness: 0.5,
  });
}

/**
 * CORRECTION (Clay style): each building instance gets a small random
 * hue/saturation/lightness jitter around its type's base color, using the
 * same seeded RNG the rest of the project already uses — so it stays
 * deterministic (Phase 3b AC #5 still applies) while no two buildings of
 * the same type are perfectly identical, like hand-made clay pieces.
 */
function jitterColor(baseHexColor: string, random: () => number): THREE.Color {
  const base = new THREE.Color(baseHexColor);
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);

  const hueJitter = (random() - 0.5) * 0.03;
  const satJitter = (random() - 0.5) * 0.16;
  const lightJitter = (random() - 0.5) * 0.14;

  const jittered = new THREE.Color();
  jittered.setHSL(
    (hsl.h + hueJitter + 1) % 1,
    THREE.MathUtils.clamp(hsl.s + satJitter, 0, 1),
    THREE.MathUtils.clamp(hsl.l + lightJitter, 0.05, 0.95),
  );
  return jittered;
}

/**
 * Walls: a rounded-rectangle footprint, extruded with a thick, smooth bevel
 * — per Build Spec + Clay-style Correction. `wallColor` is the already
 * per-instance-jittered color (see buildBuildingMesh).
 */
function buildWalls(type: BuildingTypeDef, wallColor: THREE.Color): THREE.Mesh {
  const cornerRadius = 0.18 * Math.min(type.width, type.depth); // 18%, within the requested 15-20% range
  const shape = createRoundedRectShape(type.width, type.depth, cornerRadius);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: type.wallHeight,
    ...CLAY_EXTRUDE_SETTINGS,
  });
  // The shape lives in local XY; extrusion runs along local Z. Standing it
  // up (-90° about X) turns that extrusion into world-vertical (Y), with
  // the footprint flat on the XZ ground plane.
  geometry.rotateX(-Math.PI / 2);

  const material = createClayMaterial(wallColor);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'walls';
  return mesh;
}

/**
 * Roof: 'pyramid' uses a 4-sided cone — the correct, simple primitive for a
 * tapering form (a plain ExtrudeGeometry can't taper to a point, since it
 * keeps a constant cross-section along the extrusion). The Clay-style
 * rounded-corner treatment applies only to the 'flat' roof below, which
 * genuinely is an extruded shape (per Correction scope: "buildRoof()
 * (ส่วน flat roof)"). Both use the new Clay material either way.
 */
function buildRoof(type: BuildingTypeDef, roofColor: THREE.Color): THREE.Mesh {
  const material = createClayMaterial(roofColor);

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

  // Flat roof: a genuinely flat slab — this one really is a rounded-corner
  // ExtrudeGeometry with the Clay bevel, exactly per spec/correction.
  const halfW = type.width * 1.08;
  const halfD = type.depth * 1.08;
  const cornerRadius = 0.18 * Math.min(type.width, type.depth) * 1.08;
  const shape = createRoundedRectShape(halfW, halfD, cornerRadius);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: type.roofHeight,
    ...CLAY_EXTRUDE_SETTINGS,
  });
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = type.wallHeight;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'roof';
  return mesh;
}

type Facing = 'north' | 'south' | 'east' | 'west';

/**
 * Positions and orients `mesh` flush against one wall face. `inPlaneOffset`
 * shifts it sideways along that wall (world X for north/south faces, world
 * Z for east/west faces) — used to lay out the window grid's 2x2 cells;
 * pass 0 for a single centered element like the door.
 */
function positionOnWall(
  mesh: THREE.Object3D,
  facing: Facing,
  wallHalfExtent: number,
  yCenter: number,
  inPlaneOffset: number,
  epsilon: number,
): void {
  switch (facing) {
    case 'south':
      mesh.position.set(inPlaneOffset, yCenter, -wallHalfExtent - epsilon);
      mesh.rotation.y = Math.PI;
      break;
    case 'north':
      mesh.position.set(inPlaneOffset, yCenter, wallHalfExtent + epsilon);
      break;
    case 'east':
      mesh.position.set(wallHalfExtent + epsilon, yCenter, inPlaneOffset);
      mesh.rotation.y = Math.PI / 2;
      break;
    case 'west':
      mesh.position.set(-wallHalfExtent - epsilon, yCenter, inPlaneOffset);
      mesh.rotation.y = -Math.PI / 2;
      break;
  }
}

/**
 * A flat colored plane pressed just outside a wall face — the cheap,
 * stylized-toy way to read as a door without needing boolean/CSG cutouts
 * into the wall geometry (no CSG library is available without adding a new
 * dependency, which Out-of-Scope rules for this phase forbid).
 */
function buildAccentPlane(width: number, height: number, color: string, wallHalfExtent: number, facing: Facing, yCenter: number): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(width, height);
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.6, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  positionOnWall(mesh, facing, wallHalfExtent, yCenter, 0, 0.03);
  return mesh;
}

/**
 * CORRECTION (Clay style): windows are now a 2x2 grid of small panes with a
 * slightly-recessed darker frame plane behind them (visible through the
 * gaps between panes as mullions), instead of one single plane.
 */
function buildWindowGrid(width: number, height: number, wallHalfExtent: number, facing: Facing, yCenter: number): THREE.Group {
  const group = new THREE.Group();

  const frame = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({ color: WINDOW_FRAME_COLOR, roughness: 0.7, side: THREE.DoubleSide }),
  );
  positionOnWall(frame, facing, wallHalfExtent, yCenter, 0, 0.025); // sits behind the panes
  frame.name = 'window-frame';
  group.add(frame);

  const paneWidth = (width / 2) * 0.82; // < half-width, so the frame shows through as a gap between panes
  const paneHeight = (height / 2) * 0.82;
  const hOffset = width / 4;
  const vOffset = height / 4;
  const cellOffsets: Array<[number, number]> = [
    [-hOffset, vOffset],
    [hOffset, vOffset],
    [-hOffset, -vOffset],
    [hOffset, -vOffset],
  ];

  cellOffsets.forEach(([cellH, cellV], i) => {
    const pane = new THREE.Mesh(
      new THREE.PlaneGeometry(paneWidth, paneHeight),
      new THREE.MeshStandardMaterial({ color: WINDOW_PANE_COLOR, roughness: 0.5, side: THREE.DoubleSide }),
    );
    positionOnWall(pane, facing, wallHalfExtent, yCenter + cellV, cellH, 0.045); // proud of the frame
    pane.name = `window-pane-${i}`;
    group.add(pane);
  });

  return group;
}

/**
 * Builds one building: walls + roof + 1 door + `windowCount` window grids.
 * Everything is in "building-local" space — door always faces local
 * "south" by convention. This doesn't need to correspond to any world
 * direction: Placement applies its own random yaw per building, so the
 * whole thing just needs to be internally consistent, which it is.
 *
 * `colorSeed` drives the per-instance Clay color jitter (Correction) —
 * pass the same seed to get the same colors every time (Phase 3b AC #5).
 */
export function buildBuildingMesh(type: BuildingTypeDef, colorSeed = 0): THREE.Group {
  const group = new THREE.Group();
  group.name = `building-${type.id}`;

  const colorRandom = createSeededRandom(colorSeed);
  const wallColor = jitterColor(type.wallColor, colorRandom);
  const roofColor = jitterColor(type.roofColor, colorRandom);

  const walls = buildWalls(type, wallColor);
  const roof = buildRoof(type, roofColor);
  group.add(walls, roof);

  const door = buildAccentPlane(type.doorWidth, type.doorHeight, DOOR_COLOR, type.depth / 2, 'south', type.doorHeight / 2);
  door.name = 'door';
  group.add(door);

  const windowFacings: Facing[] = ['north', 'east', 'west'];
  for (let i = 0; i < type.windowCount; i++) {
    const facing = windowFacings[i % windowFacings.length];
    const halfExtent = facing === 'north' ? type.depth / 2 : type.width / 2;
    const windowGroup = buildWindowGrid(type.windowWidth, type.windowHeight, halfExtent, facing, type.wallHeight * 0.55);
    windowGroup.name = `window-${i}`;
    group.add(windowGroup);
  }

  return group;
}
