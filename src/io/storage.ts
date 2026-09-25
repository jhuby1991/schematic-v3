/**
 * Browser-local autosave.
 *
 * Every access is wrapped: localStorage throws in private windows and when
 * site data is blocked, and a drawing tool must not fail to open because of
 * it. Recovery is offered through a non-blocking bar rather than a
 * `confirm()` dialog fired before the user has even seen the page.
 */

import { fromParsed, SCHEMA_VERSION } from './serialise';
import type { Schematic } from '../model/types';

const KEY = 'schematic-v3:autosave';
/** Older autosaves are discarded rather than offered. */
const MAX_AGE_MS = 60 * 60 * 1000;

interface AutosaveRecord {
  schemaVersion: number;
  savedAt: number;
  schematic: Schematic;
}

export function saveAutosave(s: Schematic): void {
  try {
    const record: AutosaveRecord = {
      schemaVersion: SCHEMA_VERSION,
      savedAt: Date.now(),
      schematic: s,
    };
    localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    // Storage unavailable or full. Autosave is a convenience, never required.
  }
}

export interface Recoverable {
  schematic: Schematic;
  ageMinutes: number;
}

export function readAutosave(): Recoverable | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const record = JSON.parse(raw) as AutosaveRecord;
    const age = Date.now() - (record.savedAt ?? 0);
    if (age >= MAX_AGE_MS) {
      clearAutosave();
      return null;
    }
    const schematic = fromParsed({
      schemaVersion: record.schemaVersion,
      schematic: record.schematic,
    });
    return { schematic, ageMinutes: Math.floor(age / 60000) };
  } catch {
    clearAutosave();
    return null;
  }
}

export function clearAutosave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}

/** Debounced autosave, so typing in a label does not write on every keystroke. */
export function createAutosaver(delayMs = 500): (s: Schematic) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (s: Schematic) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => saveAutosave(s), delayMs);
  };
}
