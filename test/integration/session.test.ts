/**
 * Runs against the real Supabase project in .env.local: `npm run test:integration`.
 * Each run creates a few anonymous users there. They hold no data.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import {
  ensureUserId,
  getCurrentHousehold,
  getCurrentHouseholdId,
  getUserId,
  leaveHousehold,
} from "../../src/lib/supabase/session.ts";
import type { Database } from "../../src/lib/supabase/database.types.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const skip = !url || !key ? "NEXT_PUBLIC_SUPABASE_* puudub (.env.local)" : false;

/** A fresh "device": its own client with its own in-memory session. */
function device() {
  return createClient<Database>(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

test("a new device has no user and no household, and creates nobody", { skip }, async () => {
  const supabase = device();

  assert.equal(await getUserId(supabase), null);
  assert.equal(await getCurrentHouseholdId(supabase), null);
  assert.equal(await getCurrentHousehold(supabase), null);
  // Still nobody: opening the app must not sign anyone in.
  assert.equal(await getUserId(supabase), null);
});

test("signing in anonymously happens once and gives no household yet", { skip }, async () => {
  const supabase = device();

  const first = await ensureUserId(supabase);
  assert.match(first, /^[0-9a-f-]{36}$/);
  assert.equal(await ensureUserId(supabase), first, "a second call reuses the session");

  const { data } = await supabase.auth.getClaims();
  assert.equal(data?.claims.is_anonymous, true);
  assert.equal(await getCurrentHousehold(supabase), null);
});

test("leaving works without a household and without a session", { skip }, async () => {
  await leaveHousehold(device());

  const supabase = device();
  await ensureUserId(supabase);
  await leaveHousehold(supabase);
});

test("a device cannot link itself to a household directly (only via RPC)", { skip }, async () => {
  const supabase = device();
  const userId = await ensureUserId(supabase);

  const { error } = await supabase
    .from("household_users")
    .insert({ user_id: userId, household_id: crypto.randomUUID() });
  assert.ok(error, "insert into household_users must be refused");
});

test("two devices don't see each other's sessions", { skip }, async () => {
  const a = device();
  const b = device();

  const [idA, idB] = [await ensureUserId(a), await ensureUserId(b)];
  assert.notEqual(idA, idB);
  assert.equal(await getUserId(a), idA);
});
