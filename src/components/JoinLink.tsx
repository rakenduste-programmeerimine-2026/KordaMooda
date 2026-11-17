"use client";

import { motion, MotionConfig } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";
import { JoinForm } from "@/components/JoinForm";
import { OfflineNotice } from "@/components/OfflineNotice";
import { joinHousehold } from "@/lib/actions";
import { callAction, useOnline } from "@/lib/connection";
import { soft } from "@/lib/motion";

type Props = {
  code: string;
  /** Who is in the household this device already belongs to, if any. */
  currentMembers?: string[];
};

type State = { kind: "joining" } | { kind: "confirm" } | { kind: "failed"; error: string };

const listFormat = new Intl.ListFormat("et", { type: "conjunction" });

type Router = ReturnType<typeof useRouter>;

function requestJoin(code: string, router: Router, setState: (state: State) => void) {
  startTransition(async () => {
    const result = await callAction(() => joinHousehold(code));
    startTransition(() => {
      if (result.ok) router.replace("/");
      else setState({ kind: "failed", error: result.error });
    });
  });
}

export function JoinLink({ code, currentMembers }: Props) {
  const router = useRouter();
  const [state, setState] = useState<State>(
    currentMembers ? { kind: "confirm" } : { kind: "joining" },
  );
  const started = useRef(false);
  const online = useOnline();

  function join() {
    setState({ kind: "joining" });
    requestJoin(code, router, setState);
  }

  // A device that isn't in any household yet joins right away, without a button.
  useEffect(() => {
    if (currentMembers || started.current) return;
    started.current = true; // Strict mode runs effects twice in dev.
    requestJoin(code, router, setState);
  }, [code, currentMembers, router]);

  return (
    <MotionConfig reducedMotion="user">
      <main className="start">
        <div className="start-glow" aria-hidden>
          <span />
          <span />
        </div>

        <motion.div
          key={state.kind}
          className="start-content"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={soft}
        >
          <p className="wordmark">
            <span className="wordmark-mark" aria-hidden />
            KordaMööda
          </p>

          <OfflineNotice>Ühendus puudub. Liitumiseks on vaja internetti.</OfflineNotice>

          {state.kind === "joining" && (
            <div role="status">
              <h1>Liitun koduga…</h1>
              <p className="start-lead">Kohe näed teie ühist nimekirja.</p>
            </div>
          )}

          {state.kind === "confirm" && (
            <>
              <h1>Liitu teise koduga?</h1>
              <p className="start-lead">
                See seade on praegu kodus, kus on {listFormat.format(currentMembers ?? [])}. Kui
                liitud, näed selle asemel uue kodu nimekirja.
              </p>
              <div className="join-actions">
                <motion.button
                  type="button"
                  className="button button-primary"
                  disabled={!online}
                  whileTap={{ scale: 0.97 }}
                  onClick={join}
                >
                  Liitu
                </motion.button>
                <Link href="/" replace className="button button-quiet">
                  Jää praegusesse
                </Link>
              </div>
            </>
          )}

          {state.kind === "failed" && (
            <>
              <h1>Kutse ei tööta</h1>
              <p className="start-lead">
                Küsi kaaslaselt uus link või kirjuta kood ise.
              </p>
              <JoinForm
                initialCode={code}
                initialError={state.error}
                onJoined={() => router.replace("/")}
              />
              <p className="join-other">
                <Link href="/" replace className="button button-quiet">
                  Loo hoopis uus kodu
                </Link>
              </p>
            </>
          )}
        </motion.div>
      </main>
    </MotionConfig>
  );
}
