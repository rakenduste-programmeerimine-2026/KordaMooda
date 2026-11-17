export const MIN_MEMBERS = 2;
export const MAX_MEMBERS = 6;
export const MAX_NAME_LENGTH = 24;
export const MAX_CHORE_LENGTH = 40;
/** No 0/O or 1/I/L, so a code read off a screen is typed in right. */
export const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 8;

/** Ids are uuids so they can come straight from the database. */
export type Id = string;

export type Member = {
  id: Id;
  name: string;
};

export type LastDone = {
  memberId: Id;
  /** ISO time. Set by the server, never by the client. */
  doneAt: string;
};

export type Chore = {
  id: Id;
  name: string;
  currentMemberId: Id;
  last: LastDone | null;
};

export type Household = {
  id: Id;
  /** Shared with a partner so they can join. */
  inviteCode: string;
  /** Queue order. A member's colour comes from their index in this list. */
  members: Member[];
  chores: Chore[];
};

/** A problem the user can fix. The message is shown to them as written. */
export class HouseholdError extends Error {}

/** Someone else changed the same thing first, e.g. both phones pressed "Tehtud". */
export class ConflictError extends HouseholdError {}

function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function sameText(a: string, b: string): boolean {
  return a.toLocaleLowerCase("et") === b.toLocaleLowerCase("et");
}

export function newId(): Id {
  return crypto.randomUUID();
}

export function createInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(INVITE_CODE_LENGTH));
  // 256 is not a multiple of the alphabet size; the bias is far too small to matter here.
  return Array.from(bytes, (byte) => INVITE_ALPHABET[byte % INVITE_ALPHABET.length]).join("");
}

/** Accepts what people actually type: lower case, spaces, dashes. */
export function normalizeInviteCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** The link a partner opens to join. */
export function invitePath(code: string): string {
  return `/liitu/${code}`;
}

/** Reads a code from what was typed or pasted into the code field, even a whole invite link. */
export function inviteCodeFromInput(raw: string): string {
  const afterLink = raw.split("/liitu/").at(-1) ?? "";
  const code = raw.includes("/liitu/") ? afterLink.split(/[?#/]/)[0] : raw;
  return normalizeInviteCode(code).slice(0, INVITE_CODE_LENGTH);
}

/** "ABCD2345" → "ABCD 2345", easier to read out loud. */
export function formatInviteCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, "$1 ");
}

/** Validates and tidies people's names. Throws HouseholdError. */
export function cleanMemberNames(rawNames: string[]): string[] {
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
  return names;
}

export function createHousehold(rawNames: string[]): Household {
  return {
    id: newId(),
    inviteCode: createInviteCode(),
    members: cleanMemberNames(rawNames).map((name) => ({ id: newId(), name })),
    chores: [],
  };
}

/** Validates and tidies a chore name against the household's other chores. Throws HouseholdError. */
export function cleanChoreName(household: Household, rawName: string): string {
  const name = cleanText(rawName);

  if (!name) throw new HouseholdError("Kirjuta töö nimi.");
  if (name.length > MAX_CHORE_LENGTH) {
    throw new HouseholdError(`Töö nimi saab olla kuni ${MAX_CHORE_LENGTH} tähemärki.`);
  }
  if (household.chores.some((chore) => sameText(chore.name, name))) {
    throw new HouseholdError(`${name} on juba nimekirjas.`);
  }
  return name;
}

export function addChore(household: Household, rawName: string, firstMemberId: Id): Household {
  const name = cleanChoreName(household, rawName);
  if (!household.members.some((member) => member.id === firstMemberId)) {
    throw new HouseholdError("Vali, kellest järjekord algab.");
  }

  const chore: Chore = { id: newId(), name, currentMemberId: firstMemberId, last: null };
  return { ...household, chores: [...household.chores, chore] };
}

export function nextMember(members: Member[], memberId: Id): Member {
  const index = members.findIndex((member) => member.id === memberId);
  return members[(index + 1) % members.length];
}

export function markDone(household: Household, choreId: Id, doneAt: string): Household {
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

export function removeChore(household: Household, choreId: Id): Household {
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
      typeof data.id === "string" &&
      typeof data.inviteCode === "string" &&
      memberIds.length >= MIN_MEMBERS &&
      data.members.every(
        (member: Member) => typeof member.id === "string" && typeof member.name === "string",
      ) &&
      data.chores.every(
        (chore: Chore) =>
          typeof chore.id === "string" &&
          typeof chore.name === "string" &&
          memberIds.includes(chore.currentMemberId),
      );
    return valid ? (data as Household) : null;
  } catch {
    return null;
  }
}
