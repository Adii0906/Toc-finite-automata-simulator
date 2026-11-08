import { transitionId } from "./dfa-engine";
import type { DFA, StateId } from "./dfa-types";
import type { NFA } from "./nfa-types";

export interface Point {
  x: number;
  y: number;
}

/** Any finite automaton, reduced to what a diagram has to draw. */
export interface DiagramModel {
  states: readonly StateId[];
  edges: readonly { from: StateId; to: StateId; symbols: readonly string[] }[];
  initial: StateId;
  accepting: readonly StateId[];
  dead?: StateId | null;
}

export type EdgeRoute =
  | {
      type: "arc";
      /** Angles in degrees on the SVG circle (0 is east, -90 is north). */
      startAngle: number;
      endAngle: number;
      /** Control points sit this far out along the radial direction. */
      tension: number;
      labelOffset: Point;
    }
  | { type: "loop"; angle: number };

export interface GraphLayout {
  viewBox: string;
  radius: number;
  positions: Record<StateId, Point>;
  routes: Record<string, EdgeRoute>;
  /** Direction the start arrow comes from. */
  startFrom: number;
}

export interface EdgeGeometry {
  id: string;
  from: StateId;
  to: StateId;
  label: string;
  isLoop: boolean;
  d: string;
  arrowPoints: string;
  labelAt: Point;
}

export interface GraphGeometry {
  viewBox: string;
  radius: number;
  nodes: { id: StateId; at: Point }[];
  edges: EdgeGeometry[];
  startArrow: { d: string; arrowPoints: string; labelAt: Point };
}

const TIP_GAP = 4;
const ARROW_LENGTH = 13;
const ARROW_HALF_WIDTH = 5.5;
const LOOP_RADIUS = 34;
const ARC_BEND = 24;

const round = (value: number) => Math.round(value * 100) / 100;
const fmt = (p: Point) => `${round(p.x)} ${round(p.y)}`;

function unit(angleDegrees: number): Point {
  const radians = (angleDegrees * Math.PI) / 180;
  return { x: Math.cos(radians), y: Math.sin(radians) };
}

function along(origin: Point, direction: Point, distance: number): Point {
  return { x: origin.x + direction.x * distance, y: origin.y + direction.y * distance };
}

