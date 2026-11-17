import assert from "node:assert/strict";
import { test } from "node:test";
import { ConflictError, HouseholdError } from "../src/lib/household.ts";
import {
  createMockStore,
  mockAddChore,
  mockCreate,
  mockJoin,
  mockMarkDone,
  mockNewInviteCode,
  mockRemoveChore,
  mockUndoDone,
  mockUndoRemove,
} from "../src/lib/mock-store.ts";

const NOW = "2026-11-05T10:00:00.000Z";

function setup() {
  const store = createMockStore();
  const created = mockCreate(store, ["Mari", "Jaan"]);
  const [mari, jaan] = created.members.map((member) => member.id);
  const home = mockAddChore(store, created.id, "Prügi", mari);
  return { store, home, mari, jaan, choreId: home.chores[0].id };
}

test("a partner joins with the invite code however they type it", () => {
  const { store, home } = setup();
  const typed = home.inviteCode.toLowerCase().replace(/(.{4})/, "$1-");

  assert.equal(mockJoin(store, typed).id, home.id);
  assert.throws(() => mockJoin(store, "WRONG123"), HouseholdError);
});

test("a new invite code replaces the old one", () => {
  const { store, home } = setup();
  const fresh = mockNewInviteCode(store, home.id);

  assert.throws(() => mockJoin(store, home.inviteCode), HouseholdError);
  assert.equal(mockJoin(store, fresh).id, home.id);
});

test("two phones pressing done at once only move the turn once", () => {
  const { store, home, choreId, mari, jaan } = setup();

  const first = mockMarkDone(store, home.id, choreId, mari, NOW);
  assert.equal(first.chores[0].currentMemberId, jaan);
  assert.throws(() => mockMarkDone(store, home.id, choreId, mari, NOW), ConflictError);
});

test("undoing done restores the turn, but not after someone else moved it", () => {
  const { store, home, choreId, mari, jaan } = setup();

  mockMarkDone(store, home.id, choreId, mari, NOW);
  const undone = mockUndoDone(store, home.id, choreId);
  assert.equal(undone.chores[0].currentMemberId, mari);
  assert.equal(undone.chores[0].last, null);

  mockMarkDone(store, home.id, choreId, mari, NOW);
  mockMarkDone(store, home.id, choreId, jaan, NOW);
  mockUndoDone(store, home.id, choreId);
  assert.throws(() => mockUndoDone(store, home.id, choreId), ConflictError);
});

test("a removed chore comes back in the same place with its queue", () => {
  const { store, home, choreId, mari, jaan } = setup();
  mockAddChore(store, home.id, "Nõud", jaan);
  mockMarkDone(store, home.id, choreId, mari, NOW);

  mockRemoveChore(store, home.id, choreId);
  const back = mockUndoRemove(store, home.id, choreId);

  assert.deepEqual(back.chores.map((c) => c.name), ["Prügi", "Nõud"]);
  assert.equal(back.chores[0].currentMemberId, jaan);
  assert.throws(() => mockUndoRemove(store, home.id, choreId), ConflictError);
});

test("one household cannot undo another household's removal", () => {
  const { store, choreId, home } = setup();
  const other = mockCreate(store, ["Kati", "Toomas"]);

  mockRemoveChore(store, home.id, choreId);
  assert.throws(() => mockUndoRemove(store, other.id, choreId), ConflictError);
});
