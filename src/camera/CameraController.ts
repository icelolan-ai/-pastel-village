import * as THREE from 'three';

/**
 * Diorama-style camera: fixed low/medium isometric 3/4 angle.
 * Free rotation is intentionally NOT supported in Phase 1 / MVP
 * (see Master Blueprint Section 16) — only Pan and Zoom.
 *
 *  - Pan:  1-finger drag (touch) / left mouse drag (desktop)
 *  - Zoom: pinch (touch) / wheel (desktop)
 */
export interface PanBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CameraControllerOptions {
  target?: THREE.Vector3;
  distance?: number;
  minDistance?: number;
  maxDistance?: number;
  azimuth?: number; // radians, fixed
  polar?: number; // radians from vertical (Y) axis, fixed
  /** Pan is clamped to this rectangle on the ground plane. Defaults to a generous fallback until setPanBounds() is called with the real terrain footprint. */
  panBounds?: PanBounds;
}

interface PointerState {
  id: number;
  x: number;
  y: number;
}

export class CameraController {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly domElement: HTMLElement;

  private readonly target: THREE.Vector3;
  private distance: number;
  private readonly minDistance: number;
  private readonly maxDistance: number;
  private readonly azimuth: number;
  private readonly polar: number;
  private panBounds: PanBounds;

  private readonly pointers = new Map<number, PointerState>();
  private pinchStartDistance = 0;
  private pinchStartCameraDistance = 0;

  private readonly onPointerDown = (event: PointerEvent) => this.handlePointerDown(event);
  private readonly onPointerMove = (event: PointerEvent) => this.handlePointerMove(event);
  private readonly onPointerUp = (event: PointerEvent) => this.handlePointerUp(event);
  private readonly onWheel = (event: WheelEvent) => this.handleWheel(event);

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement, options: CameraControllerOptions = {}) {
    this.camera = camera;
    this.domElement = domElement;

    this.target = options.target ?? new THREE.Vector3(0, 0, 0);
    this.distance = options.distance ?? 18;
    this.minDistance = options.minDistance ?? 6;
    this.maxDistance = options.maxDistance ?? 35;
    this.azimuth = options.azimuth ?? THREE.MathUtils.degToRad(45);
    this.polar = options.polar ?? THREE.MathUtils.degToRad(58); // ~58deg from horizon, within 50-65 spec range
    this.panBounds = options.panBounds ?? { minX: -30, maxX: 30, minZ: -30, maxZ: 30 };

    this.updateCameraPosition();
    this.attachListeners();
  }

  /** Called once the real terrain footprint is known (see WorldBundle.terrainExtents). Replaces the Phase 1 hardcoded ±30 fallback. */
  public setPanBounds(bounds: PanBounds, marginInset = 3): void {
    this.panBounds = {
      minX: bounds.minX + marginInset,
      maxX: bounds.maxX - marginInset,
      minZ: bounds.minZ + marginInset,
      maxZ: bounds.maxZ - marginInset,
    };
    // Re-clamp the current target in case it's now outside the new (usually smaller) bounds.
    this.target.x = THREE.MathUtils.clamp(this.target.x, this.panBounds.minX, this.panBounds.maxX);
    this.target.z = THREE.MathUtils.clamp(this.target.z, this.panBounds.minZ, this.panBounds.maxZ);
    this.updateCameraPosition();
  }

  private attachListeners(): void {
    this.domElement.addEventListener('pointerdown', this.onPointerDown, { passive: true });
    this.domElement.addEventListener('pointermove', this.onPointerMove, { passive: false });
    window.addEventListener('pointerup', this.onPointerUp, { passive: true });
    window.addEventListener('pointercancel', this.onPointerUp, { passive: true });
    // Wheel must be non-passive: we call preventDefault to stop page scroll/zoom.
    this.domElement.addEventListener('wheel', this.onWheel, { passive: false });
  }

  public dispose(): void {
    this.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.domElement.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    this.domElement.removeEventListener('wheel', this.onWheel);
    this.pointers.clear();
  }

  private handlePointerDown(event: PointerEvent): void {
    this.pointers.set(event.pointerId, { id: event.pointerId, x: event.clientX, y: event.clientY });
    this.domElement.setPointerCapture?.(event.pointerId);

    if (this.pointers.size === 2) {
      this.pinchStartDistance = this.currentPinchDistance();
      this.pinchStartCameraDistance = this.distance;
    }
  }

  private handlePointerMove(event: PointerEvent): void {
    const previous = this.pointers.get(event.pointerId);
    if (!previous) return;

    // Prevent the browser from scrolling/zooming the page while we're
    // handling the gesture ourselves (canvas also has touch-action: none).
    event.preventDefault();

    const current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    this.pointers.set(event.pointerId, current);

    if (this.pointers.size === 1) {
      const dx = current.x - previous.x;
      const dy = current.y - previous.y;
      this.pan(dx, dy);
    } else if (this.pointers.size === 2) {
      const pinchDistance = this.currentPinchDistance();
      if (this.pinchStartDistance > 0) {
        const scale = this.pinchStartDistance / Math.max(pinchDistance, 1);
        this.setDistance(this.pinchStartCameraDistance * scale);
      }
    }
  }

  private handlePointerUp(event: PointerEvent): void {
    this.pointers.delete(event.pointerId);
    if (this.pointers.size < 2) {
      this.pinchStartDistance = 0;
    }
  }

  private handleWheel(event: WheelEvent): void {
    event.preventDefault();
    const zoomFactor = 1 + event.deltaY * 0.001;
    this.setDistance(this.distance * zoomFactor);
  }

  private currentPinchDistance(): number {
    const [a, b] = Array.from(this.pointers.values());
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private pan(dxPixels: number, dyPixels: number): void {
    // Move the target along the camera's local right/forward-on-ground axes
    // so panning always feels screen-relative regardless of the fixed angle.
    const panSpeed = this.distance * 0.0016;
    const delta = computePanWorldDelta(dxPixels, dyPixels, this.camera, this.azimuth, panSpeed);
    this.target.add(delta);

    this.target.x = THREE.MathUtils.clamp(this.target.x, this.panBounds.minX, this.panBounds.maxX);
    this.target.z = THREE.MathUtils.clamp(this.target.z, this.panBounds.minZ, this.panBounds.maxZ);

    this.updateCameraPosition();
  }

  private setDistance(value: number): void {
    this.distance = THREE.MathUtils.clamp(value, this.minDistance, this.maxDistance);
    this.updateCameraPosition();
  }

  private updateCameraPosition(): void {
    const sinPolar = Math.sin(this.polar);
    const offset = new THREE.Vector3(
      this.distance * sinPolar * Math.sin(this.azimuth),
      this.distance * Math.cos(this.polar),
      this.distance * sinPolar * Math.cos(this.azimuth),
    );
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);
  }
}

