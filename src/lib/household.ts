export const MIN_MEMBERS = 2;
export const MAX_MEMBERS = 6;
export const MAX_NAME_LENGTH = 24;
export const MAX_CHORE_LENGTH = 40;

export type Member = {
  id: number;
  name: string;
};

export type LastDone = {
  memberId: number;
  doneAt: string;
};

export type Chore = {
  id: number;
  name: string;
  currentMemberId: number;
  last: LastDone | null;
};

export type Household = {
  /** Queue order. A member's colour comes from their index in this list. */
  members: Member[];
  chores: Chore[];
  nextId: number;
};

/** A problem the user can fix. The message is shown to them as written. */
export class HouseholdError extends Error {}

function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function sameText(a: string, b: string): boolean {
  return a.toLocaleLowerCase("et") === b.toLocaleLowerCase("et");
}

export function createHousehold(rawNames: string[]): Household {
  const names = rawNames.map(cleanText).filter(Boolean);

  if (names.length < MIN_MEMBERS) {
    throw new HouseholdError("Kirjuta vähemalt kaks nime.");
  }
  if (names.length > MAX_MEMBERS) {
    throw new HouseholdError(`Ühes kodus saab olla kuni ${MAX_MEMBERS} inimest.`);
  }
  if (names.some((name) => name.length > MAX_NAME_LENGTH)) {
    throw new HouseholdError(`Nimi saab olla kuni ${MAX_NAME_LENGTH} tähemärki.`);
  }
  if (names.some((name, i) => names.findIndex((other) => sameText(other, name)) !== i)) {
    throw new HouseholdError("Nimed peavad erinema, et oleks näha, kelle kord on.");
  }

  return {
    members: names.map((name, id) => ({ id, name })),
    chores: [],
    nextId: names.length,
  };
}

export function addChore(household: Household, rawName: string, firstMemberId: number): Household {
  const name = cleanText(rawName);

  if (!name) throw new HouseholdError("Kirjuta töö nimi.");
  if (name.length > MAX_CHORE_LENGTH) {
    throw new HouseholdError(`Töö nimi saab olla kuni ${MAX_CHORE_LENGTH} tähemärki.`);
  }
  if (household.chores.some((chore) => sameText(chore.name, name))) {
    throw new HouseholdError(`${name} on juba nimekirjas.`);
  }

  const chore: Chore = {
    id: household.nextId,
    name,
    currentMemberId: firstMemberId,
    last: null,
  };
  return { ...household, chores: [...household.chores, chore], nextId: household.nextId + 1 };
}

export function nextMember(members: Member[], memberId: number): Member {
  const index = members.findIndex((member) => member.id === memberId);
  return members[(index + 1) % members.length];
}

export function markDone(household: Household, choreId: number, doneAt: string): Household {
  return {
    ...household,
    chores: household.chores.map((chore) =>
      chore.id === choreId
        ? {
            ...chore,
            currentMemberId: nextMember(household.members, chore.currentMemberId).id,
            last: { memberId: chore.currentMemberId, doneAt },
          }
        : chore,
    ),
  };
}

export function removeChore(household: Household, choreId: number): Household {
  return { ...household, chores: household.chores.filter((chore) => chore.id !== choreId) };
}

/** A new chore starts with whoever currently has the fewest turns waiting. */
export function suggestStarter(household: Household): Member {
  const load = (member: Member) =>
    household.chores.filter((chore) => chore.currentMemberId === member.id).length;
  return household.members.reduce((best, member) => (load(member) < load(best) ? member : best));
}

/** One letter for an avatar, or two when someone else's name starts the same way. */
export function initialsFor(members: Member[], member: Member): string {
  const firstLetter = (name: string) => Array.from(name)[0]?.toLocaleUpperCase("et") ?? "";
  const shared = members.some(
    (other) => other.id !== member.id && firstLetter(other.name) === firstLetter(member.name),
  );
  if (!shared) return firstLetter(member.name);
  return firstLetter(member.name) + (Array.from(member.name)[1] ?? "");
}

function dayNumber(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
}

export function relativeDay(iso: string, now: string): string {
  const days = dayNumber(new Date(now)) - dayNumber(new Date(iso));
  if (days <= 0) return "täna";
  if (days === 1) return "eile";
  return `${days} päeva tagasi`;
}

/** Returns null for anything that isn't a household, such as damaged saved data. */
export function parseHousehold(raw: string): Household | null {
  try {
    const data = JSON.parse(raw);
    const memberIds: unknown[] = data.members.map((member: Member) => member.id);
    const valid =
      Number.isInteger(data.nextId) &&
      memberIds.length >= MIN_MEMBERS &&
      data.members.every((member: Member) => typeof member.name === "string") &&
      data.chores.every(
        (chore: Chore) =>
          Number.isInteger(chore.id) &&
          typeof chore.name === "string" &&
          memberIds.includes(chore.currentMemberId),
      );
    return valid ? (data as Household) : null;
  } catch {
    return null;
  }
}
