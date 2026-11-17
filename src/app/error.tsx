"use client";

import { useEffect, useState } from "react";

/** Shown instead of a blank page when loading the app fails, e.g. the database is down. */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="start">
      <div className="start-glow" aria-hidden>
        <span />
        <span />
      </div>
      <div className="start-content" role="alert">
        <p className="wordmark">
          <span className="wordmark-mark" aria-hidden />
          KordaMööda
        </p>
        <h1>Nimekirja ei saanud laadida</h1>
        <p className="start-lead">
          Midagi läks valesti. Kontrolli internetiühendust ja proovi uuesti.
        </p>
        <button
          type="button"
          className="button button-primary start-submit"
          aria-disabled={retrying || undefined}
          onClick={() => {
            setRetrying(true);
            retry();
          }}
        >
          {retrying ? "Proovin…" : "Proovi uuesti"}
        </button>
      </div>
    </main>
  );
}
