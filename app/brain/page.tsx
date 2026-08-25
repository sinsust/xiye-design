import { getSessionUser } from "@/lib/auth";
import { listBrainNotes } from "@/lib/brain-db";
import { SecondBrain } from "@/components/second-brain";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function BrainPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const notes = await listBrainNotes(user.sub);
  return <SecondBrain notes={notes} />;
}