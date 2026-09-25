/**
 * Layout for circuit labels and their leader lines.
 *
 * This is the calculation that went wrong in the previous tool. A RAK8 gives
 * each circuit about 8.25px of vertical room, but the label box rendered
 * 11.59px tall (8px font x 1.2 line-height, plus 1px padding top and bottom),
 * so every label overlapped the next by ~3.6px. Opaque white label backgrounds
 * hid it on screen and a 1.3x view zoom made it look merely "tight"; on paper
 * at 1:1 it was obvious.
 *
 * The maths now lives in one pure function with a test that asserts labels
 * never overlap, for every component in the catalogue that has outputs.
 */

export const LABEL_FONT_PX = 8;
/** Line-height 1 and no vertical padding: box height == font size. */
export const LABEL_LINE_HEIGHT = 1;
export const LABEL_BOX_HEIGHT = LABEL_FONT_PX * LABEL_LINE_HEIGHT;

/** Inset from the component edge where leader lines start. */
export const COMPONENT_INSET = 2;
/** Horizontal length of the leader line. */
export const LEADER_LENGTH = 10;
/** Gap between the end of the leader line and the label text. */
export const LABEL_GAP = 5;

export interface LabelLayout {
  /** Index of the circuit this label belongs to. */
  index: number;
  text: string;
  /** Left edge of the label box, relative to the component. */
  x: number;
  /** Top edge of the label box, relative to the component. */
  y: number;
  /** Vertical centre of this circuit's slot — where the leader line sits. */
  leaderY: number;
  leaderX1: number;
  leaderX2: number;
}

/**
 * Vertical room available per circuit. Exposed so tests can assert the label
 * box fits inside it rather than duplicating the formula.
 */
export function circuitPitch(componentHeight: number, outputs: number): number {
  if (outputs <= 0) return 0;
  return (componentHeight - 2 * COMPONENT_INSET) / outputs;
}

/**
 * Position each non-empty circuit label beside its component.
 *
 * Labels are vertically centred on their own leader line, so a label always
 * points at the circuit it names.
 */
export function layoutCircuitLabels(
  componentWidth: number,
  componentHeight: number,
  circuits: readonly string[],
): LabelLayout[] {
  const outputs = circuits.length;
  const pitch = circuitPitch(componentHeight, outputs);
  const out: LabelLayout[] = [];

  for (let i = 0; i < outputs; i++) {
    const text = (circuits[i] ?? '').trim();
    if (!text) continue; // an unnamed circuit gets no label and no leader line

    const leaderY = COMPONENT_INSET + (i + 0.5) * pitch;
    out.push({
      index: i,
      text,
      leaderY,
      leaderX1: componentWidth,
      leaderX2: componentWidth + LEADER_LENGTH,
      x: componentWidth + LEADER_LENGTH + LABEL_GAP,
      // Centre the box on the leader line.
      y: leaderY - LABEL_BOX_HEIGHT / 2,
    });
  }

  return out;
}

/**
 * True when the label boxes for this component can be stacked without
 * overlapping. The renderer does not need this, but the test suite does, and
 * keeping it beside the layout means the rule is stated once.
 */
export function labelsFit(componentHeight: number, outputs: number): boolean {
  return outputs === 0 || circuitPitch(componentHeight, outputs) >= LABEL_BOX_HEIGHT;
}
