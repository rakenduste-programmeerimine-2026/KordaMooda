/**
 * Creating and changing households in Supabase (#8, later #9 and #10).
 * Takes the client as an argument, like session.ts, so it can be tested without Next.js.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanMemberNames, type Household } from "../household.ts";
import type { Database } from "./database.types";
import { ensureUserId, loadHousehold } from "./session.ts";

type Supabase = SupabaseClient<Database>;

/**
 * Creates a household with these people and links this device to it.
 * Throws HouseholdError (Estonian, for the user) for invalid names.
 */
export async function createHousehold(supabase: Supabase, rawNames: string[]): Promise<Household> {
  // Validate before signing in, so a typo doesn't create an anonymous user.
  const names = cleanMemberNames(rawNames);
  await ensureUserId(supabase);

  const { data: householdId, error } = await supabase.rpc("create_household", {
    member_names: names,
  });
  if (error) throw error;

  const household = await loadHousehold(supabase, householdId);
  if (!household) throw new Error("Loodud kodu ei leitud. RLS ei luba seda lugeda?");
  return household;
}
