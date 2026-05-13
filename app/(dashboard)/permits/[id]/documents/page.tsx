import { DocumentsTab } from "@/components/permit/documents-tab";

export const dynamic = "force-dynamic";

export default async function PermitDocumentsTabPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DocumentsTab permitId={id} />;
}
