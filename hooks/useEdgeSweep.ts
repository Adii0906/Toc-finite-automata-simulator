"use client";

import { useCallback, useEffect, useRef } from "react";
import { easeInOut } from "@/lib/frame-loop";
import type { FrameListener } from "@/lib/playback";

/** Repeatedly sends a particle along one edge, for the small explanatory figures. */
export function useEdgeSweep(edgeId: string | null, active: boolean, periodMs = 1500) {
  const listener = useRef<FrameListener | null>(null);

  useEffect(() => {
    const emit = (particles: Parameters<FrameListener>[0]) => listener.current?.(particles);
    if (!edgeId || !active) {
      emit([]);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      emit([{ edgeId, t: 0.6 }]);
      return;
    }

    let raf = 0;
    const started = performance.now();
    const loop = (now: number) => {
      const elapsed = (now - started) % (periodMs + 500);
      emit(elapsed <= periodMs ? [{ edgeId, t: easeInOut(elapsed / periodMs) }] : []);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      emit([]);
    };
  }, [edgeId, active, periodMs]);

  return useCallback((next: FrameListener) => {
    listener.current = next;
    return () => {
      listener.current = null;
    };
  }, []);
}
