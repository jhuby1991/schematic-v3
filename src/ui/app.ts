/**
 * The application shell: wires the model to the DOM.
 *
 * State flows one way. Every change produces a new Schematic, which is pushed
 * through `setState`, which re-renders. There is no path where the DOM is the
 * source of truth, so there is nothing to "read back" and nothing to drift.
 */

import { drawingAreaPx as area } from '../model/geometry';
import { GRID, paletteGroups, snapToGrid, specFor, sizeOf } from '../model/catalogue';
import {
  addComponent,
  addConnection,
  addLabel,
  counters,
  moveComponent,
  removeItems,
  setCircuits,
  setProject,
} from '../model/schematic';
import { emptySchematic, CONNECTION_KINDS, type ConnectionKind, type Schematic } from '../model/types';
import { CLS } from '../render/classes';
import { renderDrawing } from '../render/drawing';
import { buildPrintSheet } from '../render/print';
import { createAutosaver, clearAutosave, readAutosave } from '../io/storage';
import { deserialise, serialise, suggestedFilename, SchematicParseError } from '../io/serialise';
import { prompt, toast } from './toast';

const ASSET_BASE = 'components';

export interface AppRefs {
  root: HTMLElement;
}

type Mode = 'select' | 'connect';

export function createApp(root: HTMLElement): void {
  let state: Schematic = emptySchematic();
  let selection = new Set<string>();
  let mode: Mode = 'select';
  let cableKind: ConnectionKind = 'default';
  const history: Schematic[] = [];
  const future: Schematic[] = [];
  const autosave = createAutosaver();

  // ---- DOM skeleton -----------------------------------------------------
  const { toolbar, sidebar, canvas, canvasWrapper, drawingLayer, emptyState, projectInputs, modeButton, undoButton, redoButton, dpuOut, circuitsOut } =
    buildShell(root);

  const size = area();
  canvas.style.width = `${size.width}px`;
  canvas.style.height = `${size.height}px`;
  canvas.appendChild(buildGrid(size.width, size.height));

  // ---- State ------------------------------------------------------------
  function setState(next: Schematic, options: { history?: boolean } = {}): void {
    if (options.history !== false) {
      history.push(state);
      if (history.length > 100) history.shift();
      future.length = 0;
    }
    state = next;
    render();
    autosave(state);
  }

  function render(): void {
    renderDrawing(drawingLayer, state, { assetBase: ASSET_BASE, interactive: true });
    for (const id of selection) {
      drawingLayer
        .querySelectorAll(`[data-id="${CSS.escape(id)}"]`)
        .forEach((el) => el.classList.add(CLS.itemSelected));
    }
    emptyState.hidden = state.components.length > 0 || state.labels.length > 0;
    undoButton.disabled = history.length === 0;
    redoButton.disabled = future.length === 0;

    const c = counters(state);
    dpuOut.textContent = `${c.dpuUsed} / ${c.dpuAvailable}`;
    dpuOut.dataset.over = String(c.dpuUsed > c.dpuAvailable);
    circuitsOut.textContent = `${c.circuitsUsed} / ${c.circuitsAvailable}`;
    circuitsOut.dataset.over = String(c.circuitsUsed > c.circuitsAvailable);
  }

  function undo(): void {
    const previous = history.pop();
    if (!previous) return;
    future.push(state);
    state = previous;
    render();
    autosave(state);
  }

  function redo(): void {
    const next = future.pop();
    if (!next) return;
    history.push(state);
    state = next;
    render();
    autosave(state);
  }

  // ---- Palette drag and drop -------------------------------------------
  sidebar.addEventListener('dragstart', (event) => {
    const item = (event.target as HTMLElement).closest<HTMLElement>(`.${CLS.paletteItem}`);
    if (!item || !event.dataTransfer) return;
    event.dataTransfer.setData('text/plain', item.dataset.type ?? '');
    event.dataTransfer.effectAllowed = 'copy';
  });

  canvas.addEventListener('dragover', (event) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  });

  canvas.addEventListener('drop', (event) => {
    event.preventDefault();
    const type = event.dataTransfer?.getData('text/plain');
    if (!type || !specFor(type)) return;
    const point = canvasPoint(event);
    const spec = specFor(type)!;
    const { width, height } = sizeOf(spec);
    // Drop so the cursor lands on the component's centre, then clamp inside
    // the page so nothing can be placed where it will not print.
    const x = clamp(point.x - width / 2, 0, size.width - width);
    const y = clamp(point.y - height / 2, 0, size.height - height);
    setState(addComponent(state, type, x, y));
  });

  // ---- Pointer interaction ---------------------------------------------
  let drag: { id: string; offsetX: number; offsetY: number } | null = null;
  let pendingCable: { x: number; y: number } | null = null;

  canvas.addEventListener('pointerdown', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-id]');
    const point = canvasPoint(event);

    if (mode === 'connect') {
      if (!pendingCable) {
        pendingCable = point;
      } else {
        setState(addConnection(state, cableKind, pendingCable, point));
        pendingCable = null;
      }
      return;
    }

    if (!target) {
      selection.clear();
      render();
      return;
    }

    const id = target.dataset.id!;
    selection = event.shiftKey ? new Set([...selection, id]) : new Set([id]);
    render();

    const component = state.components.find((c) => c.id === id);
    if (component) {
      drag = { id, offsetX: point.x - component.x, offsetY: point.y - component.y };
      canvas.setPointerCapture(event.pointerId);
    }
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const point = canvasPoint(event);
    const component = state.components.find((c) => c.id === drag!.id);
    if (!component) return;
    const spec = specFor(component.type);
    const { width, height } = spec ? sizeOf(spec) : { width: GRID, height: GRID };
    const x = clamp(point.x - drag.offsetX, 0, size.width - width);
    const y = clamp(point.y - drag.offsetY, 0, size.height - height);
    // Live drag is not a history step; the pointerup below commits one.
    state = moveComponent(state, drag.id, x, y);
    render();
  });

  canvas.addEventListener('pointerup', () => {
    if (drag) {
      drag = null;
      setState(state); // commit one history entry for the whole drag
    }
  });

  // ---- Keyboard ---------------------------------------------------------
  document.addEventListener('keydown', (event) => {
    const el = document.activeElement;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      event.shiftKey ? redo() : undo();
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (selection.size === 0) return;
      event.preventDefault();
      setState(removeItems(state, [...selection]));
      selection.clear();
      return;
    }
    if (event.key === ' ') {
      event.preventDefault();
      setMode(mode === 'connect' ? 'select' : 'connect');
      return;
    }
    const kind = (Object.keys(CONNECTION_KINDS) as ConnectionKind[]).find(
      (k) => CONNECTION_KINDS[k].key === event.key.toLowerCase(),
    );
    if (kind && mode === 'connect') {
      cableKind = kind;
      toast(`Cable: ${CONNECTION_KINDS[kind].label}`, 'info', 1200);
    }
  });

  function setMode(next: Mode): void {
    mode = next;
    pendingCable = null;
    modeButton.setAttribute('aria-pressed', String(mode === 'connect'));
    canvas.dataset.mode = mode;
  }

  // ---- Project details --------------------------------------------------
  for (const [field, input] of Object.entries(projectInputs)) {
    input.addEventListener('input', () => {
      setState(setProject(state, { [field]: input.value }), { history: false });
    });
  }

  // ---- Printing ---------------------------------------------------------
  function preparePrint(): void {
    document.querySelectorAll(`.${CLS.printSheet}`).forEach((el) => el.remove());
    const { sheet, fit } = buildPrintSheet(state, { assetBase: ASSET_BASE, interactive: false });
    document.body.appendChild(sheet);
    if (fit?.clamped) {
      toast(
        'This drawing is wider than one page, so it printed at the smallest readable size. Moving components closer together will print larger.',
        'warning',
        7000,
      );
    }
  }

  window.addEventListener('beforeprint', preparePrint);
  window.addEventListener('afterprint', () => {
    document.querySelectorAll(`.${CLS.printSheet}`).forEach((el) => el.remove());
  });

  // ---- Toolbar actions ---------------------------------------------------
  toolbar.addEventListener('click', (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
    switch (action) {
      case 'mode':
        setMode(mode === 'connect' ? 'select' : 'connect');
        break;
      case 'label':
        setState(addLabel(state, 20, 20, 'Label'));
        break;
      case 'undo':
        undo();
        break;
      case 'redo':
        redo();
        break;
      case 'save':
        download(serialise(state), suggestedFilename(state.project.name, state.project.version));
        break;
      case 'open':
        openFile();
        break;
      case 'print':
        window.print();
        break;
      default:
        break;
    }
  });

  function openFile(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        setState(deserialise(await file.text()));
        selection.clear();
        toast(`Opened ${file.name}`, 'success');
      } catch (error) {
        toast(
          error instanceof SchematicParseError ? error.message : 'That file could not be opened.',
          'error',
          5000,
        );
      }
    });
    input.click();
  }

  // ---- Autosave recovery -------------------------------------------------
  const recoverable = readAutosave();
  if (recoverable) {
    const when =
      recoverable.ageMinutes < 1
        ? 'less than a minute ago'
        : `${recoverable.ageMinutes} minute${recoverable.ageMinutes === 1 ? '' : 's'} ago`;
    prompt(`You have an unsaved drawing from ${when}.`, [
      { label: 'Discard', onSelect: clearAutosave },
      {
        label: 'Restore it',
        onSelect: () => {
          setState(recoverable.schematic);
          toast('Drawing restored', 'success');
        },
      },
    ]);
  }

  setMode('select');
  render();

  /**
   * A deliberately narrow hook for end-to-end tests, so they can set up a
   * drawing without reaching into internals or simulating twenty clicks.
   * Everything here goes through the same state functions the UI uses.
   */
  (window as unknown as { __schematic: unknown }).__schematic = {
    setCircuits(names: string[]) {
      const first = state.components[0];
      if (first) setState(setCircuits(state, first.id, names));
    },
    addConnection(kind: ConnectionKind) {
      setState(addConnection(state, kind, { x: 40, y: 40 }, { x: 240, y: 160 }));
    },
    getState: () => structuredClone(state),
  };

  // ---- helpers -----------------------------------------------------------
  function canvasPoint(event: { clientX: number; clientY: number }): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width / canvas.offsetWidth || 1;
    return {
      x: snapToGrid((event.clientX - rect.left) / scale),
      y: snapToGrid((event.clientY - rect.top) / scale),
    };
  }

  void canvasWrapper;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function download(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildGrid(width: number, height: number): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', CLS.grid);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));

  const defs = document.createElementNS(ns, 'defs');
  const pattern = document.createElementNS(ns, 'pattern');
  pattern.setAttribute('id', 'sc-grid-pattern');
  pattern.setAttribute('width', String(GRID));
  pattern.setAttribute('height', String(GRID));
  pattern.setAttribute('patternUnits', 'userSpaceOnUse');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', `M ${GRID} 0 L 0 0 0 ${GRID}`);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'var(--grid-line)');
  path.setAttribute('stroke-width', '1');
  pattern.appendChild(path);
  defs.appendChild(pattern);
  svg.appendChild(defs);

  const rect = document.createElementNS(ns, 'rect');
  rect.setAttribute('width', '100%');
  rect.setAttribute('height', '100%');
  rect.setAttribute('fill', 'url(#sc-grid-pattern)');
  svg.appendChild(rect);
  return svg;
}

