/**
 * Supabase Realtime between two phones (#13). Run: npm run test:db:api
 * Same .env.local settings as the other tests in this folder; skipped without them.
 */
import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";
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

/**
 * Longest wait for an event that should come. Usually it takes well under a second, but
 * right after `supabase start` (as in CI) Realtime needs a few seconds before it sees
 * database changes at all.
 */
const WAIT_MS = 10_000;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("realtime üle API", { skip }, () => {
  const devices: SupabaseClient<Database>[] = [];

  function device(): SupabaseClient<Database> {
    const client = createClient<Database>(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    devices.push(client);
    return client;
  }

  /** Subscribes like useHouseholdRealtime does and counts the events that arrive. */
  async function listen(client: SupabaseClient<Database>, householdId: string) {
    const events: unknown[] = [];
    const { data } = await client.auth.getSession();
    if (data.session) client.realtime.setAuth(data.session.access_token);
    // SUBSCRIBED only means the channel is open. Database changes are watched once Realtime
    // sends a "system" message for postgres_changes; anything before that is lost.
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Realtime ei hakanud muudatusi jälgima")), WAIT_MS);
      client
        .channel(`household:${householdId}:${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "households", filter: `id=eq.${householdId}` },
          (payload) => events.push(payload),
        )
        .on("system", {}, (message: { extension?: string; status?: string }) => {
          if (message.extension === "postgres_changes" && message.status === "ok") {
            clearTimeout(timer);
            resolve();
          }
        })
        .subscribe((status, error) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            clearTimeout(timer);
            reject(error ?? new Error(status));
          }
        });
    });
    return events;
  }

  async function until(check: () => boolean) {
    const end = Date.now() + WAIT_MS;
    while (!check() && Date.now() < end) await pause(50);
  }

  after(async () => {
    await Promise.all(devices.map((client) => client.removeAllChannels()));
    const userIds = (await Promise.all(devices.map(getUserId))).filter((id) => id !== null);
    if (!userIds.length) return;
    const sql = postgres(dbUrl!, { max: 1, onnotice: () => {} });
    await sql`
      delete from public.households
      where id in (select household_id from public.household_users where user_id = any(${userIds}))`;
    await sql`delete from auth.users where id = any(${userIds})`;
    await sql.end();
  });

  test("teise telefoni muudatus jõuab kohale, võõrale mitte", async () => {
    const me = device();
    const partner = device();
    const stranger = device();
    const home = await createHousehold(me, ["Mari", "Jüri"]);
    await joinHousehold(partner, home.inviteCode);
    await createHousehold(stranger, ["Kati", "Toomas"]);
    const [mari] = home.members.map((member) => member.id);

    const mine = await listen(me, home.id);
    // A stranger who somehow knows the household id still gets nothing: RLS applies.
    const theirs = await listen(stranger, home.id);

    // The partner adds a chore and marks it done.
    const { data: chore, error } = await partner
      .from("chores")
      .insert({ household_id: home.id, name: "Prügi", current_member_id: mari })
      .select("id")
      .single();
    assert.equal(error, null);
    await until(() => mine.length >= 1);
    assert.ok(mine.length >= 1, "lisamine jõudis teise telefoni");

    const before = mine.length;
    const done = await partner.rpc("mark_done", { chore_id: chore!.id, expected_member_id: mari });
    assert.equal(done.data, "ok");
    await until(() => mine.length > before);
    assert.ok(mine.length > before, "tehtud jõudis teise telefoni");

    await pause(500);
    assert.equal(theirs.length, 0, "võõras ei saanud ühtegi sündmust");
  });

  test("sündmus ei sisalda tööde andmeid", async () => {
    const me = device();
    const partner = device();
    const home = await createHousehold(me, ["Mari", "Jüri"]);
    await joinHousehold(partner, home.inviteCode);

    const events = (await listen(me, home.id)) as { new: Record<string, unknown> }[];
    await partner
      .from("chores")
      .insert({ household_id: home.id, name: "Nõud", current_member_id: home.members[0].id });
    await until(() => events.length >= 1);

    assert.ok(events.length >= 1);
    assert.deepEqual(Object.keys(events[0].new).sort(), ["abandoned_at", "changed_at", "created_at", "id", "invite_code"]);
  });
});
