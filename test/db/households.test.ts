/**
 * Creating and joining a household over the real Supabase API (#8, #9). Run: npm run test:db:api
 * Same .env.local settings as the other tests in this folder; skipped without them.
 */
import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { HouseholdError } from "../../src/lib/household.ts";
import { createHousehold, joinHousehold, newInviteCode } from "../../src/lib/supabase/households.ts";
import { ensureUserId, getCurrentHousehold, getUserId } from "../../src/lib/supabase/session.ts";
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

  test("teine telefon liitub koodiga ja näeb sama kodu (#9)", async () => {
    const created = await createHousehold(device(), ["Mari", "Jüri"]);
    const partner = device();

    // Typed the way people do: lower case, with a dash in the middle.
    const typed = `${created.inviteCode.slice(0, 4)}-${created.inviteCode.slice(4)}`.toLowerCase();
    const joined = await joinHousehold(partner, typed);

    assert.deepEqual(joined, created);
    assert.deepEqual(await getCurrentHousehold(partner), created);
  });

  test("vale kood ei lisa kedagi ja ei näita ühtegi kodu (#9)", async () => {
    await createHousehold(device(), ["Mari", "Jüri"]);
    const stranger = device();

    await assert.rejects(joinHousehold(stranger, "ZZZZ9999"), /Sellist koodi pole/);
    assert.equal(await getCurrentHousehold(stranger), null);
    await assert.rejects(joinHousehold(stranger, "ABC"), /8 märki/, "poolik kood on kirjaviga");
  });

  test("uus kood: vana lakkab töötamast, liitunud jäävad koju (#9)", async () => {
    const owner = device();
    const created = await createHousehold(owner, ["Mari", "Jüri"]);
    const partner = device();
    await joinHousehold(partner, created.inviteCode);

    const fresh = await newInviteCode(owner);
    assert.notEqual(fresh, created.inviteCode);
    await assert.rejects(joinHousehold(device(), created.inviteCode), /Sellist koodi pole/);
    assert.equal((await getCurrentHousehold(partner))?.id, created.id, "partner jäi koju");
    assert.equal((await joinHousehold(device(), fresh)).id, created.id, "uus kood töötab");
  });

  test("11. vale kood tunnis lükatakse tagasi, ka õige koodiga (#9)", async () => {
    const created = await createHousehold(device(), ["Mari", "Jüri"]);
    const guesser = device();

    for (let i = 0; i < 10; i++) {
      await assert.rejects(joinHousehold(guesser, `ZZZZ${String(i).padStart(4, "2")}`), /Sellist koodi pole/);
    }
    await assert.rejects(joinHousehold(guesser, created.inviteCode), /Liiga palju valesid koode/);
    assert.equal(await getCurrentHousehold(guesser), null);
  });

  test("koduta seade ei saa koodi vahetada (#9)", async () => {
    const phone = device();
    await ensureUserId(phone);

    await assert.rejects(newInviteCode(phone), HouseholdError);
  });
});
