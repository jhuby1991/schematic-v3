/**
 * The data model.
 *
 * This is the whole state of a drawing, as plain serialisable data. Nothing
 * here knows the DOM exists.
 *
 * In the previous tool the DOM *was* the model: state lived in elements, saving
 * walked the DOM, and printing cloned it. That is why printing needed a cloned
 * subtree with duplicate `id="drawing-canvas"` attributes, why labels carried
 * inline styles the print stylesheet could not override, and why screen and
 * print could disagree. Here both screen and print are renderings *of this
 * model*, so they cannot drift structurally.
 */

/** Cable types. These colours are meaningful on a schematic — never theme them. */
export const CONNECTION_KINDS = {
  default: { label: 'Default', colour: '#000000', dashed: false, key: 'q' },
  cat5: { label: 'CAT5/6', colour: '#28a745', dashed: false, key: 'w' },
  rj45: { label: 'RJ45', colour: '#007bff', dashed: false, key: 'a' },
  rj11: { label: 'RJ11', colour: '#ff8c00', dashed: false, key: 's' },
  dinBus: { label: 'DIN Bus', colour: '#7A3EA0', dashed: false, key: 'd' },
  dali: { label: 'DALI', colour: '#dc3545', dashed: false, key: 'r' },
  zone: { label: 'Zone', colour: '#000000', dashed: true, key: 'f' },
} as const;

export type ConnectionKind = keyof typeof CONNECTION_KINDS;

export interface Point {
  x: number;
  y: number;
}

/** A component placed on the canvas. */
export interface PlacedComponent {
  id: string;
  /** Key into the component catalogue. */
  type: string;
  x: number;
  y: number;
  /**
   * Circuit names, for components whose catalogue entry declares outputs.
   * Empty strings are not rendered.
   */
  circuits?: string[];
}

/** A free text label the user has placed. */
export interface TextLabel {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  bold: boolean;
  underline: boolean;
  background: boolean;
}

/** A cable drawn between two points on the canvas. */
export interface Connection {
  id: string;
  kind: ConnectionKind;
  from: Point;
  to: Point;
}

/** Title-block metadata. Customer-facing wording, not sales wording. */
export interface ProjectDetails {
  name: string;
  date: string;
  version: string;
  preparedBy: string;
  reference: string;
}

export interface Schematic {
  components: PlacedComponent[];
  labels: TextLabel[];
  connections: Connection[];
  project: ProjectDetails;
}

export function emptyProject(): ProjectDetails {
  return { name: 'Schematic', date: '', version: '1.0', preparedBy: '', reference: '' };
}

export function emptySchematic(): Schematic {
  return { components: [], labels: [], connections: [], project: emptyProject() };
}
