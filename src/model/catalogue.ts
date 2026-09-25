/**
 * The component catalogue: one declarative table describing every part that
 * can be placed on a drawing.
 *
 * In the previous tool a component's size, image, group, label behaviour and
 * print quirks were spread across the palette markup, a `getTypeGridSize`
 * switch, several `[data-type="..."]` CSS rules and a few special cases in the
 * renderer. Adding a part meant touching all of them and remembering the
 * quirks. Here a part is one entry, and the palette, renderer and counters all
 * read from it.
 */

export const GRID = 10;

export interface ComponentSpec {
  /** Stable key. Written into saved files, so do not rename casually. */
  readonly type: string;
  readonly name: string;
  readonly group: string;
  /** Size in grid units. Actual pixels are gridUnits * GRID. */
  readonly widthUnits: number;
  readonly heightUnits: number;
  /** Image file inside public/components/. */
  readonly image: string;
  /** Number of switched circuits, for parts that have labelled outputs. */
  readonly outputs?: number;
  /** DIN power units consumed, for the DPU counter. */
  readonly dpuLoad?: number;
  /** DIN power units supplied. */
  readonly dpuSupply?: number;
  /** Wired RAK circuits supplied. */
  readonly circuitSupply?: number;
}

export const CATALOGUE: readonly ComponentSpec[] = Object.freeze([
  // --- RAKs -------------------------------------------------------------
  { type: 'RAK8', name: 'RAK8', group: 'RAKs', widthUnits: 11, heightUnits: 7, image: 'rak8.png', outputs: 8, circuitSupply: 8 },
  { type: 'RAKLink', name: 'RAK-Link', group: 'RAKs', widthUnits: 11, heightUnits: 3, image: 'rak-link.png' },
  { type: 'RAKStar', name: 'RAK-Star', group: 'RAKs', widthUnits: 11, heightUnits: 4, image: 'rak-star.png' },

  // --- DIN --------------------------------------------------------------
  { type: 'DIN4C', name: 'DIN-4C', group: 'DIN', widthUnits: 4, heightUnits: 6, image: 'din-4c.png', outputs: 4, dpuLoad: 4 },
  { type: 'DIN4T', name: 'DIN-4T', group: 'DIN', widthUnits: 4, heightUnits: 6, image: 'din-4t.png', outputs: 4, dpuLoad: 4 },
  // 9 units tall, not 6: eight circuits need eight label slots, and
  // tests/unit/labels.test.ts enforces that a part can hold its own labels.
  { type: 'DIN8S', name: 'DIN-8S', group: 'DIN', widthUnits: 6, heightUnits: 9, image: 'din-8s.png', outputs: 8, dpuLoad: 8 },
  { type: 'DINLink', name: 'DIN-LINK', group: 'DIN', widthUnits: 3, heightUnits: 6, image: 'din-link.png', dpuSupply: 64 },
  { type: 'DINPSU100', name: 'DIN-PSU-100', group: 'DIN', widthUnits: 4, heightUnits: 6, image: 'din-psu.png' },
  { type: 'DINDLI', name: 'DIN-DLI', group: 'DIN', widthUnits: 4, heightUnits: 6, image: 'din-dli.png', outputs: 2 },

  // --- Keypads ----------------------------------------------------------
  { type: 'KeypadWCM', name: 'WCM', group: 'Keypads', widthUnits: 3, heightUnits: 4, image: 'wcm.png' },
  { type: 'KeypadEOS', name: 'WK-EOS', group: 'Keypads', widthUnits: 3, heightUnits: 4, image: 'wk-eos.png' },
  { type: 'KeypadMOD', name: 'WK-MOD', group: 'Keypads', widthUnits: 3, heightUnits: 4, image: 'wk-mod.png' },
  { type: 'RCM', name: 'RCM', group: 'Keypads', widthUnits: 2, heightUnits: 2, image: 'rcm.png' },

  // --- Hub and sensors --------------------------------------------------
  { type: 'HUB', name: 'HUB', group: 'HUB', widthUnits: 6, heightUnits: 4, image: 'hub.png' },
  { type: 'SensorPIR', name: 'PIR Sensor', group: 'Sensors', widthUnits: 2, heightUnits: 6, image: 'pir.png' },
]);

const BY_TYPE = new Map(CATALOGUE.map((c) => [c.type, c]));

export function specFor(type: string): ComponentSpec | undefined {
  return BY_TYPE.get(type);
}

export function sizeOf(spec: ComponentSpec): { width: number; height: number } {
  return { width: spec.widthUnits * GRID, height: spec.heightUnits * GRID };
}

/** Palette groups, in display order, derived from the catalogue itself. */
export function paletteGroups(): { group: string; items: ComponentSpec[] }[] {
  const order: string[] = [];
  const byGroup = new Map<string, ComponentSpec[]>();
  for (const spec of CATALOGUE) {
    if (!byGroup.has(spec.group)) {
      byGroup.set(spec.group, []);
      order.push(spec.group);
    }
    byGroup.get(spec.group)!.push(spec);
  }
  return order.map((group) => ({ group, items: byGroup.get(group)! }));
}

export function snapToGrid(value: number): number {
  return Math.round(value / GRID) * GRID;
}
