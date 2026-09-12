/**
 * Phase 1 scope: FPS only. The full DebugStats singleton (NPC count,
 * zombie count, weather, sim time, perf tier, etc.) arrives with the
 * systems that produce that data in later phases.
 */
export class DebugOverlay {
  private readonly element: HTMLElement;
  private frameCount = 0;
  private lastSampleTime = performance.now();
  private fps = 0;

  constructor(element: HTMLElement) {
    this.element = element;
    this.render();
  }

  /** Call once per rendered frame. */
  public tick(now: number): void {
    this.frameCount += 1;
    const elapsed = now - this.lastSampleTime;
    if (elapsed >= 500) {
      this.fps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastSampleTime = now;
      this.render();
    }
  }

  private render(): void {
    this.element.textContent = `FPS: ${this.fps}`;
  }
}
