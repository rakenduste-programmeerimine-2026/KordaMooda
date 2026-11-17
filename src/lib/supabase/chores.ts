/**
 * Chores in Supabase (#10): add, remove (soft), restore, mark done, undo.
 *
 * Every function finds the household from the session, never from the caller,
 * and returns the whole updated household like the contract in actions.ts says.
 * ConflictError means someone else changed it first; actions.ts then adds `latest`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  addChore as validateNewChore,
  ConflictError,
  type Household,
  HouseholdError,
  type Id,
} from "../household.ts";
import type { Database } from "./database.types";
import { getCurrentHouseholdId, loadHousehold } from "./session.ts";

type Supabase = SupabaseClient<Database>;

const NO_SUCH_CHORE = "P0002";
const UNIQUE_VIOLATION = "23505";

/** The caller's household as it is now. Throws HouseholdError if there is none. */
async function currentHousehold(supabase: Supabase): Promise<Household> {
  const householdId = await getCurrentHouseholdId(supabase);
  const household = householdId ? await loadHousehold(supabase, householdId) : null;
  if (!household) throw new HouseholdError("Sa ei ole veel ühegi koduga liitunud.");
  return household;
}

/** Runs an RPC that answers 'ok' or a conflict, then returns the fresh household. */
async function rpcThenLoad(
  supabase: Supabase,
  call: () => PromiseLike<{ data: string | null; error: { code: string } | null }>,
  conflicts: Record<string, string>,
): Promise<Household> {
  const { data, error } = await call();
  if (error?.code === NO_SUCH_CHORE) throw new ConflictError("Seda tööd pole enam nimekirjas.");
  if (error) throw error;
  if (data && data !== "ok") throw new ConflictError(conflicts[data] ?? "Midagi muutus vahepeal.");
  return currentHousehold(supabase);
}

export async function addChore(
  supabase: Supabase,
  rawName: string,
  firstMemberId: Id,
): Promise<Household> {
  const household = await currentHousehold(supabase);
  // Same rules as the client: name, length, duplicates, starter is a member.
  const added = validateNewChore(household, rawName, firstMemberId);
  const name = added.chores[added.chores.length - 1].name;

  const { error } = await supabase
    .from("chores")
    .insert({ household_id: household.id, name, current_member_id: firstMemberId });
  // Someone added the same chore on another phone a moment ago.
  if (error?.code === UNIQUE_VIOLATION) throw new ConflictError(`${name} on juba nimekirjas.`);
  if (error) throw error;

  return currentHousehold(supabase);
}

export async function removeChore(supabase: Supabase, choreId: Id): Promise<Household> {
  return rpcThenLoad(supabase, () => supabase.rpc("remove_chore", { chore_id: choreId }), {});
}

export async function undoRemoveChore(supabase: Supabase, choreId: Id): Promise<Household> {
  return rpcThenLoad(supabase, () => supabase.rpc("restore_chore", { chore_id: choreId }), {
    conflict: "Seda ei saa enam tagasi võtta.",
    duplicate: "Sama nimega töö on vahepeal uuesti lisatud.",
  });
}

export async function markDone(
  supabase: Supabase,
  choreId: Id,
  expectedMemberId: Id,
): Promise<Household> {
  return rpcThenLoad(
    supabase,
    () => supabase.rpc("mark_done", { chore_id: choreId, expected_member_id: expectedMemberId }),
    { conflict: "Keegi märkis selle juba tehtuks." },
  );
}

export async function undoDone(supabase: Supabase, choreId: Id): Promise<Household> {
  return rpcThenLoad(supabase, () => supabase.rpc("undo_done", { chore_id: choreId }), {
    conflict: "Seda ei saa enam tagasi võtta, järjekord on vahepeal muutunud.",
  });
}
