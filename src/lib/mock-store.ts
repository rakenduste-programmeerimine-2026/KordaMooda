/**
 * In-memory stand-in for Supabase so the frontend can be built before the backend (#7).
 * Data lives in the dev server's memory and is gone after a restart.
 * Replaced by real database calls in #8, #9 and #10.
 */
import {
  addChore,
  type Chore,
  ConflictError,
  createHousehold,
  createInviteCode,
  type Household,
  householdFromSaved,
  HouseholdError,
  type Id,
  markDone,
  normalizeInviteCode,
} from "./household.ts";

export type MockStore = {
  households: Map<Id, Household>;
  /** The chore as it was before and after the last "Tehtud", for undo. */
  lastDone: Map<Id, { before: Chore; after: Chore }>;
  /** Removed chores and where they were, for undo. */
  removed: Map<Id, { householdId: Id; chore: Chore; index: number }>;
};

export function createMockStore(): MockStore {
  return { households: new Map(), lastDone: new Map(), removed: new Map() };
}

function get(store: MockStore, householdId: Id): Household {
  const household = store.households.get(householdId);
  if (!household) throw new HouseholdError("Seda kodu pole enam olemas.");
  return household;
}

function save(store: MockStore, household: Household): Household {
  store.households.set(household.id, household);
  return household;
}

function findChore(household: Household, choreId: Id): Chore {
  const chore = household.chores.find((c) => c.id === choreId);
  if (!chore) throw new ConflictError("Seda tööd pole enam nimekirjas.");
  return chore;
}

export function mockCreate(store: MockStore, names: string[]): Household {
  return save(store, createHousehold(names));
}

export function mockImport(store: MockStore, saved: string): Household {
  return save(store, householdFromSaved(saved));
}

export function mockGet(store: MockStore, householdId: Id): Household | null {
  return store.households.get(householdId) ?? null;
}

export function mockJoin(store: MockStore, rawCode: string): Household {
  const code = normalizeInviteCode(rawCode);
  for (const household of store.households.values()) {
    if (household.inviteCode === code) return household;
  }
  throw new HouseholdError("Sellist koodi pole. Kontrolli, et see on õigesti kirjutatud.");
}

export function mockNewInviteCode(store: MockStore, householdId: Id): string {
  const household = get(store, householdId);
  return save(store, { ...household, inviteCode: createInviteCode() }).inviteCode;
}

export function mockAddChore(store: MockStore, householdId: Id, name: string, firstMemberId: Id): Household {
  return save(store, addChore(get(store, householdId), name, firstMemberId));
}

export function mockRemoveChore(store: MockStore, householdId: Id, choreId: Id): Household {
  const household = get(store, householdId);
  const index = household.chores.findIndex((c) => c.id === choreId);
  if (index === -1) return household; // Already gone, which is what the user wanted.
  store.removed.set(choreId, { householdId, chore: household.chores[index], index });
  return save(store, { ...household, chores: household.chores.filter((c) => c.id !== choreId) });
}

export function mockUndoRemove(store: MockStore, householdId: Id, choreId: Id): Household {
  const removed = store.removed.get(choreId);
  const household = get(store, householdId);
  if (!removed || removed.householdId !== householdId) {
    throw new ConflictError("Seda ei saa enam tagasi võtta.");
  }
  if (household.chores.some((c) => c.name.toLocaleLowerCase("et") === removed.chore.name.toLocaleLowerCase("et"))) {
    throw new ConflictError(`${removed.chore.name} on vahepeal uuesti lisatud.`);
  }
  store.removed.delete(choreId);
  const chores = [...household.chores];
  chores.splice(Math.min(removed.index, chores.length), 0, removed.chore);
  return save(store, { ...household, chores });
}

export function mockMarkDone(
  store: MockStore,
  householdId: Id,
  choreId: Id,
  expectedMemberId: Id,
  doneAt: string,
): Household {
  const household = get(store, householdId);
  const before = findChore(household, choreId);
  if (before.currentMemberId !== expectedMemberId) {
    throw new ConflictError("Keegi märkis selle juba tehtuks.");
  }
  const updated = save(store, markDone(household, choreId, doneAt));
  store.lastDone.set(choreId, { before, after: findChore(updated, choreId) });
  return updated;
}

export function mockUndoDone(store: MockStore, householdId: Id, choreId: Id): Household {
  const household = get(store, householdId);
  const current = findChore(household, choreId);
  const last = store.lastDone.get(choreId);
  // Only undo if nobody has touched this chore since our "Tehtud".
  if (!last || JSON.stringify(last.after) !== JSON.stringify(current)) {
    throw new ConflictError("Seda ei saa enam tagasi võtta, järjekord on vahepeal muutunud.");
  }
  store.lastDone.delete(choreId);
  return save(store, {
    ...household,
    chores: household.chores.map((c) => (c.id === choreId ? last.before : c)),
  });
}
