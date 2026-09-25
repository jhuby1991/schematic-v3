/**
 * Every CSS class this app owns, in one place.
 *
 * Why this exists: in the previous tool the renderer created `.output-label`
 * while the stylesheet still styled `.rak8-output-label`, and `.canvas-item`
 * while the stylesheet styled `.canvas-component` (36 rules). Nothing failed
 * loudly — the print rules simply stopped applying, and circuit labels printed
 * grey on an opaque white plate for months.
 *
 * Renderers must use these constants rather than string literals, and
 * `tests/unit/classes.test.ts` parses the stylesheets and asserts the two sets
 * match exactly. Rename a class and forget the CSS, and the test fails.
 */
export const CLS = {
  // Surfaces
  canvas: 'sc-canvas',
  canvasWrapper: 'sc-canvas-wrapper',
  grid: 'sc-grid',

  // Items on the canvas
  item: 'sc-item',
  itemSelected: 'is-selected',
  itemImage: 'sc-item-image',
  itemFallback: 'sc-item-fallback',

  // Circuit labels and their leader lines
  outputLabel: 'sc-output-label',
  outputLabelLines: 'sc-output-label-lines',

  // Connections
  connectionLayer: 'sc-connection-layer',
  connection: 'sc-connection',
  connectionSelected: 'is-selected',

  // Text labels placed by the user
  textLabel: 'sc-text-label',

  // Print
  printSheet: 'sc-print-sheet',
  printCanvas: 'sc-print-canvas',
  printTitleBlock: 'sc-print-title-block',
  printNotes: 'sc-print-notes',
  printLegend: 'sc-print-legend',

  // Chrome
  palette: 'sc-palette',
  paletteGroup: 'sc-palette-group',
  paletteGroupHeader: 'sc-palette-group-header',
  paletteItem: 'sc-palette-item',
  toolbar: 'sc-toolbar',
  toolbarSpacer: 'sc-toolbar-spacer',
  sidebar: 'sc-sidebar',
  emptyState: 'sc-empty-state',
  toast: 'sc-toast',
  toastContainer: 'sc-toast-container',
} as const;

export type ClassName = (typeof CLS)[keyof typeof CLS];

/** Every class name this app owns, for the stylesheet contract test. */
export const ALL_CLASSES: readonly string[] = Object.freeze(
  Array.from(new Set(Object.values(CLS))),
);
