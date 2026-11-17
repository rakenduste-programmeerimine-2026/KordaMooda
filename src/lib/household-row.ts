import type { Household } from "./household.ts";

/** A household as Supabase returns it, with members and chores embedded. */
export type HouseholdRow = {
  id: string;
  invite_code: string;
  members: { id: string; name: string; position: number }[];
  chores: {
    id: string;
    name: string;
    current_member_id: string;
    last_member_id: string | null;
    last_done_at: string | null;
    created_at: string;
  }[];
};

/** Turns database rows into the `Household` shape the UI uses (see `src/lib/actions.ts`). */
export function toHousehold(row: HouseholdRow): Household {
  return {
    id: row.id,
    inviteCode: row.invite_code,
    // Queue order, which also decides each member's colour.
    members: [...row.members]
      .sort((a, b) => a.position - b.position)
      .map(({ id, name }) => ({ id, name })),
    // Oldest first, so a new chore appears at the bottom like before.
    chores: [...row.chores]
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
      .map((chore) => ({
        id: chore.id,
        name: chore.name,
        currentMemberId: chore.current_member_id,
        last:
          chore.last_member_id && chore.last_done_at
            ? { memberId: chore.last_member_id, doneAt: chore.last_done_at }
            : null,
      })),
  };
}
