"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import { buildGraph, type DiagramModel, type GraphLayout } from "@/lib/graph-layout";
import type { FrameListener } from "@/lib/playback";
import type { GraphView } from "@/lib/simulation-view";
import { StateNode } from "./StateNode";
import { TransitionEdge } from "./TransitionEdge";

interface AutomataGraphProps {
  model: DiagramModel;
  layout?: GraphLayout;
  view: GraphView;
  subscribeFrames?: (listener: FrameListener) => () => void;
  /** Duration of colour changes, in milliseconds. */
  beatMs?: number;
  /** Scales labels up for small renderings. */
  compact?: boolean;
  title: string;
  className?: string;
}

const TAIL_OFFSETS = [0.02, 0.04, 0.06, 0.085, 0.11];
const MAX_PARTICLES = 24;
const SVG_NS_HIDDEN_DASH = "0 99999";

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

export function AutomataGraph({
  model,
  layout,
  view,
  subscribeFrames,
  beatMs = 260,
  compact = false,
  title,
  className,
}: AutomataGraphProps) {
  const graph = useMemo(() => buildGraph(model, layout), [model, layout]);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  const svgRef = useRef<SVGSVGElement>(null);
  const pathRefs = useRef(new Map<string, SVGPathElement>());
  const litRefs = useRef(new Map<string, SVGPathElement>());
  const haloRefs = useRef(new Map<string, SVGCircleElement>());
  const particleRefs = useRef<(SVGGElement | null)[]>([]);
  const tailRefs = useRef<(SVGGElement | null)[]>([]);
  const targetOf = useMemo(() => new Map(graph.edges.map((edge) => [edge.id, edge.to])), [graph]);

  const poolSize = Math.min(graph.edges.length, MAX_PARTICLES);

  useEffect(() => {
    if (!subscribeFrames) return;
    const litEdges = new Set<SVGPathElement>();
    const litHalos = new Set<SVGCircleElement>();

    return subscribeFrames((particles) => {
      // Geometry is unavailable while the view is hidden.
      if (!svgRef.current || svgRef.current.getClientRects().length === 0) return;

      const nextLit = new Set<SVGPathElement>();
      const nextHalos = new Map<SVGCircleElement, number>();

      particleRefs.current.forEach((particle, index) => {
        const tail = tailRefs.current[index];
        if (!particle || !tail) return;
        const frame = particles[index];
        const path = frame && pathRefs.current.get(frame.edgeId);
        const lit = frame && litRefs.current.get(frame.edgeId);
        if (!frame || !path || !lit) {
          particle.style.opacity = "0";
          tail.style.opacity = "0";
          return;
        }

        // Positions come from the rendered path, so a particle cannot leave it.
        const length = path.getTotalLength();
        const distance = frame.t * length;
        const head = path.getPointAtLength(distance);

        particle.setAttribute("transform", `translate(${head.x} ${head.y})`);
        particle.dataset.edge = frame.edgeId;
        particle.dataset.t = frame.t.toFixed(4);
        particle.style.opacity = "1";

        const tag = particle.lastElementChild;
        if (tag && tag.textContent !== (frame.symbol ?? "")) tag.textContent = frame.symbol ?? "";

        Array.from(tail.children).forEach((dot, dotIndex) => {
          const trailing = Math.max(0, frame.t - TAIL_OFFSETS[dotIndex] * (compact ? 1.2 : 1));
          const point = path.getPointAtLength(trailing * length);
          dot.setAttribute("cx", String(point.x));
          dot.setAttribute("cy", String(point.y));
        });
        tail.style.opacity = "1";

        lit.setAttribute("stroke-dasharray", `${Math.max(0, distance - 12)} ${length}`);
        nextLit.add(lit);

        const destination = targetOf.get(frame.edgeId);
        const halo = destination ? haloRefs.current.get(destination) : undefined;
        if (halo) nextHalos.set(halo, Math.max(nextHalos.get(halo) ?? 0, smoothstep(0.7, 1, frame.t)));
      });

      litEdges.forEach((lit) => {
        if (!nextLit.has(lit)) lit.setAttribute("stroke-dasharray", SVG_NS_HIDDEN_DASH);
      });
      litEdges.clear();
      nextLit.forEach((lit) => litEdges.add(lit));

      litHalos.forEach((halo) => {
        if (!nextHalos.has(halo)) halo.setAttribute("opacity", "0");
      });
      litHalos.clear();
      nextHalos.forEach((opacity, halo) => {
        halo.setAttribute("opacity", String(opacity));
        litHalos.add(halo);
      });
    });
  }, [subscribeFrames, compact, targetOf, poolSize]);

  const pulseSeconds = (beatMs * 1.5) / 1000;
  const labelSize = compact ? 34 : 27;
  const edgeLabelSize = compact ? 30 : 23;
  const acceptingSet = view.acceptingVisible ?? model.accepting;
  const coreRadius = compact ? 8 : 5.5;

  const visibleNodes = view.visibleStates
    ? graph.nodes.filter((node) => view.visibleStates!.includes(node.id))
    : graph.nodes;
  const visibleEdges = view.visibleEdges
    ? graph.edges.filter((edge) => view.visibleEdges!.includes(edge.id))
    : graph.edges;
  const hideStart = view.visibleStates && !view.visibleStates.includes(model.initial);
  const growing = view.visibleStates !== undefined;

  return (
    <svg
      ref={svgRef}
      viewBox={graph.viewBox}
      role="img"
      aria-label={title}
      className={className}
      style={{ "--beat": `${beatMs}ms` } as CSSProperties}
    >
      <defs>
        {(
          [
            ["blue", "#8DB2FF"],
            ["warm", "#FFB46B"],
            ["ok", "#62EDB5"],
            ["no", "#FF7F8E"],
          ] as const
        ).map(([name, color]) => (
          <radialGradient key={name} id={`${uid}-${name}`}>
            <stop offset="55%" stopColor={color} stopOpacity={0.26} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </radialGradient>
        ))}
        <radialGradient id={`${uid}-spark`}>
          <stop offset="0%" stopColor="#35E2F2" stopOpacity={0.7} />
          <stop offset="100%" stopColor="#35E2F2" stopOpacity={0} />
        </radialGradient>
      </defs>

      {!hideStart && (
        <g className="start-mark">
          <path
            className="edge-line"
            d={graph.startArrow.d}
            fill="none"
            stroke={view.startLit ? "#FFB46B" : "rgb(196 187 242 / 0.6)"}
            strokeWidth={view.startLit ? 2.5 : 1.5}
          />
          <polygon
            className="edge-arrow"
            points={graph.startArrow.arrowPoints}
            fill={view.startLit ? "#FFB46B" : "rgb(196 187 242 / 0.85)"}
          />
          <text
            x={graph.startArrow.labelAt.x}
            y={graph.startArrow.labelAt.y}
            textAnchor="middle"
            fontSize={compact ? 24 : 17}
            fill="#C4BBF2"
          >
            start
          </text>
        </g>
      )}

      {visibleEdges.map((edge) => (
        <TransitionEdge
          key={edge.id}
          edge={edge}
          status={view.edgeStatus[edge.id] ?? "idle"}
          label={view.edgeLabels?.[edge.id] ?? edge.label}
          labelLit={Boolean(view.labelsLit)}
          labelSize={edgeLabelSize}
          fadeIn={growing}
          fadeDelay={view.popEdge === edge.id ? (view.popDelay ?? 0) : 0}
          pathRef={(el) => {
            if (el) pathRefs.current.set(edge.id, el);
            else pathRefs.current.delete(edge.id);
          }}
          litRef={(el) => {
            if (el) litRefs.current.set(edge.id, el);
            else litRefs.current.delete(edge.id);
          }}
        />
      ))}

      {Array.from({ length: poolSize }, (_, index) => (
        <g key={index}>
          <g
            ref={(el) => {
              tailRefs.current[index] = el;
            }}
            style={{ opacity: 0 }}
          >
            {TAIL_OFFSETS.map((_, dot) => (
              <circle key={dot} r={4 - dot * 0.6} fill="#35E2F2" opacity={0.55 - dot * 0.09} />
            ))}
          </g>
          <g
            ref={(el) => {
              particleRefs.current[index] = el;
            }}
            style={{ opacity: 0 }}
            data-particle=""
          >
            <circle r={coreRadius * 3.1} fill={`url(#${uid}-spark)`} />
            <circle r={coreRadius} fill="#E9FCFF" />
            <text
              y={-coreRadius - 7}
              textAnchor="middle"
              fontFamily="var(--font-math)"
              fontSize={compact ? 26 : 19}
              fill="#FFB46B"
              stroke="#0D1033"
              strokeWidth={4}
              strokeLinejoin="round"
              paintOrder="stroke"
            />
          </g>
        </g>
      ))}

      {visibleNodes.map((node) => (
        <StateNode
          key={node.id}
          id={node.id}
          at={node.at}
          radius={graph.radius}
          accepting={acceptingSet.includes(node.id)}
          dead={model.dead === node.id}
          tone={view.tones[node.id] ?? "idle"}
          arriving={Boolean(view.arriving?.includes(node.id))}
          ripple={Boolean(view.ripple?.includes(node.id))}
          pulseSeconds={pulseSeconds}
          gradientId={uid}
          labelSize={labelSize}
          popDelay={view.popState === node.id ? (view.popDelay ?? 0) : null}
          haloRef={(el) => {
            if (el) haloRefs.current.set(node.id, el);
            else haloRefs.current.delete(node.id);
          }}
        />
      ))}
    </svg>
  );
}
