import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import type { Prisma, SupplierAssignmentStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/global/page-header";
import { LeadsTable } from "@/components/leads/leads-table";
import type { LeadRow } from "@/components/leads/leads-table";

const TERMINAL_STATUSES = new Set(["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);

// Block 38 — PM Lead Tracker dashboard.
//
// Surfaces every SupplierTaskAssignment whose Task name starts with
// "ליד שותף" — i.e. the rows that generatePartnerLead creates when a
// client/admin/contractor requests service through the Partners
// Marketplace. The PM lands here to triage: who responded, who hasn't,
// and which leads converted into paid work.

export const dynamic = "force-dynamic";

export default async function LeadsTrackerPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "EMPLOYEE") {
    redirect("/permits");
  }

  const sp = await searchParams;
  const statusFilter =
    typeof sp.status === "string" && sp.status.trim() ? sp.status.trim() : "ALL";

  const where: Prisma.SupplierTaskAssignmentWhereInput = {
    task: {
      name: { startsWith: "ליד שותף" },
      deletedAt: null
    }
  };
  // OPEN here is an alias for "still actionable" (open + in_progress); the
  // other chips map straight onto the enum value. Anything unknown falls
  // through to "ALL" (no extra filter).
  if (statusFilter === "OPEN") {
    where.status = { in: ["OPEN", "IN_PROGRESS"] };
  } else if (TERMINAL_STATUSES.has(statusFilter) && statusFilter !== "OPEN") {
    where.status = statusFilter as SupplierAssignmentStatus;
  }

  const assignments = await prisma.supplierTaskAssignment.findMany({
    where,
    select: {
      id: true,
      status: true,
      notes: true,
      createdAt: true,
      completedAt: true,
      supplier: { select: { id: true, name: true } },
      task: {
        select: {
          id: true,
          name: true,
          permit: {
            select: {
              id: true,
              name: true,
              masterDeal: {
                select: {
                  client: {
                    select: {
                      id: true,
                      companyName: true,
                      contactName: true,
                      phone: true,
                      clientType: true
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    orderBy: [{ createdAt: "desc" }]
  });

  const rows: LeadRow[] = assignments.map((a) => ({
    id: a.id,
    status: a.status,
    notes: a.notes,
    createdAt: a.createdAt.toISOString(),
    completedAt: a.completedAt?.toISOString() ?? null,
    supplier: a.supplier,
    task: { id: a.task.id, name: a.task.name },
    permit: { id: a.task.permit.id, name: a.task.permit.name },
    client: {
      id: a.task.permit.masterDeal.client.id,
      companyName: a.task.permit.masterDeal.client.companyName,
      contactName: a.task.permit.masterDeal.client.contactName,
      phone: a.task.permit.masterDeal.client.phone,
      clientType:
        a.task.permit.masterDeal.client.clientType === "BUSINESS"
          ? "BUSINESS"
          : "PRIVATE"
    }
  }));

  // Counts for the filter chips. One COUNT(*) GROUP BY would be cheaper but
  // this list is tiny — keep it readable.
  const counts = {
    all: rows.length,
    open: rows.filter((r) => r.status === "OPEN" || r.status === "IN_PROGRESS").length,
    completed: rows.filter((r) => r.status === "COMPLETED").length,
    cancelled: rows.filter((r) => r.status === "CANCELLED").length
  };

  return (
    <section className="flex flex-col gap-4">
      <PageHeader
        title="ניהול לידים"
        accent={`(${counts.all})`}
        description="לידי שותפים שהגיעו דרך Partners Marketplace. כאן עוקבים אחרי תגובת הספק, מסמנים סטטוס ומשאירים הערות לפני שהליד הופך לעבודה משולמת."
      />

      <nav className="flex flex-wrap items-center gap-1.5 text-[12px]">
        <FilterChip label={`כל הלידים (${counts.all})`} active={statusFilter === "ALL"} href="/leads" />
        <FilterChip
          label={`פתוחים (${counts.open})`}
          active={statusFilter === "OPEN"}
          href="/leads?status=OPEN"
        />
        <FilterChip
          label={`הסתיים (${counts.completed})`}
          active={statusFilter === "COMPLETED"}
          href="/leads?status=COMPLETED"
        />
        <FilterChip
          label={`בוטל (${counts.cancelled})`}
          active={statusFilter === "CANCELLED"}
          href="/leads?status=CANCELLED"
        />
      </nav>

      {rows.length === 0 ? (
        <div className="rounded-md border bg-card p-8 text-center">
          <Inbox className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-2 text-[13px] text-muted-foreground">
            {counts.all === 0
              ? "עוד לא נוצרו לידי שותפים. ברגע שלקוח / קבלן יבקש שירות מהפורטל — הליד יופיע כאן."
              : "אין לידים שמתאימים לסינון הנוכחי."}
          </p>
        </div>
      ) : (
        <LeadsTable rows={rows} />
      )}
    </section>
  );
}

function FilterChip({
  label,
  active,
  href
}: {
  label: string;
  active: boolean;
  href: string;
}) {
  return (
    <a
      href={href}
      className={
        active
          ? "inline-flex items-center gap-1 rounded-full border border-primary bg-primary px-3 py-1 text-[11.5px] font-medium text-primary-foreground"
          : "inline-flex items-center gap-1 rounded-full border border-input bg-background px-3 py-1 text-[11.5px] text-muted-foreground hover:bg-accent hover:text-foreground"
      }
    >
      {label}
    </a>
  );
}
