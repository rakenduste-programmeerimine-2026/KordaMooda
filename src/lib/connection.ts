import { useSyncExternalStore } from "react";
import type { Result } from "./result";

const OFFLINE_ERROR =
  "Ühendus puudub. Muudatus jäi tegemata, proovi uuesti, kui internet on tagasi.";
const SERVER_ERROR = "Server ei vastanud. Muudatus jäi tegemata, proovi uuesti.";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** False while the device has no network. The server render assumes it is online. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/**
 * Calls a server action from the browser. Actions return their own Estonian errors, but a
 * dropped connection or a crashed server throws instead; that becomes an ordinary failed
 * Result here, so the UI shows a toast rather than a blank error page.
 */
export async function callAction<T>(request: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await request();
  } catch (caught) {
    console.error(caught);
    // A dropped request and a server crash look much the same from here.
    return { ok: false, error: navigator.onLine ? SERVER_ERROR : OFFLINE_ERROR };
  }
}
