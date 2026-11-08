"use client";

import { useCallback, useEffect, useState } from "react";

/** Advances an index while `running`, until the person picks an item themselves. */
export function useAutoCycle(count: number, running: boolean, intervalMs: number) {
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!running || held) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % count), intervalMs);
    return () => window.clearInterval(timer);
  }, [count, running, held, intervalMs]);

  const select = useCallback((next: number) => {
    setHeld(true);
    setIndex(next);
  }, []);

  return { index, select };
}
