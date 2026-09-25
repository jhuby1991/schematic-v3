/**
 * Rendering invariants.
 *
 * These encode two habits that caused real bugs in the previous tool:
 *
 *  - Cloning the canvas for printing produced two elements with
 *    `id="drawing-canvas"`, so `getElementById` silently returned the hidden
 *    one and measuring the drawing measured nothing.
 *  - Appearance set inline by the renderer could not be overridden by the
 *    print stylesheet, so labels printed on opaque white plates.
 */

import { describe, expect, it } from 'vitest';
import { CLS } from '../../src/render/classes';
import { renderDrawing } from '../../src/render/drawing';
import { buildPrintSheet } from '../../src/render/print';
import { addComponent, addConnection, addLabel, setCircuits } from '../../src/model/schematic';
import { emptySchematic } from '../../src/model/types';

function sample() {
  let s = emptySchematic();
  s = addComponent(s, 'RAK8', 20, 20);
  const rak = s.components[0]!;
  s = setCircuits(s, rak.id, ['Kitchen', 'Hall', '', 'Snug', '', '', '', '']);
  s = addComponent(s, 'KeypadWCM', 400, 200);
  s = addLabel(s, 60, 300, 'Ground floor');
  s = addConnection(s, 'cat5', { x: 10, y: 10 }, { x: 200, y: 120 });
  return s;
}

const options = { assetBase: 'components', interactive: true };

describe('renderDrawing', () => {
  it('renders components, labels and connections from the model', () => {
    const host = document.createElement('div');
    renderDrawing(host, sample(), options);
    expect(host.querySelectorAll(`.${CLS.item}`)).toHaveLength(2);
    expect(host.querySelectorAll(`.${CLS.textLabel}`)).toHaveLength(1);
    expect(host.querySelectorAll(`.${CLS.connection}`)).toHaveLength(1);
  });

  it('renders only the circuits that have names', () => {
    const host = document.createElement('div');
    renderDrawing(host, sample(), options);
    const labels = [...host.querySelectorAll(`.${CLS.outputLabel}`)];
    expect(labels.map((l) => l.textContent)).toEqual(['Kitchen', 'Hall', 'Snug']);
  });

  it('uses no id attributes, so the same drawing can be rendered twice', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    const model = sample();
    renderDrawing(a, model, options);
    renderDrawing(b, model, options);
    expect(a.querySelectorAll('[id]')).toHaveLength(0);
    expect(b.querySelectorAll('[id]')).toHaveLength(0);
  });

  it('sets only geometry inline, so the print stylesheet can win', () => {
    const host = document.createElement('div');
    renderDrawing(host, sample(), options);
    // Font size on a user-sized text label is data, so it is allowed.
    const allowed = new Set(['left', 'top', 'width', 'height', 'font-size', 'transform-origin', 'transform', 'inset', 'position']);
    const offenders: string[] = [];
    for (const el of host.querySelectorAll<HTMLElement>('*')) {
      for (let i = 0; i < el.style.length; i++) {
        const property = el.style.item(i);
        if (!allowed.has(property)) offenders.push(`${el.className || el.tagName}: ${property}`);
      }
    }
    expect(offenders, `inline appearance blocks the print stylesheet:\n  ${offenders.join('\n  ')}`).toEqual([]);
  });

  it('is idempotent — re-rendering replaces rather than appends', () => {
    const host = document.createElement('div');
    const model = sample();
    renderDrawing(host, model, options);
    const first = host.querySelectorAll(`.${CLS.item}`).length;
    renderDrawing(host, model, options);
    expect(host.querySelectorAll(`.${CLS.item}`)).toHaveLength(first);
  });

  it('keeps cable colour as data, not theme', () => {
    const host = document.createElement('div');
    renderDrawing(host, sample(), options);
    const line = host.querySelector(`.${CLS.connection}`)!;
    expect(line.getAttribute('stroke')).toBe('#28a745'); // CAT5/6 green
  });
});

describe('buildPrintSheet', () => {
  it('renders from the model rather than cloning the screen DOM', () => {
    const model = sample();
    const { sheet } = buildPrintSheet(model, options);
    expect(sheet.querySelectorAll(`.${CLS.item}`)).toHaveLength(2);
    expect(sheet.querySelectorAll('[id]')).toHaveLength(0);
  });

  it('applies the fit transform to exactly one element', () => {
    const { sheet } = buildPrintSheet(sample(), options);
    const transformed = [...sheet.querySelectorAll<HTMLElement>('*')].filter(
      (el) => el.style.transform && el.style.transform !== 'none',
    );
    // More than one transformed ancestor compounds the scale — the bug that
    // left connector lines offset from their components.
    expect(transformed).toHaveLength(1);
  });

  it('lists only the cable types the drawing actually uses', () => {
    const { sheet } = buildPrintSheet(sample(), options);
    const legend = sheet.querySelector(`.${CLS.printLegend}`)!;
    expect(legend.textContent).toContain('CAT5/6');
    expect(legend.textContent).not.toContain('DALI');
  });

  it('puts the project details in the title block', () => {
    const model = { ...sample(), project: { name: 'Oakfield', date: '2026-01-01', version: '2', preparedBy: 'A. Installer', reference: 'REF-1' } };
    const { sheet } = buildPrintSheet(model, options);
    const block = sheet.querySelector(`.${CLS.printTitleBlock}`)!;
    expect(block.textContent).toContain('Oakfield');
    expect(block.textContent).toContain('A. Installer');
    // Customer wording, not sales wording.
    expect(block.textContent).toContain('Prepared by');
    expect(block.textContent).not.toContain('Salesperson');
  });

  it('produces no transform for an empty drawing', () => {
    const { fit } = buildPrintSheet(emptySchematic(), options);
    expect(fit).toBeNull();
  });
});
