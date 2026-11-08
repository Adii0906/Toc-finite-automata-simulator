import { FrameLoop, easeInOut } from "./frame-loop";
import type { MachineTrace } from "./machine-trace";

export type Phase = "ready" | "read" | "transition" | "arrive" | "consume" | "rewind";
export type Mode = "stopped" | "playing" | "stepping" | "paused" | "rewinding";
export type Speed = "slow" | "normal" | "fast";

export const SPEED_FACTOR: Record<Speed, number> = { slow: 2, normal: 1, fast: 0.45 };

/** Phase lengths at normal speed, in milliseconds. */
export const PHASE_MS: Record<Exclude<Phase, "ready">, number> = {
  read: 420,
  transition: 1050,
  arrive: 380,
  consume: 260,
  rewind: 380,
};

export interface PlaybackSnapshot {
  /** One or more machines reading the same input, in lockstep. */
  traces: readonly MachineTrace[];
  /** Number of fully completed steps. */
  cursor: number;
  phase: Phase;
  mode: Mode;
  /** Highest cursor reached since the last load or restart. */
  furthest: number;
  speed: Speed;
  /** True once an empty input has been run (no steps exist to mark progress). */
  evaluated: boolean;
}

export interface ParticleFrame {
  edgeId: string;
  /** Fraction of the edge's arc length, from 0 to 1. */
  t: number;
  /** The input symbol this particle is carrying, if any. */
  symbol?: string;
}

type Listener = () => void;
export type FrameListener = (particles: readonly ParticleFrame[]) => void;

/**
 * Replays steps computed by the engines. One clock owns all timing, so
 * animations can never overlap. Phase progress is a 0..1 fraction, so pausing
 * keeps the exact position and a speed change applies mid-flight.
 */
export class SimulationPlayer {
  private snapshot: PlaybackSnapshot;
  private progress = 0;
  private rewindFrom = 0;
  private flight: number | null = null;
  private loop = new FrameLoop((ms) => this.tick(ms));
  private listeners = new Set<Listener>();
  private frameListeners = new Map<number, Set<FrameListener>>();
  private subscribers = new Map<number, (listener: FrameListener) => () => void>();

  constructor(traces: readonly MachineTrace[], speed: Speed = "normal") {
    this.snapshot = this.fresh(traces, speed);
  }

  getSnapshot = () => this.snapshot;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  /** A stable subscribe function for the particles of one machine. */
  framesFor(traceIndex: number) {
    let subscriber = this.subscribers.get(traceIndex);
    if (!subscriber) {
      subscriber = (listener: FrameListener) => {
        const set = this.frameListeners.get(traceIndex) ?? new Set<FrameListener>();
        this.frameListeners.set(traceIndex, set);
        set.add(listener);
        listener(this.particlesFor(traceIndex));
        return () => void set.delete(listener);
      };
      this.subscribers.set(traceIndex, subscriber);
    }
    return subscriber;
  }

  load(traces: readonly MachineTrace[]) {
    this.halt();
    this.commit(this.fresh(traces, this.snapshot.speed));
  }

  play() {
    if (this.snapshot.mode === "playing") return;
    if (this.snapshot.mode === "rewinding") this.finishRewind();

    const count = this.stepCount();
    if (count === 0) {
      this.commit({ ...this.snapshot, evaluated: true });
      return;
    }
    if (this.snapshot.phase === "ready" && this.snapshot.cursor >= count) this.restart();

    const phase = this.snapshot.phase === "ready" ? "read" : this.snapshot.phase;
    this.commit({ ...this.snapshot, phase, mode: "playing" });
    this.loop.start();
  }

  pause() {
    const { mode } = this.snapshot;
    if (mode !== "playing" && mode !== "stepping") return;
    this.loop.stop();
    this.commit({ ...this.snapshot, mode: "paused" });
  }

  /** Executes exactly one transition. */
  next() {
    if (this.snapshot.mode === "playing") return;
    if (this.snapshot.mode === "rewinding") this.finishRewind();
    if (this.snapshot.mode === "stepping") this.completeCurrentStep();

    if (this.snapshot.mode === "paused") {
      this.commit({ ...this.snapshot, mode: "stepping" });
      this.loop.start();
      return;
    }

    if (this.stepCount() === 0) {
      this.commit({ ...this.snapshot, evaluated: true });
      return;
    }
    if (this.snapshot.cursor >= this.stepCount()) return;

    this.progress = 0;
    this.commit({ ...this.snapshot, phase: "read", mode: "stepping" });
    this.loop.start();
  }

