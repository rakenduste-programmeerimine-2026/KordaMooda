import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addChore,
  createHousehold,
  createInviteCode,
  formatInviteCode,
  HouseholdError,
  initialsFor,
  INVITE_ALPHABET,
  INVITE_CODE_LENGTH,
  inviteCodeFromInput,
  markDone,
  normalizeInviteCode,
  parseHousehold,
  relativeDay,
  removeChore,
  suggestStarter,
} from "../src/lib/household.ts";

const NOW = "2026-11-05T10:00:00.000Z";

function setup(names = ["Mari", "Jaan"]) {
  const created = createHousehold(names);
  const home = addChore(created, "Prügi", created.members[0].id);
  return { home, chore: home.chores[0], ids: home.members.map((member) => member.id) };
}

function rejects(work: () => unknown) {
  assert.throws(work, HouseholdError);
}

test("marking done moves the turn along and wraps to the start", () => {
  const { chore, home, ids } = setup(["Mari", "Jaan", "Kati"]);
  const turns: string[] = [];
  let current = home;
  for (let i = 0; i < 3; i++) {
    current = markDone(current, chore.id, NOW);
    turns.push(current.chores[0].currentMemberId);
  }

  assert.deepEqual(turns, [ids[1], ids[2], ids[0]]);
});

test("marking done records who did it", () => {
  const { chore, home, ids } = setup();

  assert.deepEqual(markDone(home, chore.id, NOW).chores[0].last, { memberId: ids[0], doneAt: NOW });
});

test("each chore keeps its own queue", () => {
  const { chore, home, ids } = setup();
  const withDishes = addChore(home, "Nõud", ids[0]);

  const after = markDone(withDishes, chore.id, NOW);

  assert.equal(after.chores[0].currentMemberId, ids[1]);
  assert.equal(after.chores[1].currentMemberId, ids[0]);
});

test("avatars use one letter unless two names start the same way", () => {
  const members = [
    { id: "a", name: "Mari" },
    { id: "b", name: "Mart" },
    { id: "c", name: "õie" },
  ];

  assert.equal(initialsFor(members, members[0]), "Ma");
  assert.equal(initialsFor(members, members[2]), "Õ");
});

test("every household, member and chore gets its own id", () => {
  const { chore, home, ids } = setup();
  const added = addChore(removeChore(home, chore.id), "Pesu", ids[1]);
  const all = [home.id, ...ids, chore.id, added.chores[0].id];

  assert.equal(new Set(all).size, all.length);
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
  const { home, ids } = setup();

  rejects(() => addChore(home, "  ", ids[0]));
  rejects(() => addChore(home, "x".repeat(41), ids[0]));
  rejects(() => addChore(home, "PRÜGI", ids[0]));
});

test("a chore's queue must start with someone in the household", () => {
  const { home } = setup();

  rejects(() => addChore(home, "Nõud", "someone-else"));
});

test("suggestStarter picks whoever has the fewest turns waiting", () => {
  const { home, ids } = setup();
  assert.equal(suggestStarter(home).id, ids[1]);
  assert.equal(suggestStarter(addChore(home, "Nõud", ids[1])).id, ids[0]);
});

test("invite codes are readable and accept how people type them", () => {
  const code = createInviteCode();

  assert.equal(code.length, INVITE_CODE_LENGTH);
  assert.ok([...code].every((char) => INVITE_ALPHABET.includes(char)));
  assert.notEqual(createInviteCode(), code);
  assert.equal(normalizeInviteCode(" ab3d-ef7h "), "AB3DEF7H");
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
  assert.equal(parseHousehold('{"id":"x","inviteCode":"X","members":[],"chores":[]}'), null);
  assert.equal(
    parseHousehold(
      JSON.stringify({ ...home, chores: [{ ...home.chores[0], currentMemberId: "nobody" }] }),
    ),
    null,
  );
  // The old v1 format with numeric ids is not a household any more.
  assert.equal(
    parseHousehold('{"members":[{"id":0,"name":"A"},{"id":1,"name":"B"}],"chores":[],"nextId":2}'),
    null,
  );
});

test("the code field accepts a typed code or a whole pasted invite link", () => {
  assert.equal(inviteCodeFromInput("abcd 2345"), "ABCD2345");
  assert.equal(inviteCodeFromInput("ABCD-2345-XYZ"), "ABCD2345");
  assert.equal(inviteCodeFromInput("https://kordamooda.ee/liitu/abcd2345"), "ABCD2345");
  assert.equal(inviteCodeFromInput("Liitu: https://x.ee/liitu/ABCD2345?ref=1 "), "ABCD2345");
  assert.equal(inviteCodeFromInput(""), "");
});

test("an invite code is shown in two groups", () => {
  assert.equal(formatInviteCode("ABCD2345"), "ABCD 2345");
});
