/**
 * The stylesheet contract.
 *
 * This is the regression test for the bug that quietly broke printing in the
 * previous tool: the renderer created `.output-label` while the stylesheet
 * styled `.rak8-output-label`, and `.canvas-item` while the stylesheet styled
 * `.canvas-component` (36 rules). Nothing errored — the print rules simply
 * stopped applying.
 *
 * Here, every class the stylesheets mention must be declared in
 * src/render/classes.ts, and every declared class must be used somewhere in
 * the source. Rename one half of a pair and this fails.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_CLASSES } from '../../src/render/classes';

const STYLES_DIR = join(import.meta.dirname, '../../src/styles');
const SRC_DIR = join(import.meta.dirname, '../../src');

function readAll(dir: string, extension: string): string {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((name) => name.endsWith(extension))
    .map((name) => readFileSync(join(dir, name), 'utf8'))
    .join('\n');
}

/** Class selectors appearing in our own stylesheets. */
function classesUsedInCss(css: string): Set<string> {
  // Strip comments so documentation mentioning a class does not count.
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const found = new Set<string>();
  for (const match of withoutComments.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
    found.add(match[1]!);
  }
  return found;
}

describe('stylesheet contract', () => {
  const css = readAll(STYLES_DIR, '.css');
  const source = readAll(SRC_DIR, '.ts');
  const declared = new Set(ALL_CLASSES);

  it('every class used in CSS is declared in classes.ts', () => {
    const undeclared = [...classesUsedInCss(css)].filter((name) => !declared.has(name));
    expect(
      undeclared,
      `These classes are styled but not declared in src/render/classes.ts, so nothing ` +
        `guarantees the renderer still produces them:\n  ${undeclared.join('\n  ')}`,
    ).toEqual([]);
  });

  it('every declared class is actually styled', () => {
    const used = classesUsedInCss(css);
    const unstyled = [...declared].filter((name) => !used.has(name));
    expect(
      unstyled,
      `These classes are declared and rendered but have no CSS at all:\n  ${unstyled.join('\n  ')}`,
    ).toEqual([]);
  });

  it('renderers use the CLS constants rather than class-name string literals', () => {
    // A literal like className = 'sc-item' would defeat the contract, because
    // renaming the constant would leave it behind.
    const offenders: string[] = [];
    for (const name of declared) {
      const literal = new RegExp(`['"\`]${name}['"\`]`, 'g');
      // classes.ts is where the literals legitimately live.
      const outsideClassesFile = source.replace(/export const CLS = \{[\s\S]*?\} as const;/, '');
      if (literal.test(outsideClassesFile)) offenders.push(name);
    }
    expect(
      offenders,
      `Use CLS.<name> instead of a bare string:\n  ${offenders.join('\n  ')}`,
    ).toEqual([]);
  });
});
