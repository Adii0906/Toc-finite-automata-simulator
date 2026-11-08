# Finite Automata Simulator — TOC Assignment

This project was developed as a Theory of Computation (TOC) assignment. It demonstrates finite automata with a customizable DFA simulator, an NFA-to-DFA converter that runs subset construction step by step, and side-by-side simulation of both machines. Everything runs in the browser.

## TOC concepts demonstrated

- Deterministic and nondeterministic finite automata (DFA and NFA)
- States, alphabets, transition functions, initial states, and accepting states
- Language acceptance and rejection for input strings
- NFA-to-DFA conversion using the subset construction algorithm

## Run it

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

```bash
npm test          # algorithm and playback tests
npm run typecheck
npm run build && npm start
```

## How the code is organised

| Path | Responsibility |
| --- | --- |
| `lib/dfa-engine.ts` | DFA mathematics: validation, δ, `simulate()` |
| `lib/nfa-engine.ts` | NFA mathematics: sets of active states, `simulateNFA()` |
| `lib/subset-construction.ts` | The algorithm. Returns the DFA, its subsets, and a list of recorded events |
| `lib/equivalence.ts` | Runs an NFA and a DFA over every string up to a length |
| `lib/nfa-draft.ts` | Parses and validates what the editor holds |
| `lib/machine-trace.ts` | The common record of a run that any animation replays |
| `lib/playback.ts`, `lib/conversion-player.ts` | Animation clocks. They replay steps and events and compute nothing |
| `lib/simulation-view.ts`, `lib/conversion-view.ts` | Turn playback state into what each diagram should highlight |
| `lib/graph-layout.ts` | Computes every path, arrowhead and label, including automatic layout for any machine |
| `components/AutomataGraph.tsx` | Draws a machine and moves particles with `getPointAtLength()` on the rendered paths |
| `components/DFAEditor.tsx` | Builds a DFA by adding states and symbols and editing its transition table |
| `components/converter/*` | NFA editor, conversion worksheet, generated table, merge animation, two-machine run |

The mathematics never touches the animation. The interface only replays what the engines return, so diagrams, tape, tables and explanations cannot disagree.

## Limits

The DFA builder and NFA editor each accept up to 6 states and 4 input symbols so the diagrams stay readable. The converter handles ordinary NFA transitions only; ε-moves are not supported.
