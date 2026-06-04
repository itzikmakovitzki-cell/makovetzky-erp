import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ProposalForm } from "@/components/proposals/proposal-form";
import { PageHeader } from "@/components/global/page-header";
import type { ProposalMilestoneJson } from "@/app/actions/proposals";

export const dynamic = "force-dynamic";

export default async function EditProposalPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  const { id } = await params;
  const proposal = await prisma.proposal.findFirst({
    where: { id, deletedAt: null }
  });
  if (!proposal) notFound();
  // Only DRAFT proposals are editable — same gate as the server action.
  if (proposal.status !== "DRAFT") {
    redirect(`/proposals/${id}`);
  }

  const milestones = Array.isArray(proposal.milestones)
    ? (proposal.milestones as unknown as ProposalMilestoneJson[])
    : [];

  return (
    <section className="flex flex-col gap-3">
      <div>
        <Link
          href={`/proposals/${id}`}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="size-3" />
          חזרה להצעה
        </Link>
        <PageHeader title="עריכת הצעת מחיר" className="mt-2" />
      </div>

      <ProposalForm
        mode="update"
        initial={{
          id: proposal.id,
          customerName: proposal.customerName,
          customerPhone: proposal.customerPhone,
          customerEmail: proposal.customerEmail ?? "",
          projectLocation: proposal.projectLocation ?? "",
          totalAmount: String(proposal.totalAmount),
          terms: proposal.terms ?? "",
          quoteTitle: proposal.quoteTitle ?? "",
          serviceDescription: proposal.serviceDescription ?? "",
          milestones
        }}
      />
    </section>
  );
}
