const MAX_FRAME_MS = 100;

/** A single requestAnimationFrame loop. Starting it twice is a no-op. */
export class FrameLoop {
  private id = 0;
  private last = 0;

  constructor(private readonly onFrame: (elapsedMs: number) => void) {}

  start() {
    if (this.id) return;
    this.last = performance.now();
    this.id = requestAnimationFrame(this.tick);
  }

  stop() {
    if (this.id) cancelAnimationFrame(this.id);
    this.id = 0;
  }

  private tick = (now: number) => {
    const elapsed = Math.min(now - this.last, MAX_FRAME_MS);
    this.last = now;
    this.id = requestAnimationFrame(this.tick);
    this.onFrame(elapsed);
  };
}

export const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
