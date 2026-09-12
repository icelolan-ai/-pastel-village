import { createSceneBundle, resizeSceneBundle } from '../rendering/SceneSetup';
import { CameraController } from '../camera/CameraController';
import { DebugOverlay } from '../debug/DebugOverlay';

// --- Fixed-timestep simulation / variable-rate render separation --------
// Phase 1 has no simulation content yet, but the loop is structured this
// way from the start (Master Blueprint Section 6 / 28) so later phases can
// plug NPC/weather/time ticks into `simulateTick` without touching the
// render loop itself.
const SIM_TICK_RATE = 10; // ticks per second
const SIM_TICK_MS = 1000 / SIM_TICK_RATE;
let simAccumulatorMs = 0;

function simulateTick(_dtMs: number): void {
  // Intentionally empty in Phase 1. Future phases (Time/Weather/NPC)
  // hook in here.
}
// ---------------------------------------------------------------------

function main(): void {
  const canvas = document.getElementById('scene-canvas') as HTMLCanvasElement | null;
  const debugElement = document.getElementById('debug-overlay');

  if (!canvas || !debugElement) {
    throw new Error('[main] Required DOM elements are missing (scene-canvas / debug-overlay).');
  }

  const bundle = createSceneBundle(canvas);
  const cameraController = new CameraController(bundle.camera, canvas);
  const debugOverlay = new DebugOverlay(debugElement);

  function resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    resizeSceneBundle(bundle, width, height);
  }
  resize();
  window.addEventListener('resize', resize);
  // iOS Safari fires odd resize timing on address-bar show/hide.
  window.visualViewport?.addEventListener('resize', resize);

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
    bundle.placeholder.position.y = 1.2 + Math.sin(now * 0.0015) * 0.08;
    bundle.placeholder.rotation.y += dtMs * 0.0004;

    debugOverlay.tick(now);
    bundle.renderer.render(bundle.scene, bundle.camera);
  }
  requestAnimationFrame(renderLoop);

  // Cleanup hook (not currently invoked — kept for future HMR / teardown use).
  window.addEventListener(
    'beforeunload',
    () => {
      cameraController.dispose();
      bundle.dispose();
    },
    { once: true },
  );
}

main();
