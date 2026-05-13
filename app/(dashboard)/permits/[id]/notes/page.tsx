import { NotesTab } from "@/components/permit/notes-tab";

export const dynamic = "force-dynamic";

export default async function PermitNotesTabPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <NotesTab permitId={id} />;
}
