import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { ConversionPlayer } from "./conversion-player";
import { CONTAINS_01 } from "./nfa-presets";
import { subsetConstruction } from "./subset-construction";

let now = 0;
let queued: FrameRequestCallback[] = [];

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
  Object.assign(globalThis, {
    performance: { now: () => now },
    requestAnimationFrame: (callback: FrameRequestCallback) => queued.push(callback),
    cancelAnimationFrame: () => {
      queued = [];
    },
  });
});

const setup = () => {
  const player = new ConversionPlayer();
  const result = subsetConstruction(CONTAINS_01);
  player.load(result);
  return { player, result, last: result.events.length - 1 };
};

test("play reaches the last event and marks completion", () => {
  const { player, last } = setup();
  player.setSpeed("fast");
  player.play();
  advance(60000);
  assert.equal(player.getSnapshot().index, last);
  assert.equal(player.getSnapshot().mode, "stopped");
  assert.equal(player.getSnapshot().completed, true);
});

test("next shows exactly one event", () => {
  const { player } = setup();
  player.next();
  advance(5000);
  assert.equal(player.getSnapshot().index, 0);
  player.next();
  advance(5000);
  assert.equal(player.getSnapshot().index, 1);
});

test("previous goes back exactly one and stops at the first event", () => {
  const { player } = setup();
  player.seek(5);
  player.previous();
  assert.equal(player.getSnapshot().index, 4);
  player.seek(0);
  player.previous();
  assert.equal(player.getSnapshot().index, 0);
});

test("pause holds and resume continues", () => {
  const { player } = setup();
  player.play();
  advance(1500);
  player.pause();
  const held = player.getSnapshot();
  advance(4000);
  assert.deepEqual(player.getSnapshot(), held);
  player.play();
  advance(3000);
  assert.ok(player.getSnapshot().index > held.index);
});

test("restart returns to the first event without losing the result", () => {
  const { player, result } = setup();
  player.seek(10);
  player.restart();
  assert.equal(player.getSnapshot().index, 0);
  assert.equal(player.getSnapshot().result, result);
});

test("speed changes real duration", () => {
  const time = (speed: "slow" | "fast") => {
    const { player } = setup();
    player.setSpeed(speed);
    player.play();
    let elapsed = 0;
    while (player.getSnapshot().mode === "playing") {
      advance(16);
      elapsed += 16;
    }
    return elapsed;
  };
  assert.ok(time("slow") > time("fast") * 3.5);
});

test("compute events send one particle per NFA move", () => {
  const { player, result } = setup();
  const index = result.events.findIndex((e) => e.kind === "compute" && e.symbol === "0");
  let seen = 0;
  player.subscribeNFA((particles) => {
    seen = Math.max(seen, particles.length);
  });
  player.seek(index - 1);
  player.next();
  advance(400);
  assert.equal(seen, 2);
});
