/**
 * Creating and changing households in Supabase (#8, later #9 and #10).
 * Takes the client as an argument, like session.ts, so it can be tested without Next.js.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  cleanMemberNames,
  householdFromSaved,
  type Household,
  HouseholdError,
  INVITE_CODE_LENGTH,
  normalizeInviteCode,
} from "../household.ts";
import type { Database } from "./database.types";
import { ensureUserId, loadHousehold } from "./session.ts";

type Supabase = SupabaseClient<Database>;

/** The database's code for a rate limit: too many wrong invite codes or new households. */
const TOO_MANY_ATTEMPTS = "KM429";

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
  if (error?.code === TOO_MANY_ATTEMPTS) {
    throw new HouseholdError("Liiga palju uusi kodusid. Proovi tunni aja pärast uuesti.");
  }
  if (error) throw error;

  const household = await loadHousehold(supabase, householdId);
  if (!household) throw new Error("Loodud kodu ei leitud. RLS ei luba seda lugeda?");
  return household;
}

/**
 * Links this device to the household with this invite code. Case, spaces and dashes
 * don't matter. Throws HouseholdError for a wrong code or too many wrong codes.
 */
export async function joinHousehold(supabase: Supabase, rawCode: string): Promise<Household> {
  const code = normalizeInviteCode(rawCode);
  // An obviously incomplete code is a typo, not a guess: don't sign in or count it.
  if (code.length !== INVITE_CODE_LENGTH) {
    throw new HouseholdError(`Kutsekood on ${INVITE_CODE_LENGTH} märki. Kontrolli, et see on õigesti kirjutatud.`);
  }
  await ensureUserId(supabase);

  const { data: householdId, error } = await supabase.rpc("join_household", { code });
  if (error?.code === TOO_MANY_ATTEMPTS) {
    throw new HouseholdError("Liiga palju valesid koode. Proovi tunni aja pärast uuesti.");
  }
  if (error) throw error;
  if (!householdId) {
    throw new HouseholdError("Sellist koodi pole. Kontrolli, et see on õigesti kirjutatud.");
  }

  const household = await loadHousehold(supabase, householdId);
  if (!household) throw new Error("Liitutud kodu ei leitud. RLS ei luba seda lugeda?");
  return household;
}

/** Gives this device's household a new invite code. The old code and link stop working. */
export async function newInviteCode(supabase: Supabase): Promise<string> {
  const { data, error } = await supabase.rpc("new_invite_code");
  if (error?.code === "P0002") throw new HouseholdError("Sa ei ole veel ühegi koduga liitunud.");
  if (error) throw error;
  return data;
}

/**
 * Creates a household from a list an earlier version saved in this browser (#15), keeping
 * its people, chores, whose turn it is and who did it last, and links this device to it.
 * `saved` comes from the browser, so it is checked with the same rules as a new household
 * (householdFromSaved) before anything is sent to the database. Throws HouseholdError.
 */
export async function importHousehold(supabase: Supabase, saved: string): Promise<Household> {
  const household = householdFromSaved(saved);
  const position = new Map(household.members.map((member, index) => [member.id, index]));
  const now = Date.now();
  const chores = household.chores.map((chore) => ({
    name: chore.name,
    current: position.get(chore.currentMemberId),
    last: chore.last ? position.get(chore.last.memberId) : null,
    // A phone's clock can be ahead; the database refuses times in the future.
    last_done_at: chore.last ? new Date(Math.min(Date.parse(chore.last.doneAt), now)).toISOString() : null,
  }));

  await ensureUserId(supabase);
  const { data: householdId, error } = await supabase.rpc("import_household", {
    member_names: household.members.map((member) => member.name),
    chores,
  });
  if (error?.code === TOO_MANY_ATTEMPTS) {
    throw new HouseholdError("Liiga palju uusi kodusid. Proovi tunni aja pärast uuesti.");
  }
  if (error) throw error;

  const imported = await loadHousehold(supabase, householdId);
  if (!imported) throw new Error("Üle viidud kodu ei leitud. RLS ei luba seda lugeda?");
  return imported;
}
