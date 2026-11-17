import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { JoinLink } from "@/components/JoinLink";
import { getHousehold } from "@/lib/actions";
import { inviteCodeFromInput } from "@/lib/household";

// Shown when the link is pasted into a chat app.
export const metadata: Metadata = {
  title: "Kutse KordaMöödasse",
  description: "Ava link, et näha sama kodutööde nimekirja ja kelle kord iga töö on.",
};

/**
 * The invite link. Joining happens in the browser (JoinLink), not here, so chat apps that
 * open the link to build a preview don't join anything.
 */
export default async function Page({ params }: PageProps<"/liitu/[kood]">) {
  const code = inviteCodeFromInput((await params).kood);
  const current = await getHousehold();

  // Opening your own household's link (e.g. to test it) just goes home.
  if (current?.inviteCode === code) redirect("/");

  return <JoinLink code={code} currentMembers={current?.members.map((member) => member.name)} />;
}
