/**
 * Renders a Schematic into a container element.
 *
 * Screen and print both call this. That is the point: the printed sheet is a
 * second *rendering of the model*, not a cloned copy of the on-screen DOM.
 * The previous tool cloned the live canvas into a print sheet, which produced
 * two elements sharing `id="drawing-canvas"` — so `getElementById` returned
 * whichever came first, and measuring the drawing measured the hidden one.
 *
 * Two rules this module keeps, because breaking them is what caused the
 * print bugs in the old tool:
 *
 *  1. No `id` attributes on rendered content. Identity is `data-id`, which may
 *     legitimately appear twice when the same drawing is rendered twice.
 *  2. Only *geometry* is set inline (left/top/width/height). Every colour,
 *     font, padding and background lives in CSS, so `@media print` can
 *     override it. Inline styles cannot be overridden by a stylesheet without
 *     `!important` on every single property.
 */

import { CONNECTION_KINDS, type Connection, type PlacedComponent, type Schematic, type TextLabel } from '../model/types';
import { sizeOf, specFor } from '../model/catalogue';
import { layoutCircuitLabels } from '../model/labels';
import { CLS } from './classes';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface RenderOptions {
  /** Base URL for component images. */
  assetBase: string;
  /** Screen rendering attaches interaction hooks; print does not. */
  interactive: boolean;
}

export function renderDrawing(
  container: HTMLElement,
  schematic: Schematic,
  options: RenderOptions,
): void {
  container.replaceChildren();

  // Connections sit beneath components so cables run behind the hardware.
  container.appendChild(renderConnections(schematic.connections));

  for (const component of schematic.components) {
    const el = renderComponent(component, options);
    if (el) container.appendChild(el);
  }
  for (const label of schematic.labels) {
    container.appendChild(renderTextLabel(label, options));
  }
}

function renderComponent(component: PlacedComponent, options: RenderOptions): HTMLElement | null {
  const spec = specFor(component.type);
  if (!spec) return null;
  const { width, height } = sizeOf(spec);

  const el = document.createElement('div');
  el.className = CLS.item;
  el.dataset.id = component.id;
  el.dataset.type = component.type;
  el.dataset.kind = 'component';
  // Geometry only.
  el.style.left = `${component.x}px`;
  el.style.top = `${component.y}px`;
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  if (options.interactive) el.tabIndex = 0;
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', spec.name);

  const img = document.createElement('img');
  img.className = CLS.itemImage;
  img.src = `${options.assetBase}/${spec.image}`;
  img.alt = '';
  img.draggable = false;
  // A missing asset must be obvious, not a silently invisible component.
  // Note: the fallback goes in its own element. Setting `el.textContent` here
  // would wipe every child — including the circuit labels appended below.
  img.addEventListener('error', () => {
    el.dataset.assetMissing = 'true';
    img.hidden = true;
    if (!el.querySelector(`.${CLS.itemFallback}`)) {
      const fallback = document.createElement('span');
      fallback.className = CLS.itemFallback;
      fallback.textContent = spec.name;
      el.insertBefore(fallback, el.firstChild);
    }
  });
  el.appendChild(img);

  const circuits = component.circuits ?? [];
  if (circuits.some((t) => t.trim())) {
    el.appendChild(renderCircuitLabels(width, height, circuits));
  }

  return el;
}

/**
 * Circuit labels plus their leader lines, positioned by the pure layout
 * function in model/labels.ts.
 */
function renderCircuitLabels(
  width: number,
  height: number,
  circuits: readonly string[],
): DocumentFragment {
  const frag = document.createDocumentFragment();
  const layouts = layoutCircuitLabels(width, height, circuits);
  if (layouts.length === 0) return frag;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', CLS.outputLabelLines);
  svg.style.left = '0px';
  svg.style.top = '0px';
  svg.style.width = `${width + 200}px`;
  svg.style.height = `${height}px`;

  for (const l of layouts) {
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(l.leaderX1));
    line.setAttribute('y1', String(l.leaderY));
    line.setAttribute('x2', String(l.leaderX2));
    line.setAttribute('y2', String(l.leaderY));
    // No stroke attribute: stroke and width come from CSS so print can change
    // them. A presentation attribute would be overridden anyway, but leaving
    // it out keeps the single source of truth honest.
    svg.appendChild(line);

    const label = document.createElement('div');
    label.className = CLS.outputLabel;
    label.dataset.circuit = String(l.index);
    label.style.left = `${l.x}px`;
    label.style.top = `${l.y}px`;
    label.textContent = l.text;
    frag.appendChild(label);
  }

  frag.insertBefore(svg, frag.firstChild);
  return frag;
}

function renderTextLabel(label: TextLabel, options: RenderOptions): HTMLElement {
  const el = document.createElement('div');
  el.className = CLS.textLabel;
  el.dataset.id = label.id;
  el.dataset.kind = 'label';
  el.style.left = `${label.x}px`;
  el.style.top = `${label.y}px`;
  // Font size is per-label data, so it is legitimately inline; presentation
  // toggles are data attributes that CSS keys off.
  el.style.fontSize = `${label.fontSize}px`;
  el.dataset.bold = String(label.bold);
  el.dataset.underline = String(label.underline);
  el.dataset.background = String(label.background);
  el.textContent = label.text;
  if (options.interactive) el.tabIndex = 0;
  return el;
}

function renderConnections(connections: readonly Connection[]): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', CLS.connectionLayer);

  for (const connection of connections) {
    const spec = CONNECTION_KINDS[connection.kind] ?? CONNECTION_KINDS.default;
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('class', CLS.connection);
    line.setAttribute('x1', String(connection.from.x));
    line.setAttribute('y1', String(connection.from.y));
    line.setAttribute('x2', String(connection.to.x));
    line.setAttribute('y2', String(connection.to.y));
    // Cable colour is schematic meaning, not theming: it is data, so it is set
    // here rather than in CSS, and it must survive into print unchanged.
    line.setAttribute('stroke', spec.colour);
    if (spec.dashed) line.setAttribute('stroke-dasharray', '4 3');
    line.dataset.id = connection.id;
    line.dataset.kind = 'connection';
    svg.appendChild(line);
  }

  return svg;
}
