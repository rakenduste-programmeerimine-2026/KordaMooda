/**
 * Creating a household over the real Supabase API (#8). Run: npm run test:db:api
 * Same .env.local settings as the other tests in this folder; skipped without them.
 */
import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { HouseholdError } from "../../src/lib/household.ts";
import { createHousehold } from "../../src/lib/supabase/households.ts";
import { getCurrentHousehold, getUserId } from "../../src/lib/supabase/session.ts";
import type { Database } from "../../src/lib/supabase/database.types.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const dbUrl = process.env.SUPABASE_DB_URL;
const skip =
  !url || !anonKey || !dbUrl
    ? "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY või SUPABASE_DB_URL puudub"
    : false;

describe("kodu loomine üle API", { skip }, () => {
  const devices: SupabaseClient<Database>[] = [];

  function device(): SupabaseClient<Database> {
    const client = createClient<Database>(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    devices.push(client);
    return client;
  }

  after(async () => {
    const userIds = (await Promise.all(devices.map(getUserId))).filter((id) => id !== null);
    if (!userIds.length) return;
    const sql = postgres(dbUrl!, { max: 1, onnotice: () => {} });
    // Households of these users go too (members and chores cascade).
    await sql`
      delete from public.households
      where id in (select household_id from public.household_users where user_id = any(${userIds}))`;
    await sql`delete from auth.users where id = any(${userIds})`;
    await sql.end();
  });

  test("uus seade loob kodu ja näeb seda kohe", async () => {
    const phone = device();
    const created = await createHousehold(phone, ["  Mari ", "Jüri"]);

    assert.deepEqual(created.members.map((member) => member.name), ["Mari", "Jüri"]);
    assert.deepEqual(created.chores, []);
    assert.match(created.inviteCode, /^[A-Z2-9]{8}$/);
    assert.deepEqual(await getCurrentHousehold(phone), created, "laadimine annab sama kodu");
  });

  test("vigased nimed annavad eestikeelse vea ja ei loo kasutajat", async () => {
    const phone = device();

    await assert.rejects(createHousehold(phone, ["Mari"]), HouseholdError);
    await assert.rejects(createHousehold(phone, ["Mari", "MARI"]), HouseholdError);
    assert.equal(await getUserId(phone), null, "kirjaviga ei tohi anonüümset kasutajat luua");
  });

  test("RPC otse kutsudes ei saa luua alla kahe liikmega kodu", async () => {
    const phone = device();
    await createHousehold(phone, ["Mari", "Jüri"]);

    const { error } = await phone.rpc("create_household", { member_names: ["Üksik"] });
    assert.equal(error?.code, "23514");
    const household = await getCurrentHousehold(phone);
    assert.deepEqual(household?.members.map((member) => member.name), ["Mari", "Jüri"],
      "ebaõnnestunud loomine ei lõhkunud vana seost");
  });

  test("teine seade ei näe võõrast kodu", async () => {
    const mine = await createHousehold(device(), ["Mari", "Jüri"]);
    const theirs = await createHousehold(device(), ["Kati", "Toomas"]);

    assert.notEqual(mine.id, theirs.id);
    assert.notEqual(mine.inviteCode, theirs.inviteCode);
  });
});
