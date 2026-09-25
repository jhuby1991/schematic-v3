/**
 * Operations on a Schematic. Pure functions over plain data — no DOM, no
 * mutation of the argument, so every one of these is trivially testable and
 * undo/redo is just an array of snapshots.
 */

import { CATALOGUE, GRID, sizeOf, snapToGrid, specFor } from './catalogue';
import type { Rect } from './geometry';
import {
  emptySchematic,
  type Connection,
  type ConnectionKind,
  type PlacedComponent,
  type ProjectDetails,
  type Schematic,
  type TextLabel,
} from './types';

let idCounter = 0;
/** Ids only need to be unique within a drawing; the counter resets on load. */
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}
export function resetIds(): void {
  idCounter = 0;
}

export function addComponent(s: Schematic, type: string, x: number, y: number): Schematic {
  const spec = specFor(type);
  if (!spec) return s;
  const component: PlacedComponent = {
    id: nextId('c'),
    type,
    x: snapToGrid(x),
    y: snapToGrid(y),
    circuits: spec.outputs ? new Array(spec.outputs).fill('') : undefined,
  };
  return { ...s, components: [...s.components, component] };
}

export function moveComponent(s: Schematic, id: string, x: number, y: number): Schematic {
  return {
    ...s,
    components: s.components.map((c) =>
      c.id === id ? { ...c, x: snapToGrid(x), y: snapToGrid(y) } : c,
    ),
  };
}

export function setCircuits(s: Schematic, id: string, circuits: string[]): Schematic {
  return {
    ...s,
    components: s.components.map((c) => (c.id === id ? { ...c, circuits: [...circuits] } : c)),
  };
}

export function addLabel(s: Schematic, x: number, y: number, text = ''): Schematic {
  const label: TextLabel = {
    id: nextId('t'),
    x: snapToGrid(x),
    y: snapToGrid(y),
    text,
    fontSize: 12,
    bold: false,
    underline: false,
    background: true,
  };
  return { ...s, labels: [...s.labels, label] };
}

export function updateLabel(s: Schematic, id: string, patch: Partial<TextLabel>): Schematic {
  return { ...s, labels: s.labels.map((l) => (l.id === id ? { ...l, ...patch } : l)) };
}

export function addConnection(
  s: Schematic,
  kind: ConnectionKind,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Schematic {
  const connection: Connection = { id: nextId('n'), kind, from, to };
  return { ...s, connections: [...s.connections, connection] };
}

/** Remove any items whose id appears in `ids`, whatever kind they are. */
export function removeItems(s: Schematic, ids: readonly string[]): Schematic {
  const drop = new Set(ids);
  return {
    ...s,
    components: s.components.filter((c) => !drop.has(c.id)),
    labels: s.labels.filter((l) => !drop.has(l.id)),
    connections: s.connections.filter((n) => !drop.has(n.id)),
  };
}

export function setProject(s: Schematic, patch: Partial<ProjectDetails>): Schematic {
  return { ...s, project: { ...s.project, ...patch } };
}

/** Bounding box of a single component, including its circuit labels. */
export function componentBounds(c: PlacedComponent, labelWidthEstimate = 70): Rect {
  const spec = specFor(c.type);
  if (!spec) return { x: c.x, y: c.y, width: GRID, height: GRID };
  const { width, height } = sizeOf(spec);
  const hasLabels = !!c.circuits?.some((t) => t.trim() !== '');
  return {
    x: c.x,
    y: c.y,
    width: width + (hasLabels ? labelWidthEstimate : 0),
    height,
  };
}

/** Every drawn thing as a rectangle, for fit-to-page. */
export function contentRects(s: Schematic): Rect[] {
  const rects: Rect[] = [];
  for (const c of s.components) rects.push(componentBounds(c));
  for (const l of s.labels) {
    rects.push({
      x: l.x,
      y: l.y,
      width: Math.max(20, l.text.length * l.fontSize * 0.6),
      height: l.fontSize * 1.3,
    });
  }
  for (const n of s.connections) {
    rects.push({
      x: Math.min(n.from.x, n.to.x),
      y: Math.min(n.from.y, n.to.y),
      width: Math.abs(n.to.x - n.from.x),
      height: Math.abs(n.to.y - n.from.y),
    });
  }
  return rects;
}

export interface Counters {
  dpuUsed: number;
  dpuAvailable: number;
  circuitsUsed: number;
  circuitsAvailable: number;
}

export function counters(s: Schematic): Counters {
  let dpuUsed = 0;
  let dpuAvailable = 0;
  let circuitsUsed = 0;
  let circuitsAvailable = 0;

  for (const c of s.components) {
    const spec = specFor(c.type);
    if (!spec) continue;
    dpuUsed += spec.dpuLoad ?? 0;
    dpuAvailable += spec.dpuSupply ?? 0;
    circuitsAvailable += spec.circuitSupply ?? 0;
    if (spec.circuitSupply) circuitsUsed += c.circuits?.filter((t) => t.trim()).length ?? 0;
  }

  return { dpuUsed, dpuAvailable, circuitsUsed, circuitsAvailable };
}

export { emptySchematic, CATALOGUE };
