import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, FileText } from "lucide-react";
import { auth } from "@/auth";
import { ProposalForm } from "@/components/proposals/proposal-form";

export const dynamic = "force-dynamic";

export default async function NewProposalPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  return (
    <section className="flex flex-col gap-3">
      <header>
        <Link
          href="/proposals"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="size-3" />
          חזרה להצעות מחיר
        </Link>
        <h1 className="mt-1 flex items-center gap-2 text-base font-semibold">
          <FileText className="size-4" />
          הצעת מחיר חדשה
        </h1>
        <p className="text-[11px] text-muted-foreground">
          ההצעה לא תיצור לקוח/פרויקט במערכת. רק לאחר חתימת הלקוח תוכל להמיר אותה לפרויקט פעיל בלחיצה אחת.
        </p>
      </header>

      <ProposalForm mode="create" />
    </section>
  );
}
