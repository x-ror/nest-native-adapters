---
name: nest-native-adapters
description: Documentation set as a conformance standard; numbered, citable clauses checked against Nest's Express adapter.
colors:
  nest-red: "#e0234e"
  nest-red-pressed: "#b81d40"
  band-ink: "#ffffff"
  red-ink: "#b8173e"
  red-ink-dark: "#ff6b88"
  red-tint: "#f9e4e9"
  red-tint-dark: "#3a1520"
  ink: "#17191c"
  ink-dark: "#e8e9e6"
  mute: "#575b60"
  mute-dark: "#a5a9a3"
  rule: "#d6d9d3"
  rule-dark: "#34373b"
  paper: "#fbfbf9"
  paper-dark: "#141517"
  paper-2: "#f2f3ef"
  paper-2-dark: "#1b1d20"
  code-inline: "#eceee9"
  code-inline-dark: "#25282c"
  code-plate: "#17191c"
typography:
  display:
    fontFamily: "Barlow Semi Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(2.5rem, 7vw, 4.75rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Barlow Semi Condensed, Arial Narrow, sans-serif"
    fontSize: "2.75rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.005em"
  title:
    fontFamily: "Barlow Semi Condensed, Arial Narrow, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.003em"
  title-sm:
    fontFamily: "Barlow Semi Condensed, Arial Narrow, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
  lede:
    fontFamily: "Source Sans 3 Variable, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Source Sans 3 Variable, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Barlow Semi Condensed, Arial Narrow, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.08em"
  frame-item:
    fontFamily: "Barlow Semi Condensed, Arial Narrow, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.02em"
  code:
    fontFamily: "JetBrains Mono Variable, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.65
rounded:
  none: "0"
spacing:
  num-gap: "0.6rem"
  rule-gap: "0.45rem"
  item-y: "0.3rem"
  group-gap: "1.25rem"
  block-gap: "1.5rem"
  section-gap: "2.75rem"
  clause-hang: "4.25rem"
components:
  button-primary:
    backgroundColor: "{colors.nest-red}"
    textColor: "{colors.band-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0.75rem 1.4rem"
  button-primary-hover:
    backgroundColor: "{colors.nest-red-pressed}"
    textColor: "{colors.band-ink}"
  link-action:
    textColor: "{colors.red-ink}"
    typography: "{typography.label}"
  running-head:
    backgroundColor: "{colors.nest-red}"
    textColor: "{colors.band-ink}"
    typography: "{typography.label}"
    height: "3rem"
  clause-item:
    textColor: "{colors.ink}"
    typography: "{typography.frame-item}"
    padding: "0.3rem 0"
  clause-item-current:
    textColor: "{colors.red-ink}"
  note:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0.9rem 1.15rem 1rem"
  code-plate:
    backgroundColor: "{colors.code-plate}"
    textColor: "{colors.ink-dark}"
    typography: "{typography.code}"
    rounded: "{rounded.none}"
  code-inline:
    backgroundColor: "{colors.code-inline}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0.1em 0.3em"
---

# Design System: nest-native-adapters

## Overview

**Creative North Star: "The Conformance Standard"**

The site reads like an ISO/DIN standards booklet: every page is a numbered clause, every section heading carries its clause number, and every behavior that departs from Nest's Express adapter is printed in place beside the clause it affects. The reader always knows where they stand (clause number in the margin, current item in red in the clause tree) and moves by the numbered tree or by previous/next.

The world is printed, not rendered: three inks (black, Nest red, grey rule) on near-white standard paper, with a graphite sheet carrying the same inks in dark mode. Structure is drawn with hairline rules rather than boxes, shadows or tints. The frame (running head, clause tree, contents, table heads, note titles) is set in Barlow Semi Condensed at one size, so rank comes from weight, case and rule; the reading column is Source Sans 3 and code is JetBrains Mono. Density is reference density: calm body measure, tight frame.

It refuses the default docs shell: no blue accent, no icon cards, no rounded panels, no lifted surfaces.

**Key Characteristics:**
- Clause numbers (N.M, N.M.S) on titles, section heads, the clause tree and the contents, set in tabular figures.
- A filled Nest-red running head; red elsewhere is ink, not fill.
- Hairline rules above sections and under table heads instead of containers.
- Square corners everywhere; no shadows.
- Conformance stated by authored SVG mark plus word, never colour alone.

