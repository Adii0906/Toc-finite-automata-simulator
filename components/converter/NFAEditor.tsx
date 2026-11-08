"use client";

import { splitList } from "@/lib/nfa-draft";
import { NFA_PRESETS } from "@/lib/nfa-presets";
import { StateName } from "../Math";
import { useConverter } from "./ConverterContext";

const fieldClass = "h-10 w-full rounded-[3px] border border-line bg-midnight/60 px-3";

export function NFAEditor() {
  const { draft, errors, presetId, updateDraft, choosePreset, convert } = useConverter();
  const states = splitList(draft.statesText);
  const alphabet = splitList(draft.alphabetText);

  const toggle = (list: string[], item: string) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  const toggleTarget = (state: string, symbol: string, target: string) => {
    const row = draft.transitions[state] ?? {};
    updateDraft({
      ...draft,
      transitions: { ...draft.transitions, [state]: { ...row, [symbol]: toggle(row[symbol] ?? [], target) } },
    });
  };

  return (
    <div className="flex h-full flex-col gap-3" data-nfa-editor>
      <div>
        <p className="mb-1 text-[0.9375rem] text-muted">Start from an example, or change anything below</p>
        <div className="flex flex-wrap gap-1.5">
          {NFA_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              data-preset={preset.id}
              onClick={() => choosePreset(preset.id)}
              className={`rounded-[3px] border px-2.5 py-1 text-[0.9375rem] transition-colors ${
                presetId === preset.id ? "border-amber text-fg" : "border-line text-muted hover:text-fg"
              }`}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-[0.9375rem] text-muted">
          States, separated by commas
          <input
            data-field="states"
            className={`${fieldClass} mt-0.5 text-fg`}
            value={draft.statesText}
            spellCheck={false}
            onChange={(event) => updateDraft({ ...draft, statesText: event.target.value })}
          />
        </label>
        <label className="text-[0.9375rem] text-muted">
          Input alphabet
          <input
            data-field="alphabet"
            className={`${fieldClass} mt-0.5 text-fg`}
            value={draft.alphabetText}
            spellCheck={false}
            onChange={(event) => updateDraft({ ...draft, alphabetText: event.target.value })}
          />
        </label>
        <label className="text-[0.9375rem] text-muted">
          Initial state
          <select
            data-field="initial"
            className={`${fieldClass} mt-0.5 text-fg`}
            value={states.includes(draft.initial) ? draft.initial : ""}
            onChange={(event) => updateDraft({ ...draft, initial: event.target.value })}
          >
            <option value="" disabled>
              Choose
            </option>
            {states.map((state) => (
              <option key={state} value={state} className="bg-midnight">
                {state}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="text-[0.9375rem] text-muted">
          <legend>Accepting states</legend>
          <div className="mt-0.5 flex min-h-10 flex-wrap items-center gap-1">
            {states.map((state) => (
              <button
                key={state}
                type="button"
                aria-pressed={draft.accepting.includes(state)}
                data-accepting-toggle={state}
                onClick={() => updateDraft({ ...draft, accepting: toggle(draft.accepting, state) })}
                className={`h-8 rounded-[3px] border px-2 text-fg transition-colors ${
                  draft.accepting.includes(state) ? "border-ok bg-ok/20" : "border-line"
                }`}
              >
                <StateName id={state} />
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-[0.9375rem]" aria-label="Transitions">
          <caption className="pb-1 text-left text-muted">Transitions: press every state each symbol can lead to</caption>
          <thead>
            <tr className="border-b border-line text-muted">
              <th className="py-1 pr-3 text-left font-normal">State</th>
              {alphabet.map((symbol) => (
                <th key={symbol} className="py-1 pr-3 text-left font-normal">
                  Input <span className="math">{symbol}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {states.map((state) => (
              <tr key={state} className="border-b border-line">
                <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                  <StateName id={state} />
                </th>
                {alphabet.map((symbol) => (
                  <td key={symbol} className="py-1.5 pr-3">
                    <div className="flex flex-wrap gap-1">
                      {states.map((target) => {
                        const on = draft.transitions[state]?.[symbol]?.includes(target) ?? false;
                        return (
                          <button
                            key={target}
                            type="button"
                            aria-pressed={on}
                            aria-label={`${state} on ${symbol} goes to ${target}`}
                            data-target={`${state}|${symbol}|${target}`}
                            onClick={() => toggleTarget(state, symbol, target)}
                            className={`h-7 rounded-[3px] border px-1.5 transition-colors ${
                              on ? "border-cyan bg-cyan/20 text-fg" : "border-line text-muted/70 hover:text-fg"
                            }`}
                          >
                            <StateName id={target} />
                          </button>
                        );
                      })}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[0.9375rem] text-amber" data-limitation>
        This version handles ordinary NFA transitions only. ε-moves are not supported.
      </p>

      {errors.length > 0 && (
        <ul role="alert" className="text-[0.9375rem] text-no" data-editor-errors>
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      <button
        type="button"
        data-convert
        disabled={errors.length > 0}
        onClick={convert}
        className="h-12 shrink-0 rounded-[3px] bg-amber px-6 font-semibold text-midnight transition-colors hover:bg-[#ffc78d] disabled:pointer-events-none disabled:opacity-40"
      >
        Convert to DFA
      </button>
    </div>
  );
}
