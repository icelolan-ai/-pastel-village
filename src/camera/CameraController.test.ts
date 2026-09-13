import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { computePanWorldDelta } from './CameraController';

/**
 * Builds a camera positioned exactly the way CameraController.updateCameraPosition()
 * does. We can't construct a real CameraController here — its constructor talks to
 * the global `window` object (for pointerup/pointercancel listeners), which doesn't
 * exist in this test environment — but the direction bug lives entirely in the pure
 * math, so a plain camera positioned the same way is all we need.
 */
function buildOrbitCamera(azimuth: number, polar: number, distance: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  const target = new THREE.Vector3(0, 0, 0);
  const sinPolar = Math.sin(polar);
  const offset = new THREE.Vector3(
    distance * sinPolar * Math.sin(azimuth),
    distance * Math.cos(polar),
    distance * sinPolar * Math.cos(azimuth),
  );
  camera.position.copy(target).add(offset);
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  return camera;
}

/**
 * Applies a pan delta the same way CameraController.pan() effectively does:
 * moving `target` by `delta` moves the camera by the exact same `delta`
 * (camera = target + a fixed offset), with orientation unchanged — lookAt
 * only depends on (target - camera), which is invariant when both move
 * together by the same amount. So we can simulate "drag, then re-render"
 * by just translating the already-oriented camera.
 */
function applyPanDelta(camera: THREE.PerspectiveCamera, delta: THREE.Vector3): void {
  camera.position.add(delta);
  camera.updateMatrixWorld(true);
}

const AZIMUTH = THREE.MathUtils.degToRad(45);
const POLAR = THREE.MathUtils.degToRad(58);
const DISTANCE = 18;
const PAN_SPEED = 0.01; // arbitrary — only the sign/direction is under test, not magnitude
const REFERENCE_POINT = new THREE.Vector3(0, 0, 0);

describe('computePanWorldDelta — pan direction (Phase 2 correction)', () => {
  it('dragging right moves a fixed world point right on screen', () => {
    const camera = buildOrbitCamera(AZIMUTH, POLAR, DISTANCE);
    const before = REFERENCE_POINT.clone().project(camera);

    const delta = computePanWorldDelta(50, 0, camera, AZIMUTH, PAN_SPEED);
    applyPanDelta(camera, delta);

    const after = REFERENCE_POINT.clone().project(camera);
    expect(after.x).toBeGreaterThan(before.x);
  });

  it('dragging left moves a fixed world point left on screen', () => {
    const camera = buildOrbitCamera(AZIMUTH, POLAR, DISTANCE);
    const before = REFERENCE_POINT.clone().project(camera);

    const delta = computePanWorldDelta(-50, 0, camera, AZIMUTH, PAN_SPEED);
    applyPanDelta(camera, delta);

    const after = REFERENCE_POINT.clone().project(camera);
    expect(after.x).toBeLessThan(before.x);
  });

  it('dragging down moves a fixed world point down on screen', () => {
    const camera = buildOrbitCamera(AZIMUTH, POLAR, DISTANCE);
    const before = REFERENCE_POINT.clone().project(camera);

    const delta = computePanWorldDelta(0, 50, camera, AZIMUTH, PAN_SPEED);
    applyPanDelta(camera, delta);

    const after = REFERENCE_POINT.clone().project(camera);
    // .project() returns NDC space: +1 is the top of the screen, -1 is the bottom.
    expect(after.y).toBeLessThan(before.y);
  });

  it('dragging up moves a fixed world point up on screen', () => {
    const camera = buildOrbitCamera(AZIMUTH, POLAR, DISTANCE);
    const before = REFERENCE_POINT.clone().project(camera);

    const delta = computePanWorldDelta(0, -50, camera, AZIMUTH, PAN_SPEED);
    applyPanDelta(camera, delta);

    const after = REFERENCE_POINT.clone().project(camera);
    expect(after.y).toBeGreaterThan(before.y);
  });

  it('regression guard: the old (buggy) formula would have failed this exact test', () => {
    // Documents the bug for posterity — this is what Phase 1/2 shipped with.
    function buggyComputePanWorldDelta(
      dxPixels: number,
      dyPixels: number,
      camera: THREE.PerspectiveCamera,
      azimuth: number,
      panSpeed: number,
    ): THREE.Vector3 {
      const right = new THREE.Vector3();
      camera.getWorldDirection(right);
      right.set(right.z, 0, -right.x).normalize();
      const forward = new THREE.Vector3(Math.sin(azimuth), 0, Math.cos(azimuth)).normalize();
      const delta = new THREE.Vector3();
      delta.addScaledVector(right, -dxPixels * panSpeed); // the bug: wrong sign
      delta.addScaledVector(forward, dyPixels * panSpeed); // the bug: wrong sign
      return delta;
    }

    const camera = buildOrbitCamera(AZIMUTH, POLAR, DISTANCE);
    const before = REFERENCE_POINT.clone().project(camera);

    const buggyDelta = buggyComputePanWorldDelta(50, 0, camera, AZIMUTH, PAN_SPEED);
    applyPanDelta(camera, buggyDelta);

    const after = REFERENCE_POINT.clone().project(camera);
    // With the bug, dragging right moved the point LEFT — the opposite of what a
    // real user would expect. This test exists so nobody re-introduces this sign.
    expect(after.x).toBeLessThan(before.x);
  });
});
