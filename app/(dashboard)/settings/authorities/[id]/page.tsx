import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Building2 } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  AuthorityDetailClient,
  type WikiEntryRow
} from "@/components/settings/authority-detail-client";

export const dynamic = "force-dynamic";

export default async function AuthorityDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  // Middleware enforces ADMIN on /settings/* but we re-check here so a
  // misconfigured matcher can never leak an admin-only page.
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    redirect("/permits");
  }

  const { id } = await params;

  const authority = await prisma.authority.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          permits: { where: { deletedAt: null } },
          taskTemplates: true,
          wikiEntries: true
        }
      },
      wikiEntries: {
        orderBy: [{ category: "asc" }, { createdAt: "asc" }]
      }
    }
  });

  if (!authority) notFound();

  const entries: WikiEntryRow[] = authority.wikiEntries.map((e) => ({
    id: e.id,
    title: e.title,
    category: e.category,
    contentMd: e.contentMd,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString()
  }));

  return (
    <div className="flex flex-col gap-3">
      <Link
        href="/settings/authorities"
        className="inline-flex w-fit items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="size-3" />
        חזרה לרשויות
      </Link>

      <header className="rounded-md border bg-card p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-2">
              <Building2 className="size-4 text-muted-foreground" />
              <h1 className="text-base font-semibold">{authority.name}</h1>
            </div>
            {authority.region && (
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                מחוז: {authority.region}
              </div>
            )}
            {authority.contactInfo && (
              <div className="mt-0.5 text-[11px] text-muted-foreground whitespace-pre-line">
                {authority.contactInfo}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
            <span className="rounded border bg-muted/30 px-2 py-1">
              <span className="font-medium tabular-nums text-foreground">
                {authority._count.permits}
              </span>{" "}
              היתרים פעילים
            </span>
            <span className="rounded border bg-muted/30 px-2 py-1">
              <span className="font-medium tabular-nums text-foreground">
                {authority._count.taskTemplates}
              </span>{" "}
              תבניות משימות
            </span>
            <span className="rounded border bg-muted/30 px-2 py-1">
              <span className="font-medium tabular-nums text-foreground">
                {authority._count.wikiEntries}
              </span>{" "}
              רשומות ויקי
            </span>
          </div>
        </div>
      </header>

      <AuthorityDetailClient authorityId={authority.id} entries={entries} />
    </div>
  );
}
