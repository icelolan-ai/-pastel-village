import { createRenderInfra, resizeRenderInfra } from '../rendering/SceneSetup';
import { createWorldBundle } from '../world/WorldBundle';
import { CameraController } from '../camera/CameraController';
import { DebugOverlay } from '../debug/DebugOverlay';

// --- Fixed-timestep simulation / variable-rate render separation --------
// No simulation content yet through Phase 2, but the loop is structured
// this way from the start (Master Blueprint Section 6 / 28) so later
// phases can plug NPC/weather/time ticks into `simulateTick` without
// touching the render loop itself.
const SIM_TICK_RATE = 10; // ticks per second
const SIM_TICK_MS = 1000 / SIM_TICK_RATE;
let simAccumulatorMs = 0;

function simulateTick(_dtMs: number): void {
  // Intentionally empty through Phase 2. Future phases (Time/Weather/NPC)
  // hook in here.
}
// ---------------------------------------------------------------------

function main(): void {
  const canvas = document.getElementById('scene-canvas') as HTMLCanvasElement | null;
  const debugElement = document.getElementById('debug-overlay');

  if (!canvas || !debugElement) {
    throw new Error('[main] Required DOM elements are missing (scene-canvas / debug-overlay).');
  }

  const infra = createRenderInfra(canvas);
  const world = createWorldBundle();
  infra.scene.add(world.world);

  const debugOverlay = new DebugOverlay(debugElement);
  debugOverlay.setRoadDebugState(world.groups.roads.visible);
  debugOverlay.setZoneDebugState(world.groups.zonesDebug.visible);

  const cameraController = new CameraController(infra.camera, canvas);
  // Phase 1 shipped with a hardcoded ±30 fallback; now that the terrain's
  // real footprint is known, pan is clamped to it instead.
  cameraController.setPanBounds(world.terrainExtents);

  function resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    resizeRenderInfra(infra, width, height);
  }
  resize();
  window.addEventListener('resize', resize);
  // iOS Safari fires odd resize timing on address-bar show/hide.
  window.visualViewport?.addEventListener('resize', resize);

  // Dev-only debug toggles (Master Blueprint Section 32; this phase adds
  // Road Graph / Zones on top of the Phase 1 FPS-only overlay).
  window.addEventListener('keydown', (event) => {
    if (event.key === 'r' || event.key === 'R') {
      const next = !world.groups.roads.visible;
      world.setRoadDebugVisible(next);
      debugOverlay.setRoadDebugState(next);
    } else if (event.key === 'z' || event.key === 'Z') {
      const next = !world.groups.zonesDebug.visible;
      world.setZoneDebugVisible(next);
      debugOverlay.setZoneDebugState(next);
    }
  });

  let lastFrameTime = performance.now();

  function renderLoop(now: number): void {
    requestAnimationFrame(renderLoop);

    const dtMs = Math.min(now - lastFrameTime, 250); // clamp to avoid spiral-of-death after tab switch
    lastFrameTime = now;

    simAccumulatorMs += dtMs;
    while (simAccumulatorMs >= SIM_TICK_MS) {
      simulateTick(SIM_TICK_MS);
      simAccumulatorMs -= SIM_TICK_MS;
    }

    // Small idle motion purely to give visual confirmation the render
    // loop is alive — not game content.
    world.placeholder.position.y = 1.2 + Math.sin(now * 0.0015) * 0.08;
    world.placeholder.rotation.y += dtMs * 0.0004;

    debugOverlay.tick(now);
    infra.renderer.render(infra.scene, infra.camera);
  }
  requestAnimationFrame(renderLoop);

  // Cleanup hook (not currently invoked — kept for future HMR / teardown use).
  window.addEventListener(
    'beforeunload',
    () => {
      cameraController.dispose();
      world.dispose();
      infra.dispose();
    },
    { once: true },
  );
}

main();
