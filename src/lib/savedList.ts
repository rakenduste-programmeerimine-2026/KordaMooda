import { useSyncExternalStore } from "react";

/**
 * Lists that earlier versions kept only in this browser (#15).
 * v1: the prototype (number ids). v2: briefly used before the server took over (#11).
 */
const KEYS = ["kordamooda.v2", "kordamooda.v1"];

const listeners = new Set<() => void>();

function read(): string | null {
  try {
    for (const key of KEYS) {
      const raw = localStorage.getItem(key);
      if (raw) return raw;
    }
  } catch {
    // Storage blocked: nothing to move over.
  }
  return null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The raw saved list, or null. Always null on the server. */
export function useSavedList(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

/** After the list is on the server, the local copy goes, so it isn't offered again. */
export function forgetSavedList(): void {
  try {
    KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Nothing we can do; it would just be offered again.
  }
  listeners.forEach((listener) => listener());
}
