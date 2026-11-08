"use client";

import { motion } from "framer-motion";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { DFASimulator } from "./DFASimulator";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { TablesView } from "./TablesView";
import { ConverterProvider } from "./converter/ConverterContext";
import { NFAConverter } from "./converter/NFAConverter";

const VIEWS = [
  { id: "home", label: "Home", short: "Home" },
  { id: "dfa", label: "DFA Simulator", short: "DFA" },
  { id: "converter", label: "NFA to DFA Converter", short: "NFA to DFA" },
  { id: "tables", label: "Transition Tables", short: "Tables" },
  { id: "how", label: "How It Works", short: "How" },
] as const;

export type ViewId = (typeof VIEWS)[number]["id"];

const ActiveViewContext = createContext<ViewId>("home");
export const useActiveView = () => useContext(ActiveViewContext);

/** Each view has its own ground, so moving between them is felt, not just read. */
const BACKDROPS: Record<ViewId, string> = {
  home: "radial-gradient(62% 62% at 82% 14%, #43309a 0%, transparent 72%), radial-gradient(52% 58% at 4% 96%, #14509a 0%, transparent 72%), #16165a",
  dfa: "radial-gradient(60% 44% at 42% 0%, #232a86 0%, transparent 76%), #0d1033",
  converter: "linear-gradient(100deg, #15185a 0%, #15185a 42%, #301f68 76%, #301f68 100%)",
  tables: "#eeedf9",
  how: "radial-gradient(48% 52% at 100% 100%, rgb(255 180 107 / 0.17) 0%, transparent 74%), radial-gradient(60% 50% at 0% 0%, #3b2c8c 0%, transparent 70%), #1b1a5f",
};

function viewFromHash(): ViewId {
  const hash = window.location.hash.slice(1);
  return VIEWS.some((view) => view.id === hash) ? (hash as ViewId) : "home";
}

function View({ id, active, children }: { id: ViewId; active: ViewId; children: ReactNode }) {
  const shown = id === active;
  return (
    <motion.div
      data-view={id}
      hidden={!shown}
      initial={false}
      animate={{ opacity: shown ? 1 : 0, y: shown ? 0 : 8 }}
      transition={{ duration: 0.32, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export function AppShell() {
  const [active, setActive] = useState<ViewId>("home");

  useEffect(() => {
    const sync = () => {
      setActive(viewFromHash());
      window.scrollTo(0, 0);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return (
    <ActiveViewContext.Provider value={active}>
      <ConverterProvider>
        <div aria-hidden className="fixed inset-0 -z-10">
          {VIEWS.map((view) => (
            <div
              key={view.id}
              className="absolute inset-0 transition-opacity duration-500"
              style={{ background: BACKDROPS[view.id], opacity: view.id === active ? 1 : 0 }}
            />
          ))}
        </div>

        <nav
          aria-label="Sections"
          className={`sticky top-0 z-30 transition-colors duration-500 ${active === "tables" ? "on-paper bg-paper" : "bg-[#101240]"}`}
        >
          <div className="mx-auto flex h-14 max-w-[100rem] items-center gap-6 px-5 lg:px-10">
            <a href="#home" aria-label="Home" className="hidden shrink-0 sm:block">
              <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
                <circle cx="13" cy="13" r="11.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="13" cy="13" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="13" cy="13" r="3" className="fill-amber" />
              </svg>
            </a>
            <ol className="relative flex flex-1 items-center gap-1 overflow-x-auto sm:ml-auto sm:flex-none sm:gap-2">
              {VIEWS.map((view) => {
                const current = view.id === active;
                return (
                  <li key={view.id} className="shrink-0">
                    <a
                      href={`#${view.id}`}
                      data-nav={view.id}
                      aria-current={current ? "page" : undefined}
                      className={`relative block px-2 py-3 text-[0.9375rem] transition-colors lg:px-3 ${
                        current ? "font-semibold text-fg" : "text-muted hover:text-fg"
                      }`}
                    >
                      <span className="hidden lg:inline">{view.label}</span>
                      <span className="lg:hidden">{view.short}</span>
                      {current && (
                        <motion.span
                          layoutId="nav-token"
                          className="absolute bottom-1 left-1/2 -ml-[3.5px] size-[7px] rounded-full bg-amber"
                          transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        />
                      )}
                    </a>
                  </li>
                );
              })}
            </ol>
          </div>
        </nav>

        <main>
          <View id="home" active={active}>
            <Hero />
          </View>
          <View id="dfa" active={active}>
            <DFASimulator />
          </View>
          <View id="converter" active={active}>
            <NFAConverter />
          </View>
          <View id="tables" active={active}>
            <TablesView />
          </View>
          <View id="how" active={active}>
            <HowItWorks />
          </View>
        </main>
      </ConverterProvider>
    </ActiveViewContext.Provider>
  );
}
