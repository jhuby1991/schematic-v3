/**
 * Fit-to-page maths. Pure functions, so these are cheap and exact — no browser
 * needed to know whether a drawing will land on the page.
 */

import { describe, expect, it } from 'vitest';
import {
  MIN_PRINT_SCALE,
  PRINT_PADDING_PX,
  drawingAreaPx,
  fitToArea,
  pageBoxPx,
  toCssTransform,
  unionRects,
} from '../../src/model/geometry';

describe('page geometry', () => {
  it('matches A4 landscape at 96dpi, less margins', () => {
    const page = pageBoxPx();
    // (297 - 20)mm and (210 - 20)mm converted at 96dpi
    expect(page.width).toBeCloseTo(1046.93, 1);
    expect(page.height).toBeCloseTo(718.11, 1);
  });

  it('reserves the title block out of the drawing area', () => {
    expect(drawingAreaPx().height).toBeLessThan(pageBoxPx().height);
    expect(drawingAreaPx().width).toBeCloseTo(pageBoxPx().width, 5);
  });
});

describe('unionRects', () => {
  it('returns null for nothing', () => {
    expect(unionRects([])).toBeNull();
  });

  it('bounds every rectangle', () => {
    const union = unionRects([
      { x: 10, y: 10, width: 10, height: 10 },
      { x: 100, y: 50, width: 20, height: 20 },
    ]);
    expect(union).toEqual({ x: 10, y: 10, width: 110, height: 60 });
  });

  it('ignores non-finite rectangles rather than poisoning the union', () => {
    const union = unionRects([
      { x: 0, y: 0, width: 10, height: 10 },
      { x: NaN, y: 0, width: 10, height: 10 },
    ]);
    expect(union).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });
});

describe('fitToArea', () => {
  const area = { width: 1000, height: 500 };

  it('never enlarges a small drawing', () => {
    const fit = fitToArea({ x: 0, y: 0, width: 100, height: 50 }, area);
    expect(fit?.scale).toBe(1);
    expect(fit?.clamped).toBe(false);
  });

  it('centres a drawing that fits', () => {
    const fit = fitToArea({ x: 0, y: 0, width: 100, height: 50 }, area)!;
    const usableW = area.width - PRINT_PADDING_PX * 2;
    expect(fit.translateX).toBeCloseTo(PRINT_PADDING_PX + (usableW - 100) / 2, 5);
  });

  it('shrinks a drawing that overflows', () => {
    const fit = fitToArea({ x: 0, y: 0, width: 1500, height: 500 }, area)!;
    expect(fit.scale).toBeLessThan(1);
    expect(fit.scale).toBeGreaterThan(MIN_PRINT_SCALE);
    expect(fit.clamped).toBe(false);
  });

  it('clamps at the readability floor and says so', () => {
    const fit = fitToArea({ x: 0, y: 0, width: 100_000, height: 500 }, area)!;
    expect(fit.scale).toBe(MIN_PRINT_SCALE);
    expect(fit.clamped).toBe(true);
  });

  it('translates content back onto the page when it sits far from the origin', () => {
    const fit = fitToArea({ x: 5000, y: 3000, width: 100, height: 50 }, area)!;
    // The top-left of the content must land at or after the padding.
    expect(5000 * fit.scale + fit.translateX).toBeGreaterThanOrEqual(PRINT_PADDING_PX - 0.001);
    expect(3000 * fit.scale + fit.translateY).toBeGreaterThanOrEqual(PRINT_PADDING_PX - 0.001);
  });

  it('keeps fitted content inside the area whenever it did not clamp', () => {
    const content = { x: 120, y: 90, width: 1400, height: 400 };
    const fit = fitToArea(content, area)!;
    expect(fit.clamped).toBe(false);
    const right = (content.x + content.width) * fit.scale + fit.translateX;
    const bottom = (content.y + content.height) * fit.scale + fit.translateY;
    expect(right).toBeLessThanOrEqual(area.width + 0.001);
    expect(bottom).toBeLessThanOrEqual(area.height + 0.001);
  });

  it('anchors a clamped drawing at the top-left rather than centring the overflow', () => {
    // Past the readability floor the drawing cannot fit, so something is lost.
    // Losing the far edge keeps the start of the drawing readable; centring
    // would clip both sides. The caller warns the user either way.
    const content = { x: 0, y: 0, width: 100_000, height: 500 };
    const fit = fitToArea(content, area)!;
    expect(fit.clamped).toBe(true);
    expect(fit.translateX).toBeCloseTo(PRINT_PADDING_PX, 5);
  });

  it('returns null for an empty drawing', () => {
    expect(fitToArea(null, area)).toBeNull();
    expect(fitToArea({ x: 0, y: 0, width: 0, height: 0 }, area)).toBeNull();
    expect(toCssTransform(null)).toBe('none');
  });
});
