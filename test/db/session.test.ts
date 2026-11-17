/**
 * Sessions and households over the real Supabase API (#6). Run: npm run test:db:api
 *
 * Needs the same .env.local settings as queue-api.test.ts (see README):
 * the app's URL and anon key, plus SUPABASE_DB_URL to delete the anonymous
 * users this test creates. Skipped when any of them is missing.
 */
import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import {
  ensureUserId,
  getCurrentHousehold,
  getCurrentHouseholdId,
  getUserId,
  leaveHousehold,
} from "../../src/lib/supabase/session.ts";
import type { Database } from "../../src/lib/supabase/database.types.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const dbUrl = process.env.SUPABASE_DB_URL;
const skip =
  !url || !anonKey || !dbUrl
    ? "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY või SUPABASE_DB_URL puudub"
    : false;

describe("sessioon ja kodu üle API", { skip }, () => {
  const created: string[] = [];

  /** A fresh "device": its own client with its own in-memory session. */
  function device() {
    return createClient<Database>(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  /** Signs in like ensureUserId does and remembers the user for cleanup. */
  async function signedIn(supabase = device()) {
    const userId = await ensureUserId(supabase);
    if (!created.includes(userId)) created.push(userId);
    return { supabase, userId };
  }

  after(async () => {
    if (!created.length) return;
    const sql = postgres(dbUrl!, { max: 1, onnotice: () => {} });
    await sql`delete from auth.users where id = any(${created})`;
    await sql.end();
  });

  test("uuel seadmel pole kasutajat ega kodu ja avamine ei loo kedagi", async () => {
    const supabase = device();

    assert.equal(await getUserId(supabase), null);
    assert.equal(await getCurrentHouseholdId(supabase), null);
    assert.equal(await getCurrentHousehold(supabase), null);
    assert.equal(await getUserId(supabase), null, "avamine ei tohi kedagi sisse logida");
  });

  test("anonüümne sisselogimine toimub üks kord ja kodu veel pole", async () => {
    const { supabase, userId } = await signedIn();

    assert.match(userId, /^[0-9a-f-]{36}$/);
    assert.equal(await ensureUserId(supabase), userId, "teine kutse kasutab sama sessiooni");
    const { data } = await supabase.auth.getClaims();
    assert.equal(data?.claims.is_anonymous, true);
    assert.equal(await getCurrentHousehold(supabase), null);
  });

  test("lahkumine töötab ka ilma koduta ja ilma sessioonita", async () => {
    await leaveHousehold(device());
    const { supabase } = await signedIn();
    await leaveHousehold(supabase);
  });

  test("seade ei saa end ise koju lisada, ainult RPC kaudu", async () => {
    const { supabase, userId } = await signedIn();

    const { error } = await supabase
      .from("household_users")
      .insert({ user_id: userId, household_id: crypto.randomUUID() });
    assert.equal(error?.code, "42501", "õiguste puudumine, mitte mõni muu viga");
  });

  test("kaks seadet ei näe teineteise sessiooni", async () => {
    const a = await signedIn();
    const b = await signedIn();

    assert.notEqual(a.userId, b.userId);
    assert.equal(await getUserId(a.supabase), a.userId);
  });
});
