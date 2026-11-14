// Clause numbers follow the sidebar: group N, item M → "N.M".
// The sidebar's CSS counters in theme.css produce the same numbers.

type Entry =
  | { type: "link"; href: string; label: string; isCurrent: boolean }
  | { type: "group"; label: string; entries: Entry[] };

export interface Clause {
  number: string;
  label: string;
  href: string;
  isCurrent: boolean;
}

export interface ClauseGroup {
  number: string;
  label: string;
  clauses: Clause[];
}

export function clauseGroups(sidebar: readonly Entry[]): ClauseGroup[] {
  return sidebar
    .filter((entry): entry is Extract<Entry, { type: "group" }> => entry.type === "group")
    .map((group, g) => ({
      number: String(g + 1),
      label: group.label,
      clauses: group.entries
        .filter((entry): entry is Extract<Entry, { type: "link" }> => entry.type === "link")
        .map((link, i) => ({
          number: `${g + 1}.${i + 1}`,
          label: link.label,
          href: link.href,
          isCurrent: link.isCurrent,
        })),
    }));
}

export function currentClause(sidebar: readonly Entry[]): Clause | undefined {
  return clauseGroups(sidebar)
    .flatMap((group) => group.clauses)
    .find((clause) => clause.isCurrent);
}
