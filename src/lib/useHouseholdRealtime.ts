"use client";

import { useEffect } from "react";
import type { Id } from "./household";
import { createClient } from "./supabase/client";
import { hasSupabaseEnv } from "./supabase/env";

/**
 * One change can arrive as several events, and the phone's own "Tehtud" sends one too.
 * Waiting a moment folds them into one reload and lets the phone's own action answer first,
 * so its own change isn't pointed out as "changed on another phone".
 */
const SETTLE_MS = 400;

/**
 * Calls `refresh` when another phone changes this household (#13).
 *
 * Listens to the household's own row, which the database touches on every chore or member
 * change (migration 20261117220000_realtime.sql). The event carries no data: `refresh`
 * reloads the household from the server, through RLS. Does nothing without Supabase
 * settings (mock) or without a household.
 */
export function useHouseholdRealtime(householdId: Id | null, refresh: () => void): void {
  useEffect(() => {
    if (!householdId || !hasSupabaseEnv()) return;

    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, SETTLE_MS);
    };

    const channel = supabase
      .channel(`household:${householdId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "households", filter: `id=eq.${householdId}` },
        settle,
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [householdId, refresh]);
}
