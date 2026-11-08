"use client";

import { motion } from "framer-motion";
import type { Ref } from "react";
import type { Point } from "@/lib/graph-layout";
import type { NodeTone } from "@/lib/simulation-view";

const STROKE: Record<NodeTone, string> = {
  idle: "rgb(196 187 242 / 0.6)",
  lit: "#8DB2FF",
  active: "#D6E3FF",
  reached: "#FFB46B",
  stranded: "#FF7F8E",
  accepted: "#C2FAE3",
  rejected: "#FFD0D6",
};

const FILL: Record<NodeTone, string> = {
  idle: "#1B1E5C",
  lit: "#2A2F86",
  active: "#8DB2FF",
  reached: "#5A3B55",
  stranded: "#4A2150",
  accepted: "#62EDB5",
  rejected: "#FF7F8E",
};

const TEXT: Record<NodeTone, string> = {
  idle: "#F4F2FC",
  lit: "#F4F2FC",
  active: "#0D1033",
  reached: "#FFE3C4",
  stranded: "#FFD0D6",
  accepted: "#0D1033",
  rejected: "#0D1033",
};

const GLOW: Partial<Record<NodeTone, string>> = {
  active: "blue",
  reached: "warm",
  accepted: "ok",
  rejected: "no",
};

interface Segment {
  text: string;
  italic: boolean;
  sub: boolean;
}

function tokenSegments(name: string): Segment[] {
  const match = /^([a-zA-Z]+)(\d+)$/.exec(name);
  if (!match) return [{ text: name, italic: true, sub: false }];
  return [
    { text: match[1], italic: true, sub: false },
    { text: match[2], italic: false, sub: true },
  ];
}

const plain = (text: string): Segment => ({ text, italic: false, sub: false });

/** Breaks a state name into lines that fit inside the circle. */
function labelLines(id: string): { lines: Segment[][]; scale: number } {
  if (id === "∅") return { lines: [[plain("∅")]], scale: 1 };
  if (!id.startsWith("{")) return { lines: [tokenSegments(id)], scale: 1 };

  const members = id.slice(1, -1).split(",");
  const lines: Segment[][] = [];
  for (let i = 0; i < members.length; i += 2) {
    const line: Segment[] = i === 0 ? [plain("{")] : [];
    members.slice(i, i + 2).forEach((member, offset) => {
      if (offset > 0) line.push(plain(", "));
      line.push(...tokenSegments(member));
    });
    line.push(plain(i + 2 < members.length ? "," : "}"));
    lines.push(line);
  }
  return { lines, scale: lines.length === 1 ? (members.length === 1 ? 0.86 : 0.72) : lines.length === 2 ? 0.68 : 0.56 };
}

function Label({ id, at, size, fill }: { id: string; at: Point; size: number; fill: string }) {
  const { lines, scale } = labelLines(id);
  const fontSize = size * scale;
  const lineHeight = fontSize * 1.14;
  const top = at.y - ((lines.length - 1) * lineHeight) / 2 + fontSize * 0.28;

  return (
    <>
      {lines.map((line, lineIndex) => {
        let offset = 0;
        return (
          <text
            key={lineIndex}
            className="state-label"
            x={at.x}
            y={top + lineIndex * lineHeight}
            textAnchor="middle"
            fill={fill}
            fontFamily="var(--font-math)"
            fontSize={fontSize}
          >
            {line.map((segment, index) => {
              const target = segment.sub ? fontSize * 0.22 : 0;
              const dy = target - offset;
              offset = target;
              return (
                <tspan
                  key={index}
                  dy={dy}
                  fontStyle={segment.italic ? "italic" : "normal"}
                  fontSize={segment.sub ? fontSize * 0.68 : undefined}
                >
                  {segment.text}
                </tspan>
              );
            })}
          </text>
        );
      })}
    </>
  );
}

interface StateNodeProps {
  id: string;
  at: Point;
  radius: number;
  accepting: boolean;
  dead: boolean;
  tone: NodeTone;
  arriving: boolean;
  ripple: boolean;
  pulseSeconds: number;
  gradientId: string;
  labelSize: number;
  /** Seconds to wait before this state pops into existence, or null if it exists. */
  popDelay: number | null;
  haloRef: Ref<SVGCircleElement>;
}

export function StateNode({
  id,
  at,
  radius,
  accepting,
  dead,
  tone,
  arriving,
  ripple,
  pulseSeconds,
  gradientId,
  labelSize,
  popDelay,
  haloRef,
}: StateNodeProps) {
  const emphasized = tone === "active" || tone === "accepted" || tone === "rejected";
  const ring = STROKE[tone];
  const glow = GLOW[tone];

  return (
    <motion.g
      data-state={id}
      data-tone={tone}
      data-dead={dead || undefined}
      data-accepting={accepting || undefined}
      initial={popDelay === null ? false : { scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 20, delay: popDelay ?? 0 }}
    >
      <circle
        className="state-shape"
        cx={at.x}
        cy={at.y}
        r={radius * 1.7}
        fill={glow ? `url(#${gradientId}-${glow})` : "none"}
        opacity={glow ? 1 : 0}
      />

      {arriving && (
        <motion.circle
          cx={at.x}
          cy={at.y}
          r={radius}
          fill="none"
          stroke="#8DB2FF"
          strokeWidth={2}
          initial={{ scale: 1, opacity: 0.85 }}
          animate={{ scale: 1.42, opacity: 0 }}
          transition={{ duration: pulseSeconds, ease: "easeOut" }}
        />
      )}

      {ripple &&
        [0, 0.28].map((delay) => (
          <motion.circle
            key={delay}
            cx={at.x}
            cy={at.y}
            r={radius}
            fill="none"
            stroke={FILL[tone]}
            strokeWidth={1.5}
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 1.7, opacity: 0 }}
            transition={{ duration: 1.1, delay, ease: "easeOut" }}
          />
        ))}

      <motion.g
        animate={{ scale: emphasized ? 1.06 : 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 20 }}
      >
        {/* Brightened directly by the particle as it closes on this state. */}
        <circle ref={haloRef} cx={at.x} cy={at.y} r={radius + 7} fill="none" stroke="#35E2F2" strokeWidth={3} opacity={0} />
        <circle
          className="state-shape state-body"
          cx={at.x}
          cy={at.y}
          r={radius}
          fill={dead && tone === "idle" ? "#15163F" : FILL[tone]}
          stroke={ring}
          strokeWidth={emphasized ? 2.5 : tone === "idle" ? 1.5 : 2}
          strokeDasharray={dead ? "6 5" : undefined}
        />
        {accepting && (
          <circle
            className="state-shape"
            cx={at.x}
            cy={at.y}
            r={radius - 6.5}
            fill="none"
            stroke={emphasized ? "#0D1033" : ring}
            strokeWidth={1.5}
          />
        )}
        <Label id={id} at={at} size={labelSize} fill={TEXT[tone]} />
      </motion.g>
    </motion.g>
  );
}
