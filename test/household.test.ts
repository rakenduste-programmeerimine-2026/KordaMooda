import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addChore,
  createHousehold,
  HouseholdError,
  initialsFor,
  markDone,
  parseHousehold,
  relativeDay,
  removeChore,
  suggestStarter,
} from "../src/lib/household.ts";

const NOW = "2026-11-05T10:00:00.000Z";

function setup(names = ["Mari", "Jaan"]) {
  const home = addChore(createHousehold(names), "Prügi", 0);
  return { home, chore: home.chores[0] };
}

function rejects(work: () => unknown) {
  assert.throws(work, HouseholdError);
}

test("marking done moves the turn along and wraps to the start", () => {
  const { chore, home } = setup(["Mari", "Jaan", "Kati"]);
  const turns: number[] = [];
  let current = home;
  for (let i = 0; i < 3; i++) {
    current = markDone(current, chore.id, NOW);
    turns.push(current.chores[0].currentMemberId);
  }

  assert.deepEqual(turns, [1, 2, 0]);
});

test("marking done records who did it", () => {
  const { chore, home } = setup();

  assert.deepEqual(markDone(home, chore.id, NOW).chores[0].last, { memberId: 0, doneAt: NOW });
});

test("each chore keeps its own queue", () => {
  const { chore, home } = setup();
  const withDishes = addChore(home, "Nõud", 0);

  const after = markDone(withDishes, chore.id, NOW);

  assert.equal(after.chores[0].currentMemberId, 1);
  assert.equal(after.chores[1].currentMemberId, 0);
});

test("avatars use one letter unless two names start the same way", () => {
  const members = [
    { id: 0, name: "Mari" },
    { id: 1, name: "Mart" },
    { id: 2, name: "õie" },
  ];

  assert.equal(initialsFor(members, members[0]), "Ma");
  assert.equal(initialsFor(members, members[2]), "Õ");
});

test("every chore gets its own id, even after one is removed", () => {
  const { chore, home } = setup();
  const removed = removeChore(home, chore.id);
  const added = addChore(removed, "Pesu", 1);

  assert.notEqual(added.chores[0].id, chore.id);
  assert.notEqual(added.chores[0].id, 0);
  assert.notEqual(added.chores[0].id, 1);
});

test("people's names are validated and tidied", () => {
  rejects(() => createHousehold(["Mari"]));
  rejects(() => createHousehold(["Mari", "   "]));
  rejects(() => createHousehold(["Mari", "mari"]));
  rejects(() => createHousehold(["A", "B", "C", "D", "E", "F", "G"]));
  rejects(() => createHousehold(["Mari", "x".repeat(25)]));

  const members = createHousehold(["  Õie  ", "", "Šura"]).members;
  assert.deepEqual(members.map((member) => member.name), ["Õie", "Šura"]);
});

test("chore names are validated and unique regardless of case", () => {
  const { home } = setup();

  rejects(() => addChore(home, "  ", 0));
  rejects(() => addChore(home, "x".repeat(41), 0));
  rejects(() => addChore(home, "PRÜGI", 0));
});

test("suggestStarter picks whoever has the fewest turns waiting", () => {
  const { home } = setup();
  assert.equal(suggestStarter(home).id, 1);
  assert.equal(suggestStarter(addChore(home, "Nõud", 1)).id, 0);
});

test("relativeDay counts calendar days, not 24-hour periods", () => {
  const now = new Date(2026, 10, 6, 0, 30).toISOString();

  assert.equal(relativeDay(new Date(2026, 10, 6, 0, 10).toISOString(), now), "täna");
  assert.equal(relativeDay(new Date(2026, 10, 5, 23, 50).toISOString(), now), "eile");
  assert.equal(relativeDay(new Date(2026, 10, 3, 12, 0).toISOString(), now), "3 päeva tagasi");
});

test("parseHousehold reads saved data back and rejects damaged data", () => {
  const { home } = setup();

  assert.deepEqual(parseHousehold(JSON.stringify(home)), home);
  assert.equal(parseHousehold("{not json"), null);
  assert.equal(parseHousehold("null"), null);
  assert.equal(parseHousehold('{"members":[],"chores":[],"nextId":0}'), null);
  assert.equal(
    parseHousehold(
      JSON.stringify({ ...home, chores: [{ ...home.chores[0], currentMemberId: 99 }] }),
    ),
    null,
  );
});
