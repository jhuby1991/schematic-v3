/**
 * Saving and loading.
 *
 * Saved drawings are the one artefact customers keep, so opening an old file
 * must never throw a raw JSON error at them or silently lose data.
 */

import { describe, expect, it } from 'vitest';
import {
  SCHEMA_VERSION,
  SchematicParseError,
  deserialise,
  serialise,
  suggestedFilename,
} from '../../src/io/serialise';
import { addComponent, addLabel, setCircuits } from '../../src/model/schematic';
import { emptySchematic } from '../../src/model/types';

function sample() {
  let s = addComponent(emptySchematic(), 'RAK8', 40, 60);
  s = setCircuits(s, s.components[0]!.id, ['Kitchen', '', '', '', '', '', '', '']);
  s = addLabel(s, 10, 10, 'Note');
  s.project.name = 'Oakfield House';
  return s;
}

describe('serialise / deserialise', () => {
  it('round-trips a drawing without loss', () => {
    const original = sample();
    const restored = deserialise(serialise(original));
    expect(restored.components).toEqual(original.components);
    expect(restored.labels).toEqual(original.labels);
    expect(restored.project).toEqual(original.project);
  });

  it('stamps the schema version', () => {
    expect(JSON.parse(serialise(sample())).schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('rejects files from a newer version with an actionable message', () => {
    const future = JSON.stringify({ schemaVersion: SCHEMA_VERSION + 1, schematic: emptySchematic() });
    expect(() => deserialise(future)).toThrow(SchematicParseError);
    expect(() => deserialise(future)).toThrow(/newer version/i);
  });

  it('explains itself rather than leaking a JSON error', () => {
    expect(() => deserialise('not json at all')).toThrow(SchematicParseError);
    expect(() => deserialise('not json at all')).toThrow(/isn't a saved schematic/i);
  });

  it('rejects JSON that is valid but not a schematic', () => {
    expect(() => deserialise('{"hello":"world"}')).toThrow(SchematicParseError);
  });

  it('survives a truncated or hand-edited file by filling in defaults', () => {
    const partial = JSON.stringify({
      schemaVersion: 1,
      schematic: { components: [{ id: 'c1', type: 'RAK8', x: 0, y: 0 }] },
    });
    const restored = deserialise(partial);
    expect(restored.components).toHaveLength(1);
    expect(restored.labels).toEqual([]);
    expect(restored.connections).toEqual([]);
    expect(restored.project.name).toBe('Schematic');
  });
});

describe('suggestedFilename', () => {
  it('uses the project name and version', () => {
    expect(suggestedFilename('Oakfield House', '1.2')).toBe('oakfield-house-v1.2.json');
  });

  it('strips characters that are awkward in filenames', () => {
    expect(suggestedFilename('Flat 3/4 — "rear"', '')).toBe('flat-3-4-rear.json');
  });

  it('falls back when the name is empty', () => {
    expect(suggestedFilename('', '')).toBe('schematic.json');
  });
});
