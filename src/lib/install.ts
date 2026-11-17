import { useSyncExternalStore } from "react";

/**
 * Whether to suggest adding the app to the home screen, and how (#20).
 * - "prompt": Chrome on Android can show its own install dialog.
 * - "ios": iPhone/iPad have no dialog; the user does it from the share menu.
 * - "none": already installed, dismissed, or not possible here.
 */
export type InstallHint = "prompt" | "ios" | "none";

/** Chrome's install event. Not in TypeScript's DOM types yet. */
type InstallPromptEvent = Event & { prompt: () => Promise<void> };

const DISMISSED_KEY = "kordamooda.install-hint-dismissed";

const listeners = new Set<() => void>();
let deferred: InstallPromptEvent | null = null;
let installed = false;
let dismissed: boolean | null = null;

function notify() {
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  // Chrome fires this once, early, possibly before React has rendered anything.
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    notify();
  });
}

function isDismissed(): boolean {
  if (dismissed === null) {
    try {
      dismissed = localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      dismissed = false;
    }
  }
  return dismissed;
}

function isStandalone(): boolean {
  return (
    matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    // iPadOS says it is a Mac.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function getSnapshot(): InstallHint {
  if (installed || isStandalone() || isDismissed()) return "none";
  if (deferred) return "prompt";
  return isIos() ? "ios" : "none";
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useInstallHint(): InstallHint {
  return useSyncExternalStore(subscribe, getSnapshot, () => "none");
}

/** Opens Chrome's install dialog. */
export async function promptInstall(): Promise<void> {
  const event = deferred;
  if (!event) return;
  deferred = null; // The event can only be used once.
  await event.prompt();
  notify();
}

/** "Hiljem": don't suggest it again on this phone. */
export function dismissInstallHint(): void {
  dismissed = true;
  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // Storage blocked: it stays hidden until the page is reloaded.
  }
  notify();
}