/**
 * CORRECTION (Phase 2 revision): computes how far the pan target should
 * move in world space for a screen-space drag of (dxPixels, dyPixels), so
 * the ground appears to be dragged along with the pointer — drag right,
 * the world moves right with your finger, like a map app. Exported as a
 * pure function (no DOM/camera-controller state) so pan *direction* can be
 * unit-tested directly instead of only checking that `target` changed.
 *
 * Bug history: the original Phase 1/2 implementation used
 * `-dxPixels * right + dyPixels * forward`, which is the exact negation of
 * the correct delta on both axes (confirmed by hand-deriving the camera's
 * true local right/up axes from its azimuth/polar orbit angles) — so the
 * scene visually panned opposite the drag on both X and Y. The fix flips
 * both signs: `dxPixels * right - dyPixels * forward`.
 */
export function computePanWorldDelta(
  dxPixels: number,
  dyPixels: number,
  camera: THREE.PerspectiveCamera,
  azimuth: number,
  panSpeed: number,
): THREE.Vector3 {
  const right = new THREE.Vector3();
  camera.getWorldDirection(right);
  right.set(right.z, 0, -right.x).normalize(); // perpendicular to view dir, on ground plane

  const forward = new THREE.Vector3(Math.sin(azimuth), 0, Math.cos(azimuth)).normalize();

  const delta = new THREE.Vector3();
  delta.addScaledVector(right, dxPixels * panSpeed);
  delta.addScaledVector(forward, -dyPixels * panSpeed);
  return delta;
}
