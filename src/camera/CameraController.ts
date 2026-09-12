import * as THREE from 'three';

/**
 * Diorama-style camera: fixed low/medium isometric 3/4 angle.
 * Free rotation is intentionally NOT supported in Phase 1 / MVP
 * (see Master Blueprint Section 16) — only Pan and Zoom.
 *
 *  - Pan:  1-finger drag (touch) / left mouse drag (desktop)
 *  - Zoom: pinch (touch) / wheel (desktop)
 */
export interface CameraControllerOptions {
  target?: THREE.Vector3;
  distance?: number;
  minDistance?: number;
  maxDistance?: number;
  azimuth?: number; // radians, fixed
  polar?: number; // radians from vertical (Y) axis, fixed
  panBounds?: number; // max |x| / |z| the target can pan to
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
  private readonly panBounds: number;

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
    this.panBounds = options.panBounds ?? 30;

    this.updateCameraPosition();
    this.attachListeners();
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

    const right = new THREE.Vector3();
    this.camera.getWorldDirection(right);
    right.set(right.z, 0, -right.x).normalize(); // perpendicular to view dir, on ground plane

    const forward = new THREE.Vector3(Math.sin(this.azimuth), 0, Math.cos(this.azimuth)).normalize();

    this.target.addScaledVector(right, -dxPixels * panSpeed);
    this.target.addScaledVector(forward, dyPixels * panSpeed);

    this.target.x = THREE.MathUtils.clamp(this.target.x, -this.panBounds, this.panBounds);
    this.target.z = THREE.MathUtils.clamp(this.target.z, -this.panBounds, this.panBounds);

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
