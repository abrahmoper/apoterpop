/**
 * Deprecated shape, kept as a thin view over `messages.ts`.
 *
 * Kiray used to keep one file per language. Strings now live as
 * [English, Amharic] tuples in `messages.ts`, so a drifted translation is
 * obvious on the line itself. This module projects the English side for
 * anything that wants a flat `key -> string` map (exports, debugging, tests).
 */
import { MESSAGES, type MessageKey } from "./messages";

export type { MessageKey };
export type Dictionary = Record<MessageKey, string>;

/** 0 = English, 1 = Amharic; empty Amharic falls back to English. */
export function projectDictionary(index: 0 | 1): Dictionary {
  const out = {} as Dictionary;
  for (const key of Object.keys(MESSAGES) as MessageKey[]) {
    const pair = MESSAGES[key] as readonly [string, string];
    out[key] = pair[index] || pair[0];
  }
  return out;
}

export const en: Dictionary = projectDictionary(0);

export default en;
