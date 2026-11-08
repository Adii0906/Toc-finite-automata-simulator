import { Fragment } from "react";

function Token({ name }: { name: string }) {
  const match = /^([a-zA-Z]+)(\d+)$/.exec(name);
  if (!match) return <i>{name}</i>;
  return (
    <>
      <i>{match[1]}</i>
      <sub>{match[2]}</sub>
    </>
  );
}

/** A set of states in textbook notation. The empty set renders as ∅. */
export function SetOf({ members }: { members: readonly string[] }) {
  if (members.length === 0) return <span className="math">∅</span>;
  return (
    <span className="math whitespace-nowrap">
      {"{"}
      {members.map((member, index) => (
        <Fragment key={member}>
          {index > 0 && ", "}
          <Token name={member} />
        </Fragment>
      ))}
      {"}"}
    </span>
  );
}

/** Renders any state id: q0 as an italic q with a subscript, {q0,q1} as a set. */
export function StateName({ id }: { id: string }) {
  if (id === "∅") return <span className="math">∅</span>;
  if (id.startsWith("{")) return <SetOf members={id.slice(1, -1).split(",")} />;
  return (
    <span className="math whitespace-nowrap">
      <Token name={id} />
    </span>
  );
}

/** Typesets state names that appear inside ordinary sentences. */
export function withStateNames(text: string) {
  return text.split(/(q\d+)/g).map((part, index) =>
    index % 2 === 1 ? <StateName key={index} id={part} /> : part,
  );
}

export function Equation({
  from,
  symbol,
  to,
  symbolClassName = "",
}: {
  from: string;
  symbol: string;
  to?: string | null;
  symbolClassName?: string;
}) {
  return (
    <span className="math whitespace-nowrap">
      <i>δ</i>(<StateName id={from} />, <span className={symbolClassName}>{symbol}</span>)
      {to !== undefined && (
        <>
          {" = "}
          {to ? <StateName id={to} /> : <span className="text-muted">?</span>}
        </>
      )}
    </span>
  );
}
