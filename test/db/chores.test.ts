/**
 * Chore actions over the real Supabase API (#10). Run: npm run test:db:api
 * Same .env.local settings as the other tests in this folder; skipped without them.
 */
import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { ConflictError, HouseholdError } from "../../src/lib/household.ts";
import {
  addChore,
  markDone,
  removeChore,
  undoDone,
  undoRemoveChore,
} from "../../src/lib/supabase/chores.ts";
import { createHousehold, joinHousehold } from "../../src/lib/supabase/households.ts";
import { getUserId } from "../../src/lib/supabase/session.ts";
import type { Database } from "../../src/lib/supabase/database.types.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const dbUrl = process.env.SUPABASE_DB_URL;
const skip =
  !url || !anonKey || !dbUrl
    ? "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY või SUPABASE_DB_URL puudub"
    : false;

describe("tööd üle API", { skip }, () => {
  const devices: SupabaseClient<Database>[] = [];

  function device(): SupabaseClient<Database> {
    const client = createClient<Database>(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    devices.push(client);
    return client;
  }

  /** Two phones in one household, like the success criterion. */
  async function couple() {
    const me = device();
    const partner = device();
    const home = await createHousehold(me, ["Mari", "Jüri"]);
    await joinHousehold(partner, home.inviteCode);
    const [mari, juri] = home.members.map((member) => member.id);
    return { me, partner, home, mari, juri };
  }

  after(async () => {
    const userIds = (await Promise.all(devices.map(getUserId))).filter((id) => id !== null);
    if (!userIds.length) return;
    const sql = postgres(dbUrl!, { max: 1, onnotice: () => {} });
    await sql`
      delete from public.households
      where id in (select household_id from public.household_users where user_id = any(${userIds}))`;
    await sql`delete from auth.users where id = any(${userIds})`;
    await sql.end();
  });

  test("töö lisatakse ja teine telefon näeb seda", async () => {
    const { me, partner, juri } = await couple();

    const added = await addChore(me, "  Prügi ", juri);
    assert.deepEqual(added.chores.map((c) => [c.name, c.currentMemberId, c.last]), [["Prügi", juri, null]]);

    const seen = await addChore(partner, "Nõud", juri);
    assert.deepEqual(seen.chores.map((c) => c.name), ["Prügi", "Nõud"], "uuem töö on all");
  });

  test("vigane töö annab eestikeelse vea", async () => {
    const { me, mari } = await couple();
    await addChore(me, "Prügi", mari);

    await assert.rejects(addChore(me, "PRÜGI", mari), /juba nimekirjas/);
    await assert.rejects(addChore(me, " ", mari), HouseholdError);
    await assert.rejects(addChore(me, "Pesu", crypto.randomUUID()), /Vali, kellest/);
  });

  test("tehtud ja tagasivõtmine kahe telefoniga", async () => {
    const { me, partner, mari, juri } = await couple();
    const choreId = (await addChore(me, "Prügi", mari)).chores[0].id;

    const done = await markDone(me, choreId, mari);
    assert.equal(done.chores[0].currentMemberId, juri);
    assert.equal(done.chores[0].last?.memberId, mari);

    // The partner's phone still showed Mari: conflict, not a skipped turn.
    await assert.rejects(markDone(partner, choreId, mari), ConflictError);

    const undone = await undoDone(me, choreId);
    assert.equal(undone.chores[0].currentMemberId, mari);
    assert.equal(undone.chores[0].last, null);
    await assert.rejects(undoDone(me, choreId), ConflictError);
  });

  test("eemaldatud töö tuleb tagasi oma kohale koos ajalooga", async () => {
    const { me, partner, mari, juri } = await couple();
    const trash = (await addChore(me, "Prügi", mari)).chores[0].id;
    await addChore(me, "Nõud", mari);
    await markDone(me, trash, mari);

    const removed = await removeChore(me, trash);
    assert.deepEqual(removed.chores.map((c) => c.name), ["Nõud"]);

    const restored = await undoRemoveChore(partner, trash);
    assert.deepEqual(restored.chores.map((c) => c.name), ["Prügi", "Nõud"], "endisel kohal");
    assert.equal(restored.chores[0].currentMemberId, juri);
    assert.equal(restored.chores[0].last?.memberId, mari, "ajalugu jäi alles");
    await assert.rejects(undoRemoveChore(me, trash), /Seda ei saa enam tagasi võtta/);
  });

  test("tagasivõtmine ei õnnestu, kui sama nimi on uuesti lisatud", async () => {
    const { me, partner, mari } = await couple();
    const trash = (await addChore(me, "Prügi", mari)).chores[0].id;
    await removeChore(me, trash);
    await addChore(partner, "Prügi", mari);

    await assert.rejects(undoRemoveChore(me, trash), /uuesti lisatud/);
  });

  test("võõra kodu tööd ei saa puudutada", async () => {
    const { me, mari } = await couple();
    const choreId = (await addChore(me, "Prügi", mari)).chores[0].id;
    const stranger = device();
    await createHousehold(stranger, ["Kati", "Toomas"]);

    await assert.rejects(removeChore(stranger, choreId), /pole enam nimekirjas/);
    await assert.rejects(markDone(stranger, choreId, mari), /pole enam nimekirjas/);
    await assert.rejects(undoRemoveChore(stranger, choreId), /pole enam nimekirjas/);
  });
});
