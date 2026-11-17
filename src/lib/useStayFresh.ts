import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

/** Waking a phone fires both "visibilitychange" and "focus"; one reload is enough. */
const MIN_GAP_MS = 2_000;

/**
 * Keeps the page in step with the server when this phone has missed changes (#13, #14):
 * when it comes out of a pocket, when its window gets focus and when the network returns.
 *
 * Returns `refresh`, which reloads the household from the server. The page compares the new
 * copy with its own and points out what the other phone changed. Realtime events can call it too.
 */
export function useStayFresh(): () => void {
  const router = useRouter();
  const last = useRef(0);

  const refresh = useCallback(() => {
    last.current = Date.now();
    router.refresh();
  }, [router]);

  useEffect(() => {
    function wake() {
      if (document.hidden || Date.now() - last.current < MIN_GAP_MS) return;
      refresh();
    }
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("online", refresh);
    return () => {
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", refresh);
    };
  }, [refresh]);

  return refresh;
}