## Colors

Three inks on paper: black, Nest red and a grey rule; the dark theme swaps the paper for graphite and lightens the inks, keeping their roles.

### Primary
- **Nest Red** (nest-red): the running-head band, the primary action button, text selection, caret and form accent. The same value in both themes; it is the brand red from the favicon.
- **Red Ink** (red-ink light, red-ink-dark dark): red as text and line, never as fill. Clause numbers on titles and section heads, links, the current item in the clause tree and contents, the "not supported" mark, the deviation mark and the top rule of deviation and danger notes, focus outlines.
- **Red Tint** (red-tint / red-tint-dark): Starlight's low accent surface only; not used by authored components.

### Neutral
- **Ink** (ink / ink-dark): body text, headings, frame labels, and the structural 1px rule above every section, group head and title panel; 2px under table heads.
- **Mute** (mute / mute-dark): clause numerals in the tree and contents, identifier lines, pagination labels, footer meta.
- **Grey Rule** (rule / rule-dark): hairlines between table rows, scope-list rows, note borders, sidebar edge.
- **Paper** (paper / paper-dark): the page.
- **Paper 2** (paper-2 / paper-2-dark): the sheet behind printed notes (asides and deviation notes).
- **Inline Code** (code-inline / code-inline-dark): inline code ground.
- **Code Plate** (code-plate): one graphite plate for code blocks in both themes, with github-dark-default syntax colours confined to the plate.

### Named Rules
**The Three Inks Rule.** Outside code plates the page uses ink, Nest red and grey rule on paper. There is no second accent hue.

**The Red Ink Rule.** Filled Nest red appears only on the running head, the primary button and selection. Everywhere else red is a line or a glyph colour: clause number, link, current position, deviation.

**The Red Note Rule.** Among printed notes, a red top rule belongs to deviations from Express and danger notes; note, tip and caution notes take an ink rule.

## Typography

**Display Font:** Barlow Semi Condensed (with Arial Narrow, sans-serif), weights 500/600/700
**Body Font:** Source Sans 3 Variable
**Label/Mono Font:** JetBrains Mono Variable (with ui-monospace) for code

**Character:** A condensed engineering grotesque frames the document like a standard's running heads and clause numbers; a humanist sans carries the calm reading column.

### Hierarchy
- **Display** (700, clamp(2.5rem, 7vw, 4.75rem), 1): the cover title only.
- **Headline** (700, 2.75rem; 2.125rem below 50em, 1.1): the page title, with its clause number in red at weight 600.
- **Title** (700, 1.625rem, 1.2): section heads (h2) and the cover's Contents head, each with a 1px ink rule above.
- **Title small** (700, 1.25rem): subsection heads (h3).
- **Lede** (400, 1.375rem, 1.5, max 34rem): the cover statement only.
- **Body** (400, 1.0625rem, 1.7): the reading column; tables drop to 0.9375rem with tabular figures.
- **Label** (700, 0.875rem, 0.08em tracking, uppercase): running head, clause-tree group heads, contents group heads, table heads, note titles, "On this page", pagination labels, the primary button and action link.
- **Frame item** (500, 0.875rem, 0.02em, mixed case): clause-tree items and on-page contents links.
- **Code** (0.875rem, 1.65): code plates; inline code at 0.875em.

### Named Rules
**The One Frame Size Rule.** All frame text is 0.875rem. Rank in the frame comes from weight (500/600/700), case and rule, never from a second size.

**The Caps For Heads Rule.** Tracked caps are for short heads: group heads, table heads, the running head, note titles, button and action link. Long item labels (tree, contents) stay mixed case.

**The Tabular Numerals Rule.** Every clause number, table and conformance column uses tabular figures so numbers align down the margin.

## Layout

Starlight's three-column frame: clause tree left, reading column centre (39rem content width; 50rem on the sidebar-less cover), on-page contents right. Running head height 3rem.

At 72rem and wider, clause numbers hang in a 4.25rem left margin: the page title and every h2/h3 number sit outside the text edge so headings align on the word, not the number. Below 72rem the numbers sit inline and the page title repeats the document identifier beneath it (the running head drops it).

