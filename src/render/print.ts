/**
 * Builds the printed sheet.
 *
 * The sheet is rendered from the model by the same `renderDrawing` the screen
 * uses, then scaled to fit. Nothing is cloned from the live DOM.
 *
 * One subtlety worth stating, because getting it wrong cost the previous tool
 * a release: the fit transform is applied to a single wrapper that contains
 * both the components and the connection layer. Applying it to the connection
 * layer *as well* — when that layer is a descendant of the wrapper — compounds
 * it, scaling cables by scale squared and leaving them offset from the
 * hardware they connect.
 */

import { drawingAreaPx, fitToArea, toCssTransform, unionRects, type FitTransform } from '../model/geometry';
import { contentRects } from '../model/schematic';
import { CONNECTION_KINDS, type Schematic } from '../model/types';
import { CLS } from './classes';
import { renderDrawing, type RenderOptions } from './drawing';

export interface PrintResult {
  sheet: HTMLElement;
  fit: FitTransform | null;
}

export function buildPrintSheet(schematic: Schematic, options: RenderOptions): PrintResult {
  const area = drawingAreaPx();
  const fit = fitToArea(unionRects(contentRects(schematic)), area);

  const sheet = document.createElement('section');
  sheet.className = CLS.printSheet;

  const drawingArea = document.createElement('div');
  drawingArea.className = CLS.printCanvas;
  drawingArea.style.width = `${area.width}px`;
  drawingArea.style.height = `${area.height}px`;

  // Single transformed wrapper — see the note above about compounding.
  const fitted = document.createElement('div');
  fitted.style.transformOrigin = '0 0';
  fitted.style.transform = toCssTransform(fit);
  renderDrawing(fitted, schematic, { ...options, interactive: false });
  drawingArea.appendChild(fitted);

  sheet.appendChild(drawingArea);
  sheet.appendChild(buildFooter(schematic));

  return { sheet, fit };
}

function buildFooter(schematic: Schematic): HTMLElement {
  const footer = document.createElement('footer');
  footer.className = CLS.printTitleBlock;

  const notes = document.createElement('div');
  notes.className = CLS.printNotes;
  notes.appendChild(el('h2', 'Wired network notes'));
  const list = document.createElement('ol');
  for (const note of NOTES) list.appendChild(el('li', note));
  notes.appendChild(list);

  const details = document.createElement('dl');
  const p = schematic.project;
  addRow(details, 'Project', p.name);
  addRow(details, 'Date', p.date);
  addRow(details, 'Version', p.version);
  addRow(details, 'Prepared by', p.preparedBy);
  addRow(details, 'Reference', p.reference);

  footer.appendChild(notes);
  footer.appendChild(details);
  footer.appendChild(buildLegend(schematic));
  return footer;
}

/**
 * Only list cable types actually used, so the legend describes this drawing
 * rather than the whole product range.
 */
function buildLegend(schematic: Schematic): HTMLElement {
  const legend = document.createElement('div');
  legend.className = CLS.printLegend;
  const used = new Set(schematic.connections.map((c) => c.kind));
  if (used.size === 0) return legend;

  legend.appendChild(el('h2', 'Cables'));
  for (const kind of used) {
    const spec = CONNECTION_KINDS[kind];
    if (!spec) continue;
    const row = document.createElement('div');
    const swatch = document.createElement('span');
    swatch.style.borderBottomColor = spec.colour;
    swatch.style.borderBottomStyle = spec.dashed ? 'dashed' : 'solid';
    row.appendChild(swatch);
    row.appendChild(document.createTextNode(spec.label));
    legend.appendChild(row);
  }
  return legend;
}

const NOTES: readonly string[] = [
  'RAK-LINK supports up to 4 RAK8s or 32 circuits of control.',
  'RAK-LINK powers up to 30 control panels over up to 1500m of CAT5/6 cable.',
  'DIN-LINK supports up to 64 DPU for DIN modules and powers up to 30 control panels.',
  'Wired networks should be wired loop-in/loop-out unless a RAK-STAR distribution unit is used.',
  'This drawing is a guide to cable routing only. Confirm system specifics before installation.',
];

function el(tag: string, text: string): HTMLElement {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function addRow(dl: HTMLElement, term: string, value: string): void {
  dl.appendChild(el('dt', term));
  dl.appendChild(el('dd', value || '—'));
}
