import Image from "next/image";
import { AlertTriangle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FieldUploadForm } from "@/components/magic-link/field-upload-form";
import { prisma } from "@/lib/prisma";
import { TASK_STATUS_LABEL, TASK_STATUS_VARIANT } from "@/lib/status-maps";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MagicLinkPage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const link = await prisma.magicLink.findUnique({
    where: { token },
    include: {
      task: {
        select: {
          id: true,
          name: true,
          status: true,
          deletedAt: true,
          permit: {
            select: {
              id: true,
              name: true,
              permitNumber: true,
              authority: { select: { name: true } },
              masterDeal: {
                select: { client: { select: { companyName: true } } }
              }
            }
          }
        }
      }
    }
  });

  // Early-return narrowing so the happy path knows link.task is non-null.
  if (!link) {
    return (
      <PublicShell>
        <InvalidLink reason="not_found" />
      </PublicShell>
    );
  }
  if (!link.task || link.task.deletedAt) {
    return (
      <PublicShell>
        <InvalidLink reason="task_unavailable" />
      </PublicShell>
    );
  }
  if (link.expiresAt < new Date()) {
    return (
      <PublicShell>
        <InvalidLink reason="expired" expiresAt={link.expiresAt.toISOString()} />
      </PublicShell>
    );
  }

  const task = link.task;
  const permit = task.permit;

  return (
    <PublicShell>
      <section className="rounded-md border bg-card p-4">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          פרויקט
        </div>
        <div className="text-sm font-semibold leading-tight">{permit.name}</div>
        {permit.masterDeal.client.companyName && (
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            לקוח: {permit.masterDeal.client.companyName}
          </div>
        )}
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          רשות: {permit.authority.name}
          {permit.permitNumber && <> · {permit.permitNumber}</>}
        </div>

        <div className="mt-3 border-t pt-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            משימה
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{task.name}</span>
            <Badge variant={TASK_STATUS_VARIANT[task.status]}>
              {TASK_STATUS_LABEL[task.status]}
            </Badge>
          </div>
        </div>

        <div className="mt-3 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="size-3" />
          תוקף הגישה: {formatDateTime(link.expiresAt)}
        </div>
      </section>

      <FieldUploadForm token={token} taskName={task.name} />
    </PublicShell>
  );
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-muted/30 px-4 py-6">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <header className="flex flex-col items-center gap-2">
          <Image
            src="/logo.png"
            alt="מקובצקי — ניהול פרויקטים"
            width={640}
            height={271}
            priority
            className="h-auto w-48 object-contain"
          />
          <p className="text-[11px] text-muted-foreground">גישה ייעודית לעובד שטח</p>
        </header>

        {children}

        <footer className="text-center text-[10px] text-muted-foreground">
          מערכת מקובצקי · ניהול פרויקטים בנייה
        </footer>
      </div>
    </main>
  );
}

function InvalidLink({
  reason,
  expiresAt
}: {
  reason: "not_found" | "expired" | "task_unavailable";
  expiresAt?: string;
}) {
  const titles = {
    not_found: "הקישור לא נמצא",
    expired: "תוקף הקישור פג",
    task_unavailable: "המשימה אינה זמינה"
  } as const;
  const messages = {
    not_found:
      "ייתכן שהקישור הוקלד באופן שגוי או שכבר נמחק. פנה להנהלה לקבלת קישור חדש.",
    expired:
      "הקישור היה תקף עד תאריך מסוים שכבר חלף. פנה להנהלה לקבלת קישור חדש.",
    task_unavailable:
      "המשימה הקשורה לקישור הזה הוסרה מהמערכת. פנה להנהלה."
  } as const;

  return (
    <section className="rounded-md border border-red-500/40 bg-red-500/5 p-4 text-center">
      <AlertTriangle className="mx-auto size-8 text-red-600" />
      <h2 className="mt-2 text-sm font-semibold text-red-800 dark:text-red-300">
        {titles[reason]}
      </h2>
      <p className="mt-1 text-[12px] leading-relaxed text-red-700 dark:text-red-300">
        {messages[reason]}
      </p>
      {reason === "expired" && expiresAt && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          פג ב-{formatDateTime(expiresAt)}
        </p>
      )}
    </section>
  );
}
