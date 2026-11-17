"use server";

/**
 * API contract between frontend and backend (#7).
 *
 * The frontend only ever imports from this file. Right now every action runs against an
 * in-memory mock (`mock-store.ts`), so the UI can be built before Supabase is ready.
 * The backend (#8, #9, #10) swaps the insides for Supabase without changing these signatures.
 *
 * Rules every action follows:
 * - Returns `Result<T>`; never throws for problems the user can fix.
 * - Mutations return the whole updated `Household`, so the UI just replaces its copy.
 * - Which household the caller belongs to always comes from the session, never from arguments.
 * - Times (`doneAt`) are set on the server.
 */

import { cookies } from "next/headers";
import { ConflictError, type Household, HouseholdError, type Id } from "./household.ts";
import {
  createMockStore,
  mockAddChore,
  mockCreate,
  mockGet,
  mockJoin,
  mockMarkDone,
  mockNewInviteCode,
  mockRemoveChore,
  mockUndoDone,
  mockUndoRemove,
  type MockStore,
} from "./mock-store.ts";
import type { Result } from "./result.ts";

// ---------------------------------------------------------------------------
// Mock plumbing. Everything in this section goes away when Supabase is wired in.

const SESSION_COOKIE = "kordamooda-household";
/** Fake network delay so loading states are visible while building the UI. */
const MOCK_DELAY_MS = Number(process.env.MOCK_DELAY_MS ?? 300);

const globalStore = globalThis as { kordamoodaMock?: MockStore };
// Kept on globalThis so hot reload in dev doesn't wipe the data.
const store = (globalStore.kordamoodaMock ??= createMockStore());

async function sessionHouseholdId(): Promise<Id | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

async function setSession(householdId: Id | null): Promise<void> {
  const jar = await cookies();
  if (householdId === null) jar.delete(SESSION_COOKIE);
  else {
    jar.set(SESSION_COOKIE, householdId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
}

/** Runs `work` for the caller's household and turns HouseholdErrors into a Result. */
async function run<T>(work: (householdId: Id) => T | Promise<T>, needsHousehold = true): Promise<Result<T>> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));
  const householdId = await sessionHouseholdId();
  if (needsHousehold && !householdId) {
    return { ok: false, error: "Sa ei ole veel ühegi koduga liitunud." };
  }
  try {
    return { ok: true, data: await work(householdId as Id) };
  } catch (caught) {
    if (!(caught instanceof HouseholdError)) throw caught;
    const latest = caught instanceof ConflictError && householdId ? mockGet(store, householdId) : null;
    return { ok: false, error: caught.message, ...(latest && { latest }) };
  }
}

// ---------------------------------------------------------------------------
// The contract.

/** The caller's household, or `null` if this device hasn't created or joined one (→ StartScreen). */
export async function getHousehold(): Promise<Household | null> {
  const householdId = await sessionHouseholdId();
  return householdId ? mockGet(store, householdId) : null;
}

/** Creates a household with 2–6 people and joins it on this device. */
export async function createHousehold(names: string[]): Promise<Result<Household>> {
  return run(async () => {
    const household = mockCreate(store, names);
    await setSession(household.id);
    return household;
  }, false);
}

/** Joins an existing household with its invite code. Case, spaces and dashes don't matter. */
export async function joinHousehold(code: string): Promise<Result<Household>> {
  return run(async () => {
    const household = mockJoin(store, code);
    await setSession(household.id);
    return household;
  }, false);
}

/** Disconnects this device. The household itself stays for the others. */
export async function leaveHousehold(): Promise<Result<null>> {
  return run(async () => {
    await setSession(null);
    return null;
  }, false);
}

/** Makes a new invite code. The old one stops working. Returns the new code. */
export async function newInviteCode(): Promise<Result<string>> {
  return run((householdId) => mockNewInviteCode(store, householdId));
}

/** Adds a chore whose queue starts with `firstMemberId`. */
export async function addChore(name: string, firstMemberId: Id): Promise<Result<Household>> {
  return run((householdId) => mockAddChore(store, householdId, name, firstMemberId));
}

/** Removes a chore. Can be undone with `undoRemoveChore`. */
export async function removeChore(choreId: Id): Promise<Result<Household>> {
  return run((householdId) => mockRemoveChore(store, householdId, choreId));
}

/** Puts a removed chore back where it was, with its queue intact. */
export async function undoRemoveChore(choreId: Id): Promise<Result<Household>> {
  return run((householdId) => mockUndoRemove(store, householdId, choreId));
}

/**
 * Marks a chore done and moves the turn to the next person.
 *
 * `expectedMemberId` is whose turn the UI showed. If someone else already pressed
 * "Tehtud" on another phone, the turn has moved on: this fails with `latest` set,
 * instead of skipping a person.
 */
export async function markDone(choreId: Id, expectedMemberId: Id): Promise<Result<Household>> {
  return run((householdId) =>
    mockMarkDone(store, householdId, choreId, expectedMemberId, new Date().toISOString()),
  );
}

/** Undoes the last "Tehtud" on a chore, unless someone has changed that chore since. */
export async function undoDone(choreId: Id): Promise<Result<Household>> {
  return run((householdId) => mockUndoDone(store, householdId, choreId));
}
