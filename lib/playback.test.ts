import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { simulate } from "./dfa-engine";
import { dfaTrace } from "./machine-trace";
import { ENDS_IN_01 } from "./dfa-presets";
import { SimulationPlayer } from "./playback";
import { deriveView } from "./simulation-view";

// A manual clock: frames only run when the test advances time.
let now = 0;
let queued: FrameRequestCallback[] = [];
let peakQueued = 0;

function advance(ms: number) {
  const end = now + ms;
  while (now < end) {
    now = Math.min(now + 16, end);
    const callbacks = queued;
    queued = [];
    callbacks.forEach((callback) => callback(now));
  }
}

beforeEach(() => {
  now = 0;
  queued = [];
  peakQueued = 0;
  Object.assign(globalThis, {
    performance: { now: () => now },
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      queued.push(callback);
      peakQueued = Math.max(peakQueued, queued.length);
      return queued.length;
    },
    cancelAnimationFrame: () => {
      queued = [];
    },
  });
});

const player = (input: string) => new SimulationPlayer([dfaTrace(simulate(ENDS_IN_01, input))]);

test("play runs to the engine's verdict without ever queuing two frames", () => {
  const p = player("1101");
  p.play();
  p.play();
  advance(12000);
  const view = deriveView(p.getSnapshot());
  assert.equal(p.getSnapshot().cursor, 4);
  assert.equal(view.verdict, "accepted");
  assert.equal(peakQueued, 1);
});

test("pause holds position and resume continues", () => {
  const p = player("1101");
  p.play();
  advance(500 + 200);
  p.pause();
  const paused = p.getSnapshot();
  assert.equal(paused.phase, "transition");
  advance(5000);
  assert.deepEqual(p.getSnapshot(), paused);
  p.play();
  advance(12000);
  assert.equal(p.getSnapshot().cursor, 4);
});

test("next executes exactly one transition", () => {
  const p = player("1101");
  p.next();
  advance(5000);
  assert.equal(p.getSnapshot().cursor, 1);
  assert.equal(p.getSnapshot().mode, "stopped");
});

test("next during a running step lands it and starts one more", () => {
  const p = player("1101");
  p.next();
  advance(300);
  p.next();
  assert.equal(p.getSnapshot().cursor, 1);
  advance(5000);
  assert.equal(p.getSnapshot().cursor, 2);
});

test("previous restores the earlier state and input position", () => {
  const p = player("1101");
  p.seek(4);
  assert.equal(deriveView(p.getSnapshot()).activeStates[0], "q2");
  p.previous();
  advance(1000);
  const view = deriveView(p.getSnapshot());
  assert.equal(p.getSnapshot().cursor, 3);
  assert.equal(view.activeStates[0], "q1");
  assert.equal(view.consumed, 3);
  assert.equal(view.verdict, null);
});

test("previous mid-flight returns to the start of that step", () => {
  const p = player("1101");
  p.next();
  advance(700);
  p.pause();
  p.previous();
  advance(1000);
  assert.equal(p.getSnapshot().cursor, 0);
  assert.equal(p.getSnapshot().phase, "ready");
});

test("speed changes the real duration", () => {
  const measure = (speed: "slow" | "normal" | "fast") => {
    const p = player("1");
    p.setSpeed(speed);
    p.play();
    let elapsed = 0;
    while (p.getSnapshot().mode === "playing") {
      advance(16);
      elapsed += 16;
    }
    return elapsed;
  };
  const slow = measure("slow");
  const normal = measure("normal");
  const fast = measure("fast");
  assert.ok(slow > normal * 1.8, `${slow} vs ${normal}`);
  assert.ok(fast < normal * 0.55, `${fast} vs ${normal}`);
});

test("restart clears everything", () => {
  const p = player("1101");
  p.seek(3);
  p.restart();
  const snap = p.getSnapshot();
  assert.equal(snap.cursor, 0);
  assert.equal(snap.furthest, 0);
  assert.equal(deriveView(snap).activeStates[0], "q0");
});

test("empty input is evaluated and rejected on play", () => {
  const p = player("");
  assert.equal(deriveView(p.getSnapshot()).verdict, null);
  p.play();
  assert.equal(deriveView(p.getSnapshot()).verdict, "rejected");
});

test("two machines replay in lockstep on one clock", () => {
  const trace = dfaTrace(simulate(ENDS_IN_01, "01"));
  const p = new SimulationPlayer([trace, trace]);
  p.play();
  advance(6000);
  assert.equal(p.getSnapshot().cursor, 2);
  assert.equal(deriveView(p.getSnapshot(), 0).verdict, deriveView(p.getSnapshot(), 1).verdict);
  assert.equal(peakQueued, 1);
});
