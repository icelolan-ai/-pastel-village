/**
 * Phase 2 scope: FPS plus the two dev-only toggle states added this phase
 * (Road Graph / Zones debug visualization). The full DebugStats singleton
 * (NPC count, zombie count, weather, sim time, perf tier, etc.) still
 * arrives with the systems that produce that data in later phases.
 */
export class DebugOverlay {
  private readonly element: HTMLElement;
  private frameCount = 0;
  private lastSampleTime = performance.now();
  private fps = 0;
  private roadDebugVisible = true;
  private zoneDebugVisible = true;

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

  public setRoadDebugState(visible: boolean): void {
    this.roadDebugVisible = visible;
    this.render();
  }

  public setZoneDebugState(visible: boolean): void {
    this.zoneDebugVisible = visible;
    this.render();
  }

  private render(): void {
    const roadState = this.roadDebugVisible ? 'ON' : 'off';
    const zoneState = this.zoneDebugVisible ? 'ON' : 'off';
    this.element.textContent = `FPS: ${this.fps} | Roads: ${roadState} (R) | Zones: ${zoneState} (Z)`;
  }
}
