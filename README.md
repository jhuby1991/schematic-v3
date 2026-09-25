# Schematic Tool

Plan a lighting control system: drag components onto an A4 page, wire them
together, and print a schematic to PDF. Runs entirely in the browser — nothing
is uploaded, and a drawing never leaves the machine it was made on.

**Live:** https://jhuby1991.github.io/schematic-v3/

## Quick start

```bash
npm install
npm run fetch-assets   # vendor component images (once)
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run check` | Typecheck + unit tests — run this before pushing |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Print-output tests in a real browser (Playwright) |
| `npm run build` | Typecheck, then production build into `dist/` |
| `npm run fetch-assets` | Download component images into `public/components/` |

## How it is put together

```
src/
  model/      Pure data and maths. No DOM anywhere in here.
    types.ts        The shape of a drawing
    catalogue.ts    Every component, as one declarative table
    geometry.ts     Page size and fit-to-page maths
    labels.ts       Circuit label layout
    schematic.ts    Operations on a drawing (add, move, delete…)
  render/     Model -> DOM
    classes.ts      Every CSS class name this app owns
    drawing.ts      Renders a drawing. Used by BOTH screen and print.
    print.ts        Builds the printed sheet
  io/         Saving, loading, autosave
  ui/         Toolbar, palette, app shell, toasts
  styles/     Tokens, screen styles, print styles
```

### The one rule that matters

**The model is the source of truth; the DOM is a projection of it.**

State lives in a plain `Schematic` object. Every change produces a new one and
re-renders. Printing does not clone the screen — it renders the same model a
second time through the same `renderDrawing` function.

That single decision removes a whole family of bugs: there is no DOM to read
state back out of, no cloned subtree with duplicated `id` attributes, and no
way for the screen and the page to disagree about what the drawing contains.

## Conventions

These exist because breaking them caused real, shipped bugs in the previous
version of this tool. Each is enforced by a test, not by memory.

**Class names come from `CLS`, never string literals.**
`tests/unit/classes.test.ts` parses the stylesheets and asserts that every
class in the CSS is declared in `src/render/classes.ts` and vice versa. The old
tool styled `.rak8-output-label` while the renderer produced `.output-label`,
and `.canvas-component` (36 rules) while the renderer produced `.canvas-item`.
Nothing errored; the print rules simply stopped applying.

**The renderer sets geometry inline, never appearance.**
Position and size are computed, so they are inline. Colour, font, padding and
background belong in CSS, because a stylesheet cannot override an inline style
without `!important` on every property — which is how circuit labels ended up
printing on opaque white plates.

**No `id` attributes on rendered content.** Identity is `data-id`. The same
drawing is legitimately rendered twice (screen and print), and duplicate ids
make `getElementById` return whichever came first.

**Components must be able to hold their own labels.**
`tests/unit/labels.test.ts` checks every catalogue entry with outputs: the
vertical room per circuit must be at least the label box height. This test
failed the first time it ran — DIN-8S allowed 7px per circuit for an 8px label.

**One transform for the print fit.** The fit is applied to a single wrapper.
Applying it to a descendant as well compounds it, scaling by `scale²` and
leaving cables offset from the components they connect.

## Testing

Unit tests cover the pure logic — geometry, label layout, serialisation, and
the render invariants above. They are fast and exact.

End-to-end tests (`tests/e2e/`) open a real browser under real print media and
assert what actually lands on the page: labels black on transparent with zero
overlap, one transform on the fit wrapper, cable colours unchanged, no
duplicate ids. This layer exists because a previous print bug had a *correct
computed value* and a wrong rendered result — only looking at output catches
that.

## Deployment

`.github/workflows/ci.yml` runs typecheck, unit tests, build and print tests on
every push and pull request, and deploys `main` to GitHub Pages. `main` is the
only branch that deploys.

Vite fingerprints every built file, so a returning visitor can never get new
HTML with stale JavaScript. Nothing needs a hand-maintained cache-busting
version string.

## Adding a component

Add one entry to `CATALOGUE` in `src/model/catalogue.ts`, drop its image in
`public/components/`, and run `npm run check`. The palette, renderer, counters
and tests all read from that table — there is nowhere else to update.

If the part has `outputs`, make sure it is tall enough to hold that many
labels; the test will tell you if it is not.
