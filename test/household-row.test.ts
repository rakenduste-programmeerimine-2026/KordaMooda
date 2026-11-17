import assert from "node:assert/strict";
import { test } from "node:test";
import { toHousehold } from "../src/lib/household-row.ts";

const row = {
  id: "h1",
  invite_code: "ABCD2345",
  members: [
    { id: "m-jaan", name: "Jaan", position: 1 },
    { id: "m-mari", name: "Mari", position: 0 },
  ],
  chores: [
    {
      id: "c-noud",
      name: "Nõud",
      current_member_id: "m-mari",
      last_member_id: "m-jaan",
      last_done_at: "2026-11-17T10:00:00+00:00",
      created_at: "2026-11-17T09:00:00+00:00",
    },
    {
      id: "c-prugi",
      name: "Prügi",
      current_member_id: "m-jaan",
      last_member_id: null,
      last_done_at: null,
      created_at: "2026-11-17T08:00:00+00:00",
    },
  ],
};

test("database rows become the household the UI uses", () => {
  assert.deepEqual(toHousehold(row), {
    id: "h1",
    inviteCode: "ABCD2345",
    members: [
      { id: "m-mari", name: "Mari" },
      { id: "m-jaan", name: "Jaan" },
    ],
    chores: [
      { id: "c-prugi", name: "Prügi", currentMemberId: "m-jaan", last: null },
      {
        id: "c-noud",
        name: "Nõud",
        currentMemberId: "m-mari",
        last: { memberId: "m-jaan", doneAt: "2026-11-17T10:00:00+00:00" },
      },
    ],
  });
});

test("a chore whose last doer was removed shows no last done", () => {
  const orphan = { ...row.chores[0], last_member_id: null };
  assert.equal(toHousehold({ ...row, chores: [orphan] }).chores[0].last, null);
});
