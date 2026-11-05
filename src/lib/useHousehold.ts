import { useSyncExternalStore } from "react";
import { type Household, parseHousehold } from "./household";

const STORAGE_KEY = "kordamooda.v1";

const listeners = new Set<() => void>();
let unsaved: { raw: string | null } | null = null;
let cachedRaw: string | null = null;
let cachedHousehold: Household | null = null;

function readRaw(): string | null {
  if (unsaved) return unsaved.raw;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getSnapshot(): Household | null {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedHousehold = raw === null ? null : parseHousehold(raw);
  }
  return cachedHousehold;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Keeps other open tabs of this browser up to date.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function saveHousehold(household: Household | null): void {
  const raw = household && JSON.stringify(household);
  try {
    if (raw === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, raw);
    unsaved = null;
  } catch {
    // Storage is blocked or full. The app keeps working until the page closes.
    unsaved = { raw };
  }
  listeners.forEach((listener) => listener());
}

/** True when changes only live in memory and will be lost with the page. */
export function isUnsaved(): boolean {
  return unsaved !== null;
}

/** `undefined` until the browser's saved data has been read. */
export function useHousehold(): Household | null | undefined {
  return useSyncExternalStore(subscribe, getSnapshot, () => undefined);
}