function buildShell(root: HTMLElement) {
  root.replaceChildren();

  const toolbar = document.createElement('header');
  toolbar.className = CLS.toolbar;
  toolbar.innerHTML = `
    <button type="button" data-action="mode" aria-pressed="false">Draw cable</button>
    <button type="button" data-action="label">Add label</button>
    <span class="${CLS.toolbarSpacer}"></span>
    <button type="button" data-action="undo">Undo</button>
    <button type="button" data-action="redo">Redo</button>
    <button type="button" data-action="open">Open</button>
    <button type="button" data-action="save">Save</button>
    <button type="button" data-action="print">Print</button>`;

  const body = document.createElement('div');
  body.style.display = 'flex';
  body.style.flex = '1';
  body.style.minHeight = '0';

  const sidebar = document.createElement('aside');
  sidebar.className = CLS.sidebar;

  const projectInputs: Record<string, HTMLInputElement> = {};
  const details = document.createElement('section');
  details.appendChild(heading('Project details'));
  for (const [field, label, type] of [
    ['name', 'Name', 'text'],
    ['date', 'Date', 'date'],
    ['version', 'Version', 'text'],
    ['preparedBy', 'Prepared by', 'text'],
    ['reference', 'Reference', 'text'],
  ] as const) {
    const id = `field-${field}`;
    const labelEl = document.createElement('label');
    labelEl.htmlFor = id;
    labelEl.textContent = label;
    const input = document.createElement('input');
    input.id = id;
    input.type = type;
    if (field === 'name') input.value = 'Schematic';
    if (field === 'version') input.value = '1.0';
    projectInputs[field] = input;
    details.appendChild(labelEl);
    details.appendChild(input);
  }

  const dpuOut = document.createElement('output');
  const circuitsOut = document.createElement('output');
  details.appendChild(metric('DPU (DIN)', dpuOut));
  details.appendChild(metric('Wired RAK circuits', circuitsOut));
  sidebar.appendChild(details);

  const palette = document.createElement('section');
  palette.className = CLS.palette;
  palette.appendChild(heading('Components'));
  for (const { group, items } of paletteGroups()) {
    const wrapper = document.createElement('div');
    wrapper.className = CLS.paletteGroup;

    const header = document.createElement('button');
    header.type = 'button';
    header.className = CLS.paletteGroupHeader;
    header.setAttribute('aria-expanded', String(group === 'RAKs'));
    header.innerHTML = `<span>${group}</span><span aria-hidden="true">▾</span>`;

    const list = document.createElement('div');
    for (const spec of items) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = CLS.paletteItem;
      item.draggable = true;
      item.dataset.type = spec.type;
      item.innerHTML = `<img src="${ASSET_BASE}/${spec.image}" alt=""><span></span>`;
      item.querySelector('span')!.textContent = spec.name;
      list.appendChild(item);
    }

    header.addEventListener('click', () => {
      const open = header.getAttribute('aria-expanded') === 'true';
      header.setAttribute('aria-expanded', String(!open));
    });

    wrapper.appendChild(header);
    wrapper.appendChild(list);
    palette.appendChild(wrapper);
  }
  sidebar.appendChild(palette);

  const canvasWrapper = document.createElement('main');
  canvasWrapper.className = CLS.canvasWrapper;

  const canvas = document.createElement('div');
  canvas.className = CLS.canvas;

  const drawingLayer = document.createElement('div');
  drawingLayer.style.position = 'absolute';
  drawingLayer.style.inset = '0';

  const emptyState = document.createElement('div');
  emptyState.className = CLS.emptyState;
  emptyState.innerHTML =
    '<strong>Your drawing starts here</strong>Drag a component from the left onto the page. Everything inside this sheet is what prints.';

  canvas.appendChild(drawingLayer);
  canvas.appendChild(emptyState);
  canvasWrapper.appendChild(canvas);

  body.appendChild(sidebar);
  body.appendChild(canvasWrapper);
  root.appendChild(toolbar);
  root.appendChild(body);

  const modeButton = toolbar.querySelector<HTMLElement>('[data-action="mode"]')!;
  const undoButton = toolbar.querySelector<HTMLButtonElement>('[data-action="undo"]')!;
  const redoButton = toolbar.querySelector<HTMLButtonElement>('[data-action="redo"]')!;

  return {
    toolbar,
    sidebar,
    canvas,
    canvasWrapper,
    drawingLayer,
    emptyState,
    projectInputs,
    modeButton,
    undoButton,
    redoButton,
    dpuOut,
    circuitsOut,
  };
}

function heading(text: string): HTMLElement {
  const h = document.createElement('h2');
  h.textContent = text;
  return h;
}

function metric(label: string, output: HTMLOutputElement): HTMLElement {
  const wrap = document.createElement('div');
  const l = document.createElement('label');
  l.textContent = label;
  wrap.appendChild(l);
  wrap.appendChild(output);
  return wrap;
}
