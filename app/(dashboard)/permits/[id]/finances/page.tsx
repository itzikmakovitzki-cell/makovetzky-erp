import { FinancesTab } from "@/components/permit/finances-tab";

export const dynamic = "force-dynamic";

export default async function PermitFinancesTabPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <FinancesTab permitId={id} />;
}
