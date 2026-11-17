/**
 * Database tests over the real Supabase API with anonymous users (#17).
 * Covers what the pgTAP tests in supabase/tests/database/ can't: several connections at once.
 *
 * Run: npm run test:db:api
 * Needs in .env.local (local Supabase: `npx supabase status` shows all three):
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY  – the app's own settings
 *   SUPABASE_DB_URL  – direct Postgres connection, only for creating and removing test data
 * Skipped when any of them is missing. Creates its own households and users and deletes them.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const dbUrl = process.env.SUPABASE_DB_URL;
const skip =
  !url || !anonKey || !dbUrl
    ? "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY või SUPABASE_DB_URL puudub"
    : false;

type Home = { id: string; members: { id: string; name: string }[] };

/** Signs in a new anonymous user, like a phone opening the app for the first time. */
async function anonymousDevice(): Promise<{ client: SupabaseClient; userId: string }> {
  const client = createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw new Error(`Anonüümne sisselogimine ebaõnnestus: ${error.message}`);
  return { client, userId: data.user!.id };
}

describe("andmebaas üle API", { skip }, () => {
  let sql: postgres.Sql;
  const userIds: string[] = [];
  const homeIds: string[] = [];
  let phone1: SupabaseClient;
  let phone2: SupabaseClient;
  let stranger: SupabaseClient;
  let home: Home;
  let otherHome: Home;

  /** Test setup straight in Postgres: a household, its members and its devices in one transaction. */
  async function makeHome(names: string[], devices: string[]): Promise<Home> {
    const created = await sql.begin(async (tx) => {
      const [{ id }] = await tx`insert into public.households default values returning id`;
      const members = await tx`
        insert into public.members ${tx(names.map((name, position) => ({ household_id: id, name, position })))}
        returning id, name, position`;
      for (const userId of devices) {
        await tx`insert into public.household_users (user_id, household_id) values (${userId}, ${id})`;
      }
      return { id: id as string, members: [...members].sort((a, b) => a.position - b.position) };
    });
    homeIds.push(created.id);
    return { id: created.id, members: created.members.map(({ id, name }) => ({ id, name })) };
  }

  async function addChore(target: Home, name: string): Promise<string> {
    const [{ id }] = await sql`
      insert into public.chores (household_id, name, current_member_id)
      values (${target.id}, ${name}, ${target.members[0].id})
      returning id`;
    return id;
  }

  before(async () => {
    sql = postgres(dbUrl!, { max: 2, onnotice: () => {} });
    const devices = await Promise.all([anonymousDevice(), anonymousDevice(), anonymousDevice()]);
    [phone1, phone2, stranger] = devices.map((device) => device.client);
    userIds.push(...devices.map((device) => device.userId));
    home = await makeHome(["Mari", "Jüri", "Kati"], userIds.slice(0, 2));
    otherHome = await makeHome(["Teine", "Kolmas"], userIds.slice(2));
  });

  after(async () => {
    if (!sql) return;
    if (homeIds.length) await sql`delete from public.households where id = any(${homeIds})`;
    if (userIds.length) await sql`delete from auth.users where id = any(${userIds})`;
    await sql.end();
  });

  test("samaaegsetest vajutustest õnnestub täpselt üks", async () => {
    const choreId = await addChore(home, "Prügi");
    const [mari, juri] = home.members;
    // Both phones show Mari's turn and press "Tehtud" at the same moment, five times each.
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        (i % 2 ? phone2 : phone1).rpc("mark_done", { chore_id: choreId, expected_member_id: mari.id }),
      ),
    );

    for (const { error } of results) assert.equal(error, null);
    const outcomes = results.map((result) => result.data);
    assert.equal(outcomes.filter((outcome) => outcome === "ok").length, 1);
    assert.equal(outcomes.filter((outcome) => outcome === "conflict").length, 9);

    const { data: chore } = await phone1
      .from("chores")
      .select("current_member_id, last_member_id")
      .eq("id", choreId)
      .single();
    assert.deepEqual(chore, { current_member_id: juri.id, last_member_id: mari.id });
  });

  test("teise telefoni hilisemat vajutust ei saa tagasi võtta", async () => {
    const choreId = await addChore(home, "Nõud");
    const [mari, juri] = home.members;
    const press = (phone: SupabaseClient, memberId: string) =>
      phone.rpc("mark_done", { chore_id: choreId, expected_member_id: memberId });
    const undo = (phone: SupabaseClient) => phone.rpc("undo_done", { chore_id: choreId });

    assert.equal((await press(phone1, mari.id)).data, "ok");
    assert.equal((await press(phone2, juri.id)).data, "ok");
    assert.equal((await undo(phone1)).data, "conflict", "telefon 1 ei tühista telefoni 2 vajutust");
    assert.equal((await undo(phone2)).data, "ok", "telefon 2 saab oma vajutuse tagasi võtta");

    const { data: chore } = await phone1.from("chores").select("current_member_id").eq("id", choreId).single();
    assert.equal(chore?.current_member_id, juri.id);
  });

  test("võõra kodu andmeid ei näe ega muuda", async () => {
    const choreId = await addChore(home, "Pesu");

    const households = await stranger.from("households").select("id, invite_code");
    assert.deepEqual(households.data?.map((household) => household.id), [otherHome.id]);
    const members = await stranger.from("members").select("household_id");
    assert.ok(members.data?.length);
    assert.ok(members.data.every((member) => member.household_id === otherHome.id));
    assert.deepEqual((await stranger.from("chores").select("id").eq("id", choreId)).data, []);

    const insert = await stranger
      .from("chores")
      .insert({ household_id: home.id, name: "Häkitud", current_member_id: home.members[0].id });
    assert.equal(insert.error?.code, "42501");

    const rename = await stranger.from("chores").update({ name: "Häkitud" }).eq("id", choreId).select();
    assert.deepEqual(rename.data, []);
    // Directly deleting is not allowed for anyone since #10 (soft delete via remove_chore).
    const remove = await stranger.from("chores").delete().eq("id", choreId);
    assert.equal(remove.error?.code, "42501");
    const removeRpc = await stranger.rpc("remove_chore", { chore_id: choreId });
    assert.equal(removeRpc.error?.message, "Seda tööd pole olemas.");

    const markDone = await stranger.rpc("mark_done", {
      chore_id: choreId,
      expected_member_id: home.members[0].id,
    });
    assert.equal(markDone.error?.message, "Seda tööd pole olemas.");

    const join = await stranger.from("household_users").insert({ user_id: userIds[2], household_id: home.id });
    assert.equal(join.error?.code, "42501");

    const [still] = await sql`select name from public.chores where id = ${choreId}`;
    assert.equal(still?.name, "Pesu");
  });

  // join_household (#9): vt test/db/households.test.ts
});
