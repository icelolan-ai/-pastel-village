import * as THREE from 'three';

/**
 * Phase 1 scope: prove the render pipeline works end-to-end on mobile +
 * desktop. No village content yet — just a ground plane, a pastel sky,
 * one light rig, and a single rounded placeholder object.
 *
 * Everything here is built from Three.js primitives / procedural shaders —
 * no external asset files are used (Out of Scope for Phase 1, see Build Spec).
 */
export interface SceneBundle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  placeholder: THREE.Mesh;
  dispose: () => void;
}

const PASTEL_SKY_TOP = new THREE.Color('#bfe3ff');
const PASTEL_SKY_BOTTOM = new THREE.Color('#fbe9f2');
const PASTEL_GROUND = new THREE.Color('#bdeecb');
const PASTEL_PLACEHOLDER = new THREE.Color('#ffb3c6');

function createSkyDome(): THREE.Mesh {
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
  sky.name = 'SkyDome';
  return sky;
}

function createGround(): THREE.Mesh {
  const geometry = new THREE.CircleGeometry(40, 48);
  const material = new THREE.MeshStandardMaterial({
    color: PASTEL_GROUND,
    roughness: 1,
    metalness: 0,
  });
  const ground = new THREE.Mesh(geometry, material);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'Ground';
  return ground;
}

function createPlaceholder(): THREE.Mesh {
  // Rounded placeholder to prove the renderer AND signal the intended
  // "cute pastel toy" direction — deliberately not a plain cube.
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

function createLights(): THREE.Object3D[] {
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
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

  const hemi = new THREE.HemisphereLight(0xffe6f2, 0xbdeecb, 1.1);
  hemi.name = 'AmbientHemisphere';

  return [sun, hemi];
}

export function createSceneBundle(canvas: HTMLCanvasElement): SceneBundle {
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

  const sky = createSkyDome();
  const ground = createGround();
  const placeholder = createPlaceholder();
  const lights = createLights();

  scene.add(sky, ground, placeholder, ...lights);

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
    ground.geometry.dispose();
    (ground.material as THREE.Material).dispose();
    placeholder.geometry.dispose();
    (placeholder.material as THREE.Material).dispose();
    sky.geometry.dispose();
    (sky.material as THREE.Material).dispose();
  };

  return { scene, camera, renderer, placeholder, dispose };
}

export function resizeSceneBundle(bundle: SceneBundle, width: number, height: number): void {
  bundle.camera.aspect = width / Math.max(height, 1);
  bundle.camera.updateProjectionMatrix();
  bundle.renderer.setSize(width, height, false);
}
