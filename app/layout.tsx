import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/bricolage-grotesque/index.css";
import "@fontsource-variable/schibsted-grotesk/index.css";
import "@fontsource-variable/stix-two-text/index.css";
import "@fontsource-variable/stix-two-text/wght-italic.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "See How Automata Think",
  description:
    "Watch a DFA read a string, then watch an NFA become an equivalent DFA through subset construction, one step at a time.",
};

export const viewport: Viewport = {
  themeColor: "#0D1033",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
