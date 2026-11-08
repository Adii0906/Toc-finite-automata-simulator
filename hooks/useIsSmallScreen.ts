"use client";

import { useSyncExternalStore } from "react";

const SMALL_SCREEN = "(max-width: 639px)";

export function useIsSmallScreen() {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(SMALL_SCREEN);
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia(SMALL_SCREEN).matches,
    () => false,
  );
}
