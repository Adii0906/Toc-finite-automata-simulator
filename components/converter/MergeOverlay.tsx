"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";

interface MergeOverlayProps {
  stage: RefObject<HTMLDivElement | null>;
  /** NFA states whose tokens fly across. Empty when nothing merges. */
  members: readonly string[];
  /** The DFA state they become. */
  target: string | null;
  /** Changes for each event so positions are measured afresh. */
  eventKey: number;
  subscribe: (listener: (t: number | null) => void) => () => void;
}

/**
 * The moment the algorithm is really about: each NFA state in the union sends a
 * token across the page, and the tokens land together on one DFA state.
 */
export function MergeOverlay({ stage, members, target, eventKey, subscribe }: MergeOverlayProps) {
  const [paths, setPaths] = useState<{ member: string; d: string }[]>([]);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const tokenRefs = useRef<(SVGCircleElement | null)[]>([]);

  useLayoutEffect(() => {
    const root = stage.current;
    if (!root || !target || members.length === 0) {
      setPaths([]);
      return;
    }
    const box = root.getBoundingClientRect();
    const centre = (selector: string) => {
      const rect = root.querySelector(selector)?.getBoundingClientRect();
      return rect ? { x: rect.left + rect.width / 2 - box.left, y: rect.top + rect.height / 2 - box.top } : null;
    };
    const destination = centre(`[data-diagram="dfa"] [data-state="${target}"] .state-body`);
    if (!destination) {
      setPaths([]);
      return;
    }
    setPaths(
      members.flatMap((member) => {
        const origin = centre(`[data-diagram="nfa"] [data-state="${member}"] .state-body`);
        if (!origin) return [];
        const lift = Math.min(90, Math.hypot(destination.x - origin.x, destination.y - origin.y) * 0.22);
        const control = { x: (origin.x + destination.x) / 2, y: (origin.y + destination.y) / 2 - lift };
        return [{ member, d: `M ${origin.x} ${origin.y} Q ${control.x} ${control.y} ${destination.x} ${destination.y}` }];
      }),
    );
    // Node positions only change between events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventKey, target, members.join("|")]);

  useEffect(
    () =>
      subscribe((t) => {
        tokenRefs.current.forEach((token, index) => {
          const path = pathRefs.current[index];
          if (!token || !path) return;
          if (t === null) {
            token.style.opacity = "0";
            return;
          }
          const point = path.getPointAtLength(t * path.getTotalLength());
          token.setAttribute("cx", String(point.x));
          token.setAttribute("cy", String(point.y));
          token.style.opacity = "1";
        });
      }),
    [subscribe, paths],
  );

  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 z-10 size-full overflow-visible">
      {paths.map(({ member, d }, index) => (
        <g key={member}>
          <path
            ref={(el) => {
              pathRefs.current[index] = el;
            }}
            d={d}
            fill="none"
          />
          <circle
            ref={(el) => {
              tokenRefs.current[index] = el;
            }}
            data-merge-token={member}
            r={8}
            fill="#FFB46B"
            stroke="#0D1033"
            strokeWidth={2}
            style={{ opacity: 0 }}
          />
        </g>
      ))}
    </svg>
  );
}
