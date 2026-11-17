/**
 * Who is calling and which household they belong to (#6).
 *
 * There are no accounts. A device gets an anonymous Supabase user the first time
 * it creates or joins a household, and `household_users` links that user to the
 * household. Opening the app without a household creates nobody, so visitors and
 * bots don't fill `auth.users` or use up Supabase's sign-in rate limit.
 *
 * Every function takes the client as an argument so it works with both the
 * Next.js server client and a plain client in integration tests.
 */
import { isAuthApiError, type SupabaseClient } from "@supabase/supabase-js";
import { type Household, HouseholdError, type Id } from "../household.ts";
import { type HouseholdRow, toHousehold } from "../household-row.ts";
import type { Database } from "./database.types";

type Supabase = SupabaseClient<Database>;

/** The signed-in user's id, or null when this device has no session. */
export async function getUserId(supabase: Supabase): Promise<Id | null> {
  // getClaims verifies the token; getSession alone would trust whatever the cookie says.
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;
  return data.claims.sub;
}

/** The current user's id, signing in anonymously first if needed. */
export async function ensureUserId(supabase: Supabase): Promise<Id> {
  const existing = await getUserId(supabase);
  if (existing) return existing;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error && isAuthApiError(error) && error.status === 429) {
    throw new HouseholdError("Liiga palju katseid. Proovi mõne minuti pärast uuesti.");
  }
  if (error || !data.user) {
    throw new Error(`Anonüümne sisselogimine ebaõnnestus: ${error?.message ?? "kasutajat ei tulnud"}`);
  }
  return data.user.id;
}

/** The household this device is linked to, or null (→ StartScreen). */
export async function getCurrentHouseholdId(supabase: Supabase): Promise<Id | null> {
  const userId = await getUserId(supabase);
  if (!userId) return null;

  // RLS already limits this to the caller's own rows; the filter says so explicitly.
  const { data, error } = await supabase
    .from("household_users")
    .select("household_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.household_id ?? null;
}

export async function loadHousehold(supabase: Supabase, householdId: Id): Promise<Household | null> {
  const { data, error } = await supabase
    .from("households")
    .select(
      "id, invite_code, members(id, name, position), " +
        "chores(id, name, current_member_id, last_member_id, last_done_at, created_at)",
    )
    .eq("id", householdId)
    .maybeSingle();
  if (error) throw error;
  return data ? toHousehold(data as unknown as HouseholdRow) : null;
}

/** The whole household for this device, or null if it hasn't created or joined one. */
export async function getCurrentHousehold(supabase: Supabase): Promise<Household | null> {
  const householdId = await getCurrentHouseholdId(supabase);
  return householdId ? loadHousehold(supabase, householdId) : null;
}

/**
 * Unlinks this device from its household. The household and its chores stay,
 * so the others keep using it and this device can rejoin with the invite code.
 * The anonymous user is kept too, so joining again doesn't create a new one.
 */
export async function leaveHousehold(supabase: Supabase): Promise<void> {
  const userId = await getUserId(supabase);
  if (!userId) return;

  const { error } = await supabase.from("household_users").delete().eq("user_id", userId);
  if (error) throw error;
}
