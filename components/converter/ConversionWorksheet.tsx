"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import type { NFA } from "@/lib/nfa-types";
import type { ConversionState } from "@/lib/conversion-view";
import type { ConversionEvent, MemberMove } from "@/lib/subset-construction";
import { SetOf, StateName } from "../Math";

function Line({ label, children, strong = false }: { label: ReactNode; children?: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex flex-wrap items-baseline gap-x-2 ${strong ? "mt-1 text-[1.25rem] font-semibold" : ""}`}>
      <span className={strong ? "" : "text-muted"}>{label}</span>
      {children !== undefined && <span className={strong ? "" : "text-[1.125rem]"}>{children}</span>}
    </div>
  );
}

function Moves({ perMember, symbol }: { perMember: MemberMove[]; symbol: string }) {
  return (
    <>
      {perMember.map(({ member, targets }) => (
        <Line
          key={member}
          label={
            <>
              From <StateName id={member} /> on <span className="math text-amber">{symbol}</span>:
            </>
          }
        >
          <SetOf members={targets} />
        </Line>
      ))}
    </>
  );
}

function body(event: ConversionEvent, nfa: NFA): ReactNode {
  switch (event.kind) {
    case "intro":
      return (
        <p>
          This is the NFA. It can be in several states at the same time, so a single DFA state has to remember a whole set of NFA
          states. Each set we discover becomes one DFA state.
        </p>
      );
    case "initial":
      return (
        <>
          <Line label="Initial DFA state:">
            <SetOf members={event.subset} />
          </Line>
          <p className="mt-1">
            The DFA starts in the set containing only the NFA's initial state, <StateName id={nfa.initial} />.
          </p>
        </>
      );
    case "select":
      return (
        <>
          <Line label="Current DFA state:">
            <SetOf members={event.subset} />
          </Line>
          <p className="mt-1">
            Next we work out where this whole set goes on each of the {nfa.alphabet.length} input symbols.
          </p>
        </>
      );
    case "compute":
    case "link":
      return (
        <>
          <Line label="Current DFA state:">
            <SetOf members={event.subset} />
          </Line>
          <Line label="Input symbol:">
            <span className="math text-amber">{event.symbol}</span>
          </Line>
          <Moves perMember={event.perMember} symbol={event.symbol} />
          <Line label="Union of destinations:">
            <SetOf members={event.union} />
          </Line>
          {event.kind === "link" && (
            <>
              <Line strong label="Therefore, the next DFA state is">
                <SetOf members={event.union} />
              </Line>
              <p className="mt-1 text-amber" data-link-note>
                {event.isDead
                  ? event.isNew
                    ? "No NFA state can continue, so this is the dead state. Once the DFA enters it, the string can never be accepted."
                    : "No NFA state can continue, so this goes to the dead state that already exists."
                  : event.isNew
                    ? event.union.length > 1
                      ? "This set is new, so it becomes a new DFA state. Several NFA states merge into one DFA state here."
                      : "This set is new, so it becomes a new DFA state."
                    : "This set already exists, so no new state is created. We only add an arrow."}
              </p>
            </>
          )}
        </>
      );
    case "accepting":
      return event.accepting.length === 0 ? (
        <p>No reachable subset contains an accepting NFA state, so this DFA accepts nothing.</p>
      ) : (
        <>
          <p className="mb-1">A DFA state accepts if its set contains at least one accepting NFA state.</p>
          {event.accepting.map(({ state, via }) => (
            <Line key={state} label={<StateName id={state} />}>
              <span className="text-[1rem]">
                contains <SetOf members={via} />
              </span>
            </Line>
          ))}
        </>
      );
    case "done":
      return (
        <p>
          No unprocessed subsets remain, so the DFA is complete with {event.stateCount} state{event.stateCount === 1 ? "" : "s"}.
          Every DFA state is one set of NFA states the NFA could be in at the same moment.
        </p>
      );
  }
}

export function ConversionWorksheet({ state, nfa, eventIndex }: { state: ConversionState; nfa: NFA; eventIndex: number }) {
  return (
    <div className="lg:min-h-[9rem]" aria-live="polite" data-worksheet>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={eventIndex}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          className="text-[1.0625rem] leading-relaxed"
        >
          {state.event ? body(state.event, nfa) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
