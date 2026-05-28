import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { ProposalForm } from "@/components/proposals/proposal-form";
import { PageHeader } from "@/components/global/page-header";

export const dynamic = "force-dynamic";

export default async function NewProposalPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  return (
    <section className="flex flex-col gap-3">
      <div>
        <Link
          href="/proposals"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="size-3" />
          חזרה להצעות מחיר
        </Link>
        <PageHeader
          title="הצעת מחיר חדשה"
          description="ההצעה לא תיצור לקוח/פרויקט במערכת. רק לאחר חתימת הלקוח תוכל להמיר אותה לפרויקט פעיל בלחיצה אחת."
          className="mt-2"
        />
      </div>

      <ProposalForm mode="create" />
    </section>
  );
}
