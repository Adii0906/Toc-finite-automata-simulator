"use client";

import { motion } from "framer-motion";
import type { Ref } from "react";
import type { EdgeGeometry } from "@/lib/graph-layout";
import type { EdgeStatus } from "@/lib/simulation-view";

const LINE: Record<EdgeStatus, string> = {
  idle: "rgb(196 187 242 / 0.5)",
  running: "rgb(53 226 242 / 0.5)",
  settled: "rgb(53 226 242 / 0.85)",
};

const ARROW: Record<EdgeStatus, string> = {
  idle: "rgb(196 187 242 / 0.8)",
  running: "#35E2F2",
  settled: "#35E2F2",
};

interface TransitionEdgeProps {
  edge: EdgeGeometry;
  status: EdgeStatus;
  label: string;
  labelLit: boolean;
  labelSize: number;
  fadeIn: boolean;
  fadeDelay: number;
  pathRef: Ref<SVGPathElement>;
  litRef: Ref<SVGPathElement>;
}

export function TransitionEdge({ edge, status, label, labelLit, labelSize, fadeIn, fadeDelay, pathRef, litRef }: TransitionEdgeProps) {
  const isHot = status !== "idle";

  return (
    <motion.g
      data-transition-id={edge.id}
      data-status={status}
      initial={fadeIn ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, delay: fadeDelay }}
    >
      {/*
        The path keeps its full length so the particle can reach the arrow tip.
        The dash stops the stroke just short of the tip so it stays sharp.
      */}
      <path
        ref={pathRef}
        className="edge-line"
        data-edge-path={edge.id}
        d={edge.d}
        fill="none"
        pathLength={1000}
        strokeDasharray="982 1000"
        stroke={LINE[status]}
        strokeWidth={isHot ? 2.5 : 1.5}
      />
      <path ref={litRef} d={edge.d} fill="none" stroke="#35E2F2" strokeWidth={3} strokeDasharray="0 99999" />
      <polygon className="edge-arrow" points={edge.arrowPoints} fill={ARROW[status]} />
      <text
        className="edge-label"
        data-edge-label={edge.id}
        x={edge.labelAt.x}
        y={edge.labelAt.y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="var(--font-math)"
        fontSize={labelSize}
        fill={labelLit ? "#FFB46B" : isHot ? "#F4F2FC" : "#C4BBF2"}
        stroke="#0D1033"
        strokeOpacity={0.72}
        strokeWidth={5}
        strokeLinejoin="round"
        paintOrder="stroke"
      >
        {label}
      </text>
    </motion.g>
  );
}
