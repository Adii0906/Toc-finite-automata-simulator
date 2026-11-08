"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { MachineTrace } from "@/lib/machine-trace";
import { SimulationPlayer } from "@/lib/playback";

export function useSimulationPlayer(initial: readonly MachineTrace[]) {
  const [player] = useState(() => new SimulationPlayer(initial));
  const snapshot = useSyncExternalStore(player.subscribe, player.getSnapshot, player.getSnapshot);

  useEffect(() => () => player.halt(), [player]);

  return { player, snapshot };
}