function cubicAt(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

function arrowAt(tip: Point, from: Point): string {
  const length = Math.hypot(tip.x - from.x, tip.y - from.y);
  const dir = { x: (tip.x - from.x) / length, y: (tip.y - from.y) / length };
  const base = along(tip, dir, -ARROW_LENGTH);
  const normal = { x: -dir.y, y: dir.x };
  const left = along(base, normal, ARROW_HALF_WIDTH);
  const right = along(base, normal, -ARROW_HALF_WIDTH);
  return [tip, left, right].map((p) => `${round(p.x)},${round(p.y)}`).join(" ");
}

/**
 * A self-loop is a true circular arc. It leaves and re-enters the state where
 * the loop's circle crosses the state's circle, and always runs clockwise.
 */
function loopGeometry(center: Point, radius: number, angle: number) {
  const dir = unit(angle);
  const reach = radius + TIP_GAP;
  const distance = radius + LOOP_RADIUS * 0.62;
  const loopCenter = along(center, dir, distance);

  const a = (distance * distance + reach * reach - LOOP_RADIUS * LOOP_RADIUS) / (2 * distance);
  const h = Math.sqrt(Math.max(reach * reach - a * a, 0));
  const base = along(center, dir, a);
  const normal = { x: -dir.y, y: dir.x };
  const end = along(base, normal, h);
  const start = along(base, normal, -h);

  const endAngle = Math.atan2(end.y - loopCenter.y, end.x - loopCenter.x);
  const back = endAngle - ARROW_LENGTH / LOOP_RADIUS;
  const arrowTail = {
    x: loopCenter.x + LOOP_RADIUS * Math.cos(back),
    y: loopCenter.y + LOOP_RADIUS * Math.sin(back),
  };

  return {
    d: `M ${fmt(start)} A ${LOOP_RADIUS} ${LOOP_RADIUS} 0 1 1 ${fmt(end)}`,
    arrowPoints: arrowAt(end, arrowTail),
    labelAt: along(loopCenter, dir, LOOP_RADIUS + 16),
  };
}

export function diagramFromDFA(dfa: DFA, dead: StateId | null = null): DiagramModel {
  const edges = new Map<string, { from: StateId; to: StateId; symbols: string[] }>();
  for (const from of dfa.states) {
    for (const symbol of dfa.alphabet) {
      const to = dfa.transitions[from][symbol];
      const id = transitionId(from, to);
      const edge = edges.get(id) ?? { from, to, symbols: [] };
      edge.symbols.push(symbol);
      edges.set(id, edge);
    }
  }
  return { states: dfa.states, edges: [...edges.values()], initial: dfa.initial, accepting: dfa.accepting, dead };
}

export function diagramFromNFA(nfa: NFA): DiagramModel {
  const edges = new Map<string, { from: StateId; to: StateId; symbols: string[] }>();
  for (const from of nfa.states) {
    for (const symbol of nfa.alphabet) {
      for (const to of nfa.transitions[from]?.[symbol] ?? []) {
        const id = transitionId(from, to);
        const edge = edges.get(id) ?? { from, to, symbols: [] };
        edge.symbols.push(symbol);
        edges.set(id, edge);
      }
    }
  }
  return { states: nfa.states, edges: [...edges.values()], initial: nfa.initial, accepting: nfa.accepting };
}

/**
 * Places states clockwise on an ellipse from the left. On convex positions a
 * gently curved edge cannot run through another state, whatever the machine is.
 */
export function autoLayout(model: DiagramModel, radius = 46): GraphLayout {
  const count = model.states.length;
  const spacing = 2 * radius + 96;
  const rx = Math.max(205, (count * spacing) / (2 * Math.PI * 0.86));
  const ry = count <= 2 ? 0 : rx * 0.72;
  const positions: Record<StateId, Point> = {};
  const outward: Record<StateId, number> = {};

  model.states.forEach((id, index) => {
    if (count === 1) {
      positions[id] = { x: 0, y: 0 };
      outward[id] = -90;
      return;
    }
    const angle = 180 + (index * 360) / count;
    const dir = unit(angle);
    positions[id] = { x: round(rx * dir.x), y: round(ry * dir.y) };
    outward[id] = count === 2 ? -90 : (Math.atan2(dir.y / (ry / rx), dir.x) * 180) / Math.PI;
  });

  // The start arrow and a loop on the initial state must not share a direction.
  const startFrom = count === 1 ? 180 : outward[model.initial] - 45;
  outward[model.initial] += count === 1 ? 0 : 50;

  const routes: Record<string, EdgeRoute> = {};
  for (const { from, to } of model.edges) {
    const id = transitionId(from, to);
    if (from === to) {
      routes[id] = { type: "loop", angle: outward[from] };
      continue;
    }
    const a = positions[from];
    const b = positions[to];
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    const heading = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    const side = unit(heading - 90);
    routes[id] = {
      type: "arc",
      startAngle: heading - ARC_BEND,
      endAngle: heading + 180 + ARC_BEND,
      tension: distance * 0.24,
      labelOffset: { x: side.x * 17, y: side.y * 17 },
    };
  }

  // Fit the view to what is actually drawn, so diagrams use their full panel.
  const bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  const include = (p: Point, pad: number) => {
    bounds.left = Math.min(bounds.left, p.x - pad);
    bounds.top = Math.min(bounds.top, p.y - pad);
    bounds.right = Math.max(bounds.right, p.x + pad);
    bounds.bottom = Math.max(bounds.bottom, p.y + pad);
  };
  for (const id of model.states) include(positions[id], radius + 14);
  for (const { from, to } of model.edges) {
    const route = routes[transitionId(from, to)];
    if (route.type === "loop") {
      include(along(positions[from], unit(route.angle), radius + LOOP_RADIUS * 0.62), LOOP_RADIUS + 32);
    } else {
      const a = positions[from];
      const b = positions[to];
      const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      include(along(middle, { x: route.labelOffset.x / 17, y: route.labelOffset.y / 17 }, Math.hypot(b.x - a.x, b.y - a.y) * 0.14 + 34), 8);
    }
  }
  include(along(positions[model.initial], unit(startFrom), radius + TIP_GAP + 66), 40);

  return {
    viewBox: `${round(bounds.left)} ${round(bounds.top)} ${round(bounds.right - bounds.left)} ${round(bounds.bottom - bounds.top)}`,
    radius,
    positions,
    routes,
    startFrom,
  };
}

/** Hand-placed routes for the main three-state simulator. */
export const ENDS_IN_01_LAYOUT: GraphLayout = {
  viewBox: "8 40 884 368",
  radius: 44,
  startFrom: 180,
  positions: {
    q0: { x: 150, y: 190 },
    q1: { x: 450, y: 190 },
    q2: { x: 750, y: 190 },
  },
  routes: {
    [transitionId("q0", "q0")]: { type: "loop", angle: -90 },
    [transitionId("q0", "q1")]: { type: "arc", startAngle: -32, endAngle: -148, tension: 82, labelOffset: { x: -22, y: -14 } },
    [transitionId("q1", "q1")]: { type: "loop", angle: -90 },
    [transitionId("q1", "q2")]: { type: "arc", startAngle: -32, endAngle: -148, tension: 82, labelOffset: { x: 22, y: -14 } },
    [transitionId("q2", "q1")]: { type: "arc", startAngle: 148, endAngle: 32, tension: 70, labelOffset: { x: 0, y: 30 } },
    [transitionId("q2", "q0")]: { type: "arc", startAngle: 112, endAngle: 68, tension: 188, labelOffset: { x: 0, y: 30 } },
  },
};

export function buildGraph(model: DiagramModel, layout: GraphLayout = autoLayout(model)): GraphGeometry {
  const { radius, positions, routes } = layout;

  const edges = model.edges.map(({ from, to, symbols }): EdgeGeometry => {
    const id = transitionId(from, to);
    const route = routes[id];
    if (!route) throw new Error(`No route is defined for edge ${id}.`);
    const label = symbols.join(", ");

    if (route.type === "loop") {
      const loop = loopGeometry(positions[from], radius, route.angle);
      return { id, from, to, label, isLoop: true, d: loop.d, arrowPoints: loop.arrowPoints, labelAt: { x: round(loop.labelAt.x), y: round(loop.labelAt.y) } };
    }

    const startDir = unit(route.startAngle);
    const endDir = unit(route.endAngle);
    const p0 = along(positions[from], startDir, radius);
    const p3 = along(positions[to], endDir, radius + TIP_GAP);
    const p1 = along(p0, startDir, route.tension);
    const p2 = along(p3, endDir, route.tension);
    const middle = cubicAt(p0, p1, p2, p3, 0.5);

    return {
      id,
      from,
      to,
      label,
      isLoop: false,
      d: `M ${fmt(p0)} C ${fmt(p1)} ${fmt(p2)} ${fmt(p3)}`,
      arrowPoints: arrowAt(p3, p2),
      labelAt: { x: round(middle.x + route.labelOffset.x), y: round(middle.y + route.labelOffset.y) },
    };
  });

  const entry = positions[model.initial];
  const inward = unit(layout.startFrom);
  const startTip = along(entry, inward, radius + TIP_GAP);
  const startTail = along(entry, inward, radius + TIP_GAP + 66);

  return {
    viewBox: layout.viewBox,
    radius,
    nodes: model.states.map((id) => ({ id, at: positions[id] })),
    edges,
    startArrow: {
      d: `M ${fmt(startTail)} L ${fmt(startTip)}`,
      arrowPoints: arrowAt(startTip, startTail),
      labelAt:
        Math.abs(inward.y) < 0.3
          ? { x: round(startTail.x + 26), y: round(startTail.y - 12) }
          : (() => {
              const beyond = along(entry, inward, radius + TIP_GAP + 84);
              return { x: round(beyond.x), y: round(beyond.y + 6) };
            })(),
    },
  };
}
