---
version: 1
slug: "src-content-docs"
primary_target: "src/content/docs"
related_targets: ["astro.config.mjs"]
---

# Docs site (Starlight custom theme)

Scope: every page of the Starlight docs site in site/. Mode: Read.
Audience: Nest developers on Express/Fastify evaluating and migrating; they look up behavior and deviations.
Constraints: keep Starlight navigation, Pagefind search, content structure, light and dark themes; no benchmark or adoption claims.

## Direction contract

THESIS: The docs read as a conformance standard: every behavior is a numbered, citable clause checked against Nest's Express adapter. Refuses the default blue-accent docs shell with icon cards.
OWN-WORLD: Three inks: black, Nest red #e0234e, grey rule, on near-white standard paper (dark: graphite sheet, same inks). Barlow Semi Condensed caps for the frame (running head, nav, clause numbers, table heads) at one size, rank by weight, case and rule; Source Sans 3 for the reading column; JetBrains Mono for code. Hairline rules under headings, red running-head band, conformance marks as authored SVG (conforms, partial, deviates), never colour alone.
STORY: The reader sees where they stand (clause number, section), reads a calm answer, sees deviations printed beside the clause they affect, and moves on via the numbered tree or next/previous.
FIRST VIEWPORT: Red running-head band with the name and document identifier "Nest 10 / 11 / 12 · Node 22+ / Bun 1.4+", search, GitHub, theme. Left numbered clause tree (1, 2, 3; 4.1–4.12; R). Centre: title with its clause number set in the margin, scope rule line, reading column at ~66ch.
FORM: Standards document (ISO/DIN booklet), candidate 7 of 7 on the grounded list. seed:31a08efed28096df
Signature: clause numbering in the margin and the red running head; deviation notes printed in place.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Recorded adaptations (finish review round 1)

- Clause tree numbers follow Starlight sidebar groups (N.M) instead of 4.1-4.12/R: the user kept Starlight navigation and content structure.
- Sidebar and contents items stay mixed case: 17 long labels in tracked caps at 14px read slower than the same labels in mixed case; group heads, table heads, the running head and aside titles carry the caps.
- No per-page scope strip: pages carry no per-page runtime or version data, and the running head already states the document scope (Nest 10/11/12, Node 22+/Bun 1.4+); a strip would repeat it or invent applicability.
- No "partial" conformance mark: no page has a partial state to mark. Marks in use: supported (disc), not supported (cross), deviates (struck equals).
- No "On this page" contents (removed at the owner's request after launch): pages are short and the numbered clause tree carries navigation.
