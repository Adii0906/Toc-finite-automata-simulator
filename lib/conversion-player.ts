import { transitionId } from "./dfa-engine";
import { FrameLoop, easeInOut } from "./frame-loop";
import { SPEED_FACTOR, type FrameListener, type ParticleFrame, type Speed } from "./playback";
import type { ConversionEvent, ConversionResult } from "./subset-construction";

export type ConversionMode = "stopped" | "playing" | "stepping" | "paused";

export interface ConversionSnapshot {
  result: ConversionResult | null;
  /** The event on screen, or -1 before the conversion starts. */
  index: number;
  mode: ConversionMode;
  speed: Speed;
  /** True once the last event has been reached for this result. */
  completed: boolean;
}

export const EVENT_MS: Record<ConversionEvent["kind"], number> = {
  intro: 1100,
  initial: 1300,
  select: 1000,
  compute: 2100,
  link: 2100,
  accepting: 1700,
  done: 700,
};

/** Fractions of a link event: tokens merge first, then the DFA edge is drawn. */
const MERGE_END = 0.5;

type MergeListener = (t: number | null) => void;
type Channel = "nfa" | "dfa";

/** Steps through recorded events. Replaying only: it computes no subsets. */
export class ConversionPlayer {
  private snapshot: ConversionSnapshot = { result: null, index: -1, mode: "stopped", speed: "normal", completed: false };
  private progress = 0;
  private loop = new FrameLoop((ms) => this.tick(ms));
  private listeners = new Set<() => void>();
  private channels: Record<Channel, Set<FrameListener>> = { nfa: new Set(), dfa: new Set() };
  private mergeListeners = new Set<MergeListener>();

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  subscribeNFA = (listener: FrameListener) => this.join("nfa", listener);
  subscribeDFA = (listener: FrameListener) => this.join("dfa", listener);

  subscribeMerge = (listener: MergeListener) => {
    this.mergeListeners.add(listener);
    listener(this.mergeT());
    return () => void this.mergeListeners.delete(listener);
  };

  load(result: ConversionResult | null) {
    this.halt();
    this.commit({ ...this.snapshot, result, index: -1, mode: "stopped", completed: false });
  }

  play() {
    const { result, mode, index } = this.snapshot;
    if (!result || mode === "playing") return;
    if (mode === "paused" || mode === "stepping") {
      this.commit({ ...this.snapshot, mode: "playing" });
      this.loop.start();
      return;
    }
    this.begin(index >= this.lastIndex() ? 0 : index + 1, "playing");
  }

  pause() {
    const { mode } = this.snapshot;
    if (mode !== "playing" && mode !== "stepping") return;
    this.loop.stop();
    this.commit({ ...this.snapshot, mode: "paused" });
    this.emit();
  }

  /** Shows exactly one more event. */
  next() {
    const { result, mode } = this.snapshot;
    if (!result || mode === "playing") return;
    if (mode === "paused") {
      this.commit({ ...this.snapshot, mode: "stepping" });
      this.loop.start();
      return;
    }
    if (mode === "stepping") this.settle();
    if (this.snapshot.index < this.lastIndex()) this.begin(this.snapshot.index + 1, "stepping");
  }

  previous() {
    const { result, mode, index } = this.snapshot;
    if (!result || mode === "playing" || index <= 0) return;
    this.halt();
    this.commit({ ...this.snapshot, index: index - 1, mode: "stopped" });
  }

  restart() {
    if (!this.snapshot.result) return;
    this.halt();
    this.commit({ ...this.snapshot, index: 0, mode: "stopped" });
  }

  seek(index: number) {
    if (!this.snapshot.result) return;
    this.halt();
    const target = Math.max(0, Math.min(index, this.lastIndex()));
    this.commit({
      ...this.snapshot,
      index: target,
      mode: "stopped",
      completed: this.snapshot.completed || target === this.lastIndex(),
    });
  }

  setSpeed(speed: Speed) {
    if (speed !== this.snapshot.speed) this.commit({ ...this.snapshot, speed });
  }

  halt() {
    this.loop.stop();
    this.progress = 0;
    this.emit(true);
  }

  private join(channel: Channel, listener: FrameListener) {
    this.channels[channel].add(listener);
    listener(this.particles(channel));
    return () => void this.channels[channel].delete(listener);
  }

  private lastIndex() {
    return (this.snapshot.result?.events.length ?? 0) - 1;
  }

  private currentEvent() {
    return this.snapshot.result?.events[this.snapshot.index] ?? null;
  }

  private begin(index: number, mode: ConversionMode) {
    this.progress = 0;
    this.commit({
      ...this.snapshot,
      index,
      mode,
      completed: this.snapshot.completed || index === this.lastIndex(),
    });
    this.emit();
    this.loop.start();
  }

  private settle() {
    this.halt();
    this.commit({ ...this.snapshot, mode: "stopped" });
  }

  private commit(next: ConversionSnapshot) {
    this.snapshot = next;
    this.listeners.forEach((listener) => listener());
  }

  private tick(elapsed: number) {
    const event = this.currentEvent();
    if (!event) {
      this.loop.stop();
      return;
    }
    this.progress += elapsed / (EVENT_MS[event.kind] * SPEED_FACTOR[this.snapshot.speed]);
    if (this.progress < 1) {
      this.emit();
      return;
    }
    if (this.snapshot.mode === "playing" && this.snapshot.index < this.lastIndex()) {
      this.begin(this.snapshot.index + 1, "playing");
    } else {
      this.settle();
    }
  }

  private isAnimating() {
    return this.snapshot.mode !== "stopped";
  }

  private particles(channel: Channel): ParticleFrame[] {
    const event = this.currentEvent();
    if (!event || !this.isAnimating()) return [];

    if (channel === "nfa" && event.kind === "compute") {
      const t = easeInOut(Math.min(this.progress / 0.72, 1));
      if (this.progress >= 0.72) return [];
      return event.perMember.flatMap(({ member, targets }) =>
        targets.map((target) => ({ edgeId: transitionId(member, target), t, symbol: event.symbol })),
      );
    }
    if (channel === "dfa" && event.kind === "link" && this.progress >= MERGE_END) {
      const p = Math.min((this.progress - MERGE_END) / (1 - MERGE_END) / 0.85, 1);
      if (p >= 1) return [];
      return [{ edgeId: transitionId(event.state, event.target), t: easeInOut(p), symbol: event.symbol }];
    }
    return [];
  }

  private mergeT(): number | null {
    const event = this.currentEvent();
    if (!event || event.kind !== "link" || !this.isAnimating() || this.progress >= MERGE_END) return null;
    return easeInOut(this.progress / MERGE_END);
  }

  private emit(clear = false) {
    (["nfa", "dfa"] as const).forEach((channel) => {
      const particles = clear ? [] : this.particles(channel);
      this.channels[channel].forEach((listener) => listener(particles));
    });
    const merge = clear ? null : this.mergeT();
    this.mergeListeners.forEach((listener) => listener(merge));
  }
}