Section heads open 2.75rem above with a 1px ink rule and 0.55rem of air before the text. Frame lists pair a 2.1rem numeral column with a 0.6rem gap. On the cover, the scope list becomes a 15rem term column beside its definition at 50em, and the contents runs in two columns at 50em.

Breakpoints in use: 50em (title size, scope grid, contents columns), 72rem (hanging clause numbers, identifier in running head), and hover-none or under 50rem (code copy button gets its own strip above the first line).

### Named Rules
**The Hanging Clause Rule.** On wide screens the clause number lives in the margin; text edges stay flush.

## Elevation & Depth

Flat. No shadows anywhere: Starlight and Expressive Code shadows are explicitly removed. Depth is conveyed by rules (1px ink above sections, 2px ink under table heads, 2px top rule on notes and code plates) and by the paper-2 sheet behind printed notes.

### Named Rules
**The Printed Sheet Rule.** Nothing lifts off the page. If something needs separating, rule it.

## Shapes

Square. Every corner is 0: buttons, search field, search dialog, inline code, code plates, notes, dropdowns, menu button. Lines are the form language: hairlines and heavier 2px rules at the top of a block mark its kind.

## Components

### Buttons
Printed and plain.
- **Shape:** square (0).
- **Primary:** Nest Red fill, white label type, 0.75rem by 1.4rem.
- **Hover:** fill darkens to 82% red with black, 150ms ease-out.
- **Action link:** the secondary action is a red-ink label-type link with a 0.3em underline offset, no box.

### Running Head
A filled Nest-red band carrying the project name (label, 700) and, at 72rem and wider, the document identifier (500). Search, theme select and menu button sit on the band as white-outlined square fields (1px at 60% white, hardening to white on hover). Focus outlines on the band turn white.

### Navigation (Clause Tree and Contents)
- **Groups:** a 1px ink rule above, a numeral in mute, the label in tracked caps.
- **Items:** frame-item type, numeral N.M in mute at 600; hover turns the item red; the current item turns red at 700, numeral included. No pills, no background.
- **On-page contents:** "On this page" head in label caps under a 1px ink rule; entries numbered from the page's clause; current entry red at 700.
- **Pagination:** a 1px ink rule above, label-caps "Previous"/"Next" in mute, page name at 1.25rem in ink, red on hover.

### Tables
Head row in label caps over a 2px ink rule; rows separated by grey rule hairlines; no zebra striping, no fill. Package names in code never wrap.

### Conformance Marks
Inline mark plus word: a filled disc for supported (in text colour), a cross for not supported (red ink, 600), struck equals for deviates (red ink). Marks are authored SVG masks over currentColor, 0.7 to 0.85em.

### Printed Notes
Asides and deviation notes are paper-2 sheets with a 1px grey-rule border and a 2px top rule, padded 0.9rem 1.15rem 1rem, titled in label caps. Deviation notes carry the struck-equals mark and a red title linking to the deviations list. Pages with `marks: deviates` frontmatter print the mark beside every top-level list item.

### Code Plates
One graphite plate in both themes, square, with a 2px Nest-red top rule; no terminal or editor chrome; titles in Barlow caps at 0.06em. Inline code is square on the inline-code ground.

### Cover
Display title over a full-width ink rule, an identifier line in mute caps over a grey rule, the lede, then primary button and action link. Below: a ruled scope definition list, the package table and code, and a two-column numbered Contents.

## Do's and Don'ts

### Do:
- **Do** number every page and section from the clause tree (N.M, N.M.S) and set the numbers in tabular figures.
- **Do** separate sections with a 1px ink rule above the head; separate rows with grey-rule hairlines.
- **Do** keep all frame text at 0.875rem in Barlow Semi Condensed and rank it by weight, case and rule.
- **Do** print a deviation from Express in place, as a red-ruled note beside the clause it affects.
- **Do** state conformance with an authored SVG mark and a word.
- **Do** keep red as line and glyph colour; fill only the running head, primary button and selection.

### Don't:
- **Don't** round corners or add shadows.
- **Don't** introduce a second accent hue or a blue link colour.
- **Don't** give note, tip or caution notes a red rule; red notes mean deviation or danger.
- **Don't** set long tree or contents items in tracked caps.
- **Don't** signal conformance by colour alone, or with emoji or text glyphs.
- **Don't** use icon cards or tinted panels to organise content; use numbered lists, ruled tables and definition lists.
