/**
 * Print geometry and fit-to-page maths.
 *
 * Everything here is pure: no DOM, no globals. That is deliberate — in the
 * previous tool the page dimensions were computed in one place for the
 * on-screen page guide and again in another for the print transform, and the
 * two drifted. One module, one set of constants, unit-tested.
 */

/** A4 landscape, in millimetres. */
export const PAGE = {
  widthMm: 297,
  heightMm: 210,
  /** Margin on every edge. */
  marginMm: 10,
  /** Strip along the bottom reserved for the title block and notes. */
  infoBlockMm: 38.4,
  /** CSS reference pixels per inch. */
  dpi: 96,
} as const;

/** Padding inside the printable area so content never touches the margin. */
export const PRINT_PADDING_PX = 8;

/**
 * Smallest scale we will shrink a drawing to. Below this the 8px circuit
 * labels stop being readable, so we clamp and warn instead of shrinking on.
 */
export const MIN_PRINT_SCALE = 0.5;

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FitTransform {
  scale: number;
  translateX: number;
  translateY: number;
  /** True when the drawing needed shrinking past MIN_PRINT_SCALE and was clamped. */
  clamped: boolean;
}

const mmToPx = (mm: number): number => (mm / 25.4) * PAGE.dpi;

/** The whole printable sheet, margins excluded. */
export function pageBoxPx(): Size {
  return {
    width: mmToPx(PAGE.widthMm - 2 * PAGE.marginMm),
    height: mmToPx(PAGE.heightMm - 2 * PAGE.marginMm),
  };
}

/**
 * The area the drawing itself may occupy: the sheet minus the title block.
 * This is also the size of the on-screen canvas, so what you draw on is
 * exactly what prints — no invisible off-page region to wander into.
 */
export function drawingAreaPx(): Size {
  return {
    width: mmToPx(PAGE.widthMm - 2 * PAGE.marginMm),
    height: mmToPx(PAGE.heightMm - 2 * PAGE.marginMm - PAGE.infoBlockMm),
  };
}

/** Union of a list of rectangles, or null when there is nothing to bound. */
export function unionRects(rects: readonly Rect[]): Rect | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let found = false;

  for (const r of rects) {
    if (![r.x, r.y, r.width, r.height].every(Number.isFinite)) continue;
    found = true;
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.width > maxX) maxX = r.x + r.width;
    if (r.y + r.height > maxY) maxY = r.y + r.height;
  }

  if (!found) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Work out how to place `content` on `area`.
 *
 * Never enlarges: a two-component drawing prints at its true size rather than
 * blown up across the sheet. Shrinks only as far as MIN_PRINT_SCALE, then
 * reports `clamped` so the caller can warn instead of printing something
 * illegible.
 */
export function fitToArea(
  content: Rect | null,
  area: Size,
  padding: number = PRINT_PADDING_PX,
): FitTransform | null {
  if (!content || content.width <= 0 || content.height <= 0) return null;

  const targetW = area.width - padding * 2;
  const targetH = area.height - padding * 2;
  if (targetW <= 0 || targetH <= 0) return null;

  const ideal = Math.min(targetW / content.width, targetH / content.height, 1);
  const clamped = ideal < MIN_PRINT_SCALE;
  const scale = clamped ? MIN_PRINT_SCALE : ideal;

  // Centre whatever room is left over.
  const offsetX = padding + Math.max(0, (targetW - content.width * scale) / 2);
  const offsetY = padding + Math.max(0, (targetH - content.height * scale) / 2);

  return {
    scale,
    translateX: offsetX - content.x * scale,
    translateY: offsetY - content.y * scale,
    clamped,
  };
}

/** Render a FitTransform as a CSS transform value. */
export function toCssTransform(fit: FitTransform | null): string {
  if (!fit) return 'none';
  return `translate(${fit.translateX}px, ${fit.translateY}px) scale(${fit.scale})`;
}
