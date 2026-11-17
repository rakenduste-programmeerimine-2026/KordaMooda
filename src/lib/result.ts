import type { Household } from "./household.ts";

/**
 * What every server action returns. Actions never throw for problems the user can fix.
 *
 * - `error` is Estonian and is shown to the user as written.
 * - `latest` is set when someone else changed the household first (a conflict).
 *   The UI should show it instead of its own, now outdated, copy.
 */
export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; latest?: Household };
