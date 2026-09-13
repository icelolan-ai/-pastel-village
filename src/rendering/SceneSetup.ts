import * as THREE from 'three';

/**
 * Rendering infrastructure (renderer/camera/scene) plus the individual
 * content pieces (sky, terrain, lights, placeholder). As of Phase 2, this
 * module only *creates* content — WorldBundle.ts (in world/) is what
 * assembles it into the named group hierarchy and adds it to the scene.
 *
 * Everything here is built from Three.js primitives / procedural shaders —
 * no external asset files are used (still Out of Scope through Phase 2).
 */
export interface RenderInfra {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  dispose: () => void;
}

export interface TerrainBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface TerrainResult {
  mesh: THREE.Mesh;
  /** The terrain's actual footprint (after margin/organic-shape sizing) — feed this to CameraController's pan bounds. */
  extents: TerrainBounds;
}

const PASTEL_SKY_TOP = new THREE.Color('#bfe3ff');
const PASTEL_SKY_BOTTOM = new THREE.Color('#fbe9f2');
const PASTEL_GROUND = new THREE.Color('#bdeecb');
const PASTEL_PLACEHOLDER = new THREE.Color('#ffb3c6');

export function createSkyDome(): THREE.Mesh {
  // A large inverted sphere with a simple vertical-gradient shader.
  // Cheap on mobile GPUs: no textures, one draw call, BackSide only.
  const geometry = new THREE.SphereGeometry(500, 24, 16);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: PASTEL_SKY_TOP },
      bottomColor: { value: PASTEL_SKY_BOTTOM },
      offset: { value: 20 },
      exponent: { value: 0.6 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
        float t = max(pow(max(h, 0.0), exponent), 0.0);
        gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(geometry, material);
  sky.name = 'SkyDomeMesh';
  return sky;
}

/**
 * Builds an organic (non-circular) terrain patch guaranteed to fully cover
 * `bounds` (the AABB of every road node/edge-control-point/zone-polygon
 * point — see villageData.computeVillageBounds).
 *
 * Coverage guarantee: the shape's radius at every angle is
 * `baseRadius * (1 - amplitude)` at minimum. `baseRadius` is derived from
 * the bounds' half-diagonal (the single farthest point any AABB corner can
 * be from its center) divided by `(1 - amplitude)`, plus a small fixed
 * margin — so the minimum possible terrain radius already exceeds the
 * half-diagonal, and the whole AABB (and therefore every road/zone point
 * inside it) is always enclosed, regardless of the exact coordinates in
 * villageData.ts.
 */
export function createTerrain(bounds: TerrainBounds): TerrainResult {
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const halfWidth = (bounds.maxX - bounds.minX) / 2;
  const halfDepth = (bounds.maxZ - bounds.minZ) / 2;
  const halfDiagonal = Math.hypot(halfWidth, halfDepth);

  const amplitude = 0.12;
  const extraMargin = 3; // buffer against discretization + gives visible "shoreline" beyond the outermost zone
  const baseRadius = halfDiagonal / (1 - amplitude) + extraMargin;

  const segments = 40;
  const points: [number, number][] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const radius = baseRadius * (1 + amplitude * Math.sin(angle * 3 + 0.7));
    points.push([centerX + radius * Math.cos(angle), centerZ + radius * Math.sin(angle)]);
  }

  // Triangulate in 2D (using [x, z] as the triangulator's [x, y] — this is
  // purely for computing triangle *indices*; we place the real 3D vertices
  // ourselves below, so there is no XY/XZ axis-mapping ambiguity here).
  const contour = points.map(([x, z]) => new THREE.Vector2(x, z));
  const triangleIndexGroups = THREE.ShapeUtils.triangulateShape(contour, []);

  const positions = new Float32Array(points.length * 3);
  points.forEach(([x, z], i) => {
    positions[i * 3] = x;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = z;
  });

  const indices: number[] = [];
  for (const [a, b, c] of triangleIndexGroups) indices.push(a, b, c);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: PASTEL_GROUND,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide, // safety net against triangle winding — always lit correctly from above
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.name = 'TerrainMesh';

  // Recompute exact extents of the generated (post-margin, post-organic-perturbation) shape.
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  return { mesh, extents: { minX, maxX, minZ, maxZ } };
}

export function createPlaceholder(): THREE.Mesh {
  // Rounded placeholder to prove the renderer AND signal the intended
  // "cute pastel toy" direction — deliberately not a plain cube. Kept from
  // Phase 1 as a visual anchor; Phase 3 will replace it with real props.
  const geometry = new THREE.SphereGeometry(1.2, 32, 32);
  const material = new THREE.MeshStandardMaterial({
    color: PASTEL_PLACEHOLDER,
    roughness: 0.6,
    metalness: 0.05,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, 1.2, 0);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  mesh.name = 'PlaceholderObject';
  return mesh;
}

export function createLights(): THREE.Object3D[] {
  // CORRECTION (Clay style): reduced ~17% (from 2.4) so shadows read softer,
  // less like harsh direct sunlight — paired with the HemisphereLight boost
  // below.
  const sun = new THREE.DirectionalLight(0xffffff, 2.0);
  sun.position.set(12, 18, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -20;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;
  sun.shadow.bias = -0.0015;
  sun.name = 'SunLight';

  // CORRECTION (Clay style): increased ~27% (from 1.1) to fill shadows more,
  // matching the soft, diffuse "studio light" look of a real clay render.
  const hemi = new THREE.HemisphereLight(0xffe6f2, 0xbdeecb, 1.4);
  hemi.name = 'AmbientHemisphere';

  return [sun, hemi];
}

export function createRenderInfra(canvas: HTMLCanvasElement): RenderInfra {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    45,
    canvas.clientWidth / Math.max(canvas.clientHeight, 1),
    0.1,
    1000,
  );

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // iOS Safari frequently drops the WebGL context on tab switch / low memory.
  // We must handle this explicitly or the canvas goes permanently black.
  const handleContextLost = (event: Event) => {
    event.preventDefault();
    console.warn('[SceneSetup] WebGL context lost — waiting for restore.');
  };
  const handleContextRestored = () => {
    console.info('[SceneSetup] WebGL context restored.');
  };
  canvas.addEventListener('webglcontextlost', handleContextLost, false);
  canvas.addEventListener('webglcontextrestored', handleContextRestored, false);

  const dispose = () => {
    canvas.removeEventListener('webglcontextlost', handleContextLost);
    canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    renderer.dispose();
  };

  return { scene, camera, renderer, dispose };
}

export function resizeRenderInfra(infra: RenderInfra, width: number, height: number): void {
  infra.camera.aspect = width / Math.max(height, 1);
  infra.camera.updateProjectionMatrix();
  infra.renderer.setSize(width, height, false);
}
