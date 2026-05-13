import { AuditLogTab } from "@/components/permit/audit-log-tab";

export const dynamic = "force-dynamic";

export default async function PermitAuditTabPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AuditLogTab permitId={id} />;
}
