/**
 * Saving and loading.
 *
 * Saved files carry a schema version. The previous tool's files did not, so
 * there was no safe way to change the shape of a drawing without silently
 * breaking every file already in customers' hands. `migrate` gives us a place
 * to handle old files explicitly.
 */

import { emptySchematic, type Schematic } from '../model/types';
import { resetIds } from '../model/schematic';

export const SCHEMA_VERSION = 1;

export interface SchematicFile {
  schemaVersion: number;
  savedAt: string;
  schematic: Schematic;
}

export function serialise(s: Schematic): string {
  const file: SchematicFile = {
    schemaVersion: SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    schematic: s,
  };
  return JSON.stringify(file, null, 2);
}

export class SchematicParseError extends Error {}

/**
 * Parse a saved file. Throws SchematicParseError with a message fit to show a
 * user — never a raw JSON.parse error.
 */
export function deserialise(raw: string): Schematic {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new SchematicParseError("That file isn't a saved schematic.");
  }
  return fromParsed(parsed);
}

export function fromParsed(parsed: unknown): Schematic {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new SchematicParseError("That file isn't a saved schematic.");
  }
  const file = parsed as Partial<SchematicFile>;

  if (typeof file.schemaVersion !== 'number' || !file.schematic) {
    throw new SchematicParseError('That file is missing its schematic data.');
  }
  if (file.schemaVersion > SCHEMA_VERSION) {
    throw new SchematicParseError(
      'That drawing was saved by a newer version of this tool. Please update and try again.',
    );
  }

  const migrated = migrate(file.schematic, file.schemaVersion);
  resetIds();
  return normalise(migrated);
}

/** Bring an older file up to the current schema. */
function migrate(s: Schematic, from: number): Schematic {
  let current = s;
  // No migrations yet — version 1 is the first released schema. Each future
  // bump adds one step here, so old files keep opening.
  if (from < 1) current = { ...emptySchematic(), ...current };
  return current;
}

/** Defend against hand-edited or truncated files without throwing. */
function normalise(s: Schematic): Schematic {
  const base = emptySchematic();
  return {
    components: Array.isArray(s.components) ? s.components : base.components,
    labels: Array.isArray(s.labels) ? s.labels : base.labels,
    connections: Array.isArray(s.connections) ? s.connections : base.connections,
    project: { ...base.project, ...(s.project ?? {}) },
  };
}

/** Filename for a downloaded drawing, from the project details. */
export function suggestedFilename(name: string, version: string): string {
  const safe = (v: string) => v.replace(/[^a-z0-9_.-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  const base = safe(name) || 'schematic';
  const ver = version.trim() ? `-v${safe(version)}` : '';
  return `${base}${ver}.json`;
}
