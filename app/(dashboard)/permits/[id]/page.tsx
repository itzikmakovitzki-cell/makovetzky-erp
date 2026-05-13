import { redirect } from "next/navigation";

export default async function PermitRootPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/permits/${id}/tasks`);
}