  /** Undoes the step in progress, or the last completed step if none is. */
  previous() {
    if (this.snapshot.mode === "playing") return;
    if (this.snapshot.mode === "rewinding") this.finishRewind();

    const { phase, cursor, evaluated } = this.snapshot;
    if (phase === "read") {
      this.halt();
      this.commit({ ...this.snapshot, phase: "ready", mode: "stopped" });
    } else if (phase !== "ready") {
      this.beginRewind(cursor, phase === "transition" ? (this.flight ?? 0) : 1);
    } else if (cursor > 0) {
      this.beginRewind(cursor - 1, 1);
    } else if (evaluated) {
      this.commit({ ...this.snapshot, evaluated: false });
    }
  }

  restart() {
    this.halt();
    this.commit(this.fresh(this.snapshot.traces, this.snapshot.speed));
  }

  /** Jumps straight to the machine configuration after `cursor` steps. */
  seek(cursor: number) {
    this.halt();
    const target = Math.max(0, Math.min(cursor, this.stepCount()));
    this.commit({
      ...this.snapshot,
      cursor: target,
      phase: "ready",
      mode: "stopped",
      furthest: Math.max(this.snapshot.furthest, target),
    });
  }

  setSpeed(speed: Speed) {
    if (speed !== this.snapshot.speed) this.commit({ ...this.snapshot, speed });
  }

  halt() {
    this.loop.stop();
    this.progress = 0;
    this.flight = null;
    this.emitFrames();
  }

  private stepCount() {
    return this.snapshot.traces[0]?.steps.length ?? 0;
  }

  private fresh(traces: readonly MachineTrace[], speed: Speed): PlaybackSnapshot {
    return { traces, cursor: 0, phase: "ready", mode: "stopped", furthest: 0, speed, evaluated: false };
  }

  private beginRewind(index: number, from: number) {
    this.loop.stop();
    this.progress = 0;
    this.rewindFrom = from;
    this.commit({ ...this.snapshot, cursor: index, phase: "rewind", mode: "rewinding" });
    this.updateFlight();
    this.loop.start();
  }

  private finishRewind() {
    this.halt();
    this.commit({ ...this.snapshot, phase: "ready", mode: "stopped" });
  }

  /** Lands the running step immediately so a new one never overlaps it. */
  private completeCurrentStep() {
    this.halt();
    const cursor = this.snapshot.cursor + 1;
    this.commit({
      ...this.snapshot,
      cursor,
      furthest: Math.max(this.snapshot.furthest, cursor),
      phase: "ready",
      mode: "stopped",
    });
  }

  private commit(next: PlaybackSnapshot) {
    this.snapshot = next;
    this.listeners.forEach((listener) => listener());
  }

  private isRunning() {
    const { mode } = this.snapshot;
    return mode === "playing" || mode === "stepping" || mode === "rewinding";
  }

  private phaseDuration() {
    const { phase, speed } = this.snapshot;
    return phase === "ready" ? 1 : PHASE_MS[phase] * SPEED_FACTOR[speed];
  }

  private tick(elapsed: number) {
    if (!this.isRunning()) {
      this.loop.stop();
      return;
    }
    this.progress += elapsed / this.phaseDuration();
    while (this.progress >= 1 && this.isRunning()) {
      this.progress -= 1;
      this.advancePhase();
    }
    if (!this.isRunning()) this.loop.stop();
    this.updateFlight();
  }

  private advancePhase() {
    const s = this.snapshot;
    switch (s.phase) {
      case "read":
        this.commit({ ...s, phase: "transition" });
        break;
      case "transition":
        this.commit({ ...s, phase: "arrive" });
        break;
      case "arrive":
        this.commit({ ...s, phase: "consume" });
        break;
      case "consume": {
        const cursor = s.cursor + 1;
        const furthest = Math.max(s.furthest, cursor);
        const done = cursor >= this.stepCount();
        if (done || s.mode === "stepping") {
          this.progress = 0;
          this.commit({ ...s, cursor, furthest, phase: "ready", mode: "stopped" });
        } else {
          this.commit({ ...s, cursor, furthest, phase: "read" });
        }
        break;
      }
      case "rewind":
        this.progress = 0;
        this.commit({ ...s, phase: "ready", mode: "stopped" });
        break;
      default:
        break;
    }
  }

  private updateFlight() {
    const { phase } = this.snapshot;
    const p = Math.min(this.progress, 1);
    if (phase === "transition") this.flight = easeInOut(p);
    else if (phase === "rewind" && this.rewindFrom > 0) this.flight = this.rewindFrom * (1 - easeInOut(p));
    else this.flight = null;
    this.emitFrames();
  }

  private particlesFor(traceIndex: number): ParticleFrame[] {
    if (this.flight === null) return [];
    const step = this.snapshot.traces[traceIndex]?.steps[this.snapshot.cursor];
    if (!step) return [];
    const t = this.flight;
    return step.moves.map((move) => ({ edgeId: move.edgeId, t, symbol: step.symbol }));
  }

  private emitFrames() {
    this.frameListeners.forEach((set, traceIndex) => {
      const particles = this.particlesFor(traceIndex);
      set.forEach((listener) => listener(particles));
    });
  }
}
