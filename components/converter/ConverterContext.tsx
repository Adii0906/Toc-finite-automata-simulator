"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { ConversionPlayer, type ConversionSnapshot } from "@/lib/conversion-player";
import { draftFromNFA, parseDraft, type NFADraft } from "@/lib/nfa-draft";
import { CONTAINS_01, NFA_PRESETS } from "@/lib/nfa-presets";
import type { NFA } from "@/lib/nfa-types";
import { subsetConstruction } from "@/lib/subset-construction";

interface ConverterValue {
  draft: NFADraft;
  errors: string[];
  /** The latest valid NFA, shown even while the draft is mid-edit. */
  nfa: NFA;
  presetId: string | null;
  player: ConversionPlayer;
  snapshot: ConversionSnapshot;
  updateDraft: (draft: NFADraft) => void;
  choosePreset: (id: string) => void;
  convert: () => void;
  edit: () => void;
}

const ConverterContext = createContext<ConverterValue | null>(null);

export function useConverter() {
  const value = useContext(ConverterContext);
  if (!value) throw new Error("useConverter must be used inside ConverterProvider.");
  return value;
}

export function ConverterProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<NFADraft>(() => draftFromNFA(CONTAINS_01));
  const [errors, setErrors] = useState<string[]>([]);
  const [nfa, setNfa] = useState<NFA>(CONTAINS_01);
  const [presetId, setPresetId] = useState<string | null>(NFA_PRESETS[0].id);
  const [player] = useState(() => new ConversionPlayer());
  const snapshot = useSyncExternalStore(player.subscribe, player.getSnapshot, player.getSnapshot);

  const updateDraft = useCallback(
    (next: NFADraft) => {
      setDraft(next);
      setPresetId(null);
      const parsed = parseDraft(next);
      setErrors(parsed.errors);
      if (parsed.nfa) setNfa(parsed.nfa);
      player.load(null);
    },
    [player],
  );

  const choosePreset = useCallback(
    (id: string) => {
      const preset = NFA_PRESETS.find((candidate) => candidate.id === id);
      if (!preset) return;
      setDraft(draftFromNFA(preset.nfa));
      setErrors([]);
      setNfa(preset.nfa);
      setPresetId(id);
      player.load(null);
    },
    [player],
  );

  const convert = useCallback(() => {
    const parsed = parseDraft(draft);
    if (!parsed.nfa) {
      setErrors(parsed.errors);
      return;
    }
    player.load(subsetConstruction(parsed.nfa));
    player.play();
  }, [draft, player]);

  const edit = useCallback(() => player.load(null), [player]);

  const value = useMemo(
    () => ({ draft, errors, nfa, presetId, player, snapshot, updateDraft, choosePreset, convert, edit }),
    [draft, errors, nfa, presetId, player, snapshot, updateDraft, choosePreset, convert, edit],
  );

  return <ConverterContext.Provider value={value}>{children}</ConverterContext.Provider>;
}
