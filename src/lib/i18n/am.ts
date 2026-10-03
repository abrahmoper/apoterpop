/**
 * Deprecated shape, kept as a thin view over `messages.ts` — see `./en`.
 * Strings live as [English, Amharic] tuples in `messages.ts`; this projects the
 * Amharic side, falling back to English where a translation is intentionally
 * shared (numbers, brand names, "24/7").
 */
import { projectDictionary, type Dictionary } from "./en";

export type { Dictionary };

export const am: Dictionary = projectDictionary(1);

export default am;
