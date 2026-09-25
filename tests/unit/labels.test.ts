/**
 * Circuit label layout.
 *
 * The previous tool gave each RAK8 circuit ~8.25px of vertical room but drew
 * an 11.59px label box, so every label overlapped the next by ~3.6px. It
 * shipped, because nothing checked. These tests check.
 */

import { describe, expect, it } from 'vitest';
import { CATALOGUE, sizeOf } from '../../src/model/catalogue';
import {
  LABEL_BOX_HEIGHT,
  circuitPitch,
  labelsFit,
  layoutCircuitLabels,
} from '../../src/model/labels';

describe('circuit label layout', () => {
  const withOutputs = CATALOGUE.filter((spec) => (spec.outputs ?? 0) > 0);

  it('covers at least one component with outputs', () => {
    expect(withOutputs.length).toBeGreaterThan(0);
  });

  it.each(withOutputs.map((spec) => [spec.name, spec] as const))(
    '%s: every circuit has room for its label',
    (_name, spec) => {
      const { height } = sizeOf(spec);
      const pitch = circuitPitch(height, spec.outputs!);
      expect(
        pitch,
        `${spec.name} allows ${pitch.toFixed(2)}px per circuit but a label box is ` +
          `${LABEL_BOX_HEIGHT}px tall. Either give the part more height or shrink the label.`,
      ).toBeGreaterThanOrEqual(LABEL_BOX_HEIGHT);
      expect(labelsFit(height, spec.outputs!)).toBe(true);
    },
  );

  it.each(withOutputs.map((spec) => [spec.name, spec] as const))(
    '%s: rendered labels never overlap',
    (_name, spec) => {
      const { width, height } = sizeOf(spec);
      const circuits = Array.from({ length: spec.outputs! }, (_, i) => `Circuit ${i + 1}`);
      const layouts = layoutCircuitLabels(width, height, circuits);

      expect(layouts).toHaveLength(spec.outputs!);
      for (let i = 1; i < layouts.length; i++) {
        const previousBottom = layouts[i - 1]!.y + LABEL_BOX_HEIGHT;
        expect(
          layouts[i]!.y,
          `label ${i + 1} starts at ${layouts[i]!.y} but label ${i} ends at ${previousBottom}`,
        ).toBeGreaterThanOrEqual(previousBottom);
      }
    },
  );

  it('centres each label on its own leader line', () => {
    const spec = withOutputs[0]!;
    const { width, height } = sizeOf(spec);
    const circuits = Array.from({ length: spec.outputs! }, (_, i) => `C${i}`);
    for (const l of layoutCircuitLabels(width, height, circuits)) {
      expect(l.y + LABEL_BOX_HEIGHT / 2).toBeCloseTo(l.leaderY, 5);
    }
  });

  it('skips circuits with no name, and their leader lines', () => {
    const layouts = layoutCircuitLabels(110, 70, ['Kitchen', '', '   ', 'Hall']);
    expect(layouts.map((l) => l.text)).toEqual(['Kitchen', 'Hall']);
    expect(layouts.map((l) => l.index)).toEqual([0, 3]);
  });

  it('stays inside the component vertically', () => {
    const spec = withOutputs[0]!;
    const { width, height } = sizeOf(spec);
    const circuits = Array.from({ length: spec.outputs! }, (_, i) => `C${i}`);
    const layouts = layoutCircuitLabels(width, height, circuits);
    expect(layouts[0]!.y).toBeGreaterThanOrEqual(0);
    expect(layouts.at(-1)!.y + LABEL_BOX_HEIGHT).toBeLessThanOrEqual(height);
  });
});
