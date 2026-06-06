import { Mail, MessageCircle, Phone, User, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { buildWaMeUrl } from "@/lib/wa-link";
import { AddContactButton } from "./add-contact-button";
import { ContactRowActions } from "./contact-row-actions";

// Block 33 — server-side grid renderer shared between back-office
// (/permits/[id]/contacts) and portal (/portal/permit/[id]?tab=contacts).
// `canManage` toggles edit/delete affordances; the portal flag stays
// false so clients only get add + WhatsApp/call quick actions.

export async function ContactsGrid({
  permitId,
  canManage,
  variant = "card"
}: {
  permitId: string;
  canManage: boolean;
  // "card" = standalone surface with its own header. "embedded" = render
  // bare so the parent surface controls the heading (used inside the
  // portal tab where the page already has its own headings).
  variant?: "card" | "embedded";
}) {
  const contacts = await prisma.projectContact.findMany({
    where: { permitId },
    select: {
      id: true,
      name: true,
      role: true,
      phone: true,
      email: true,
      notes: true,
      createdAt: true,
      createdBy: {
        select: { id: true, name: true, role: true }
      }
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }]
  });

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="inline-flex items-center gap-1.5 text-[14px] font-semibold">
          <Users className="size-4 text-muted-foreground" />
          ספר טלפונים של הפרויקט
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {contacts.length}
          </span>
        </h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {canManage
            ? "אנשי הקשר המקצועיים של הפרויקט. ניתן לערוך ולמחוק."
            : "כל אנשי הקשר של הפרויקט. גם אתם יכולים להוסיף — נמשיך לעדכן את הצוות."}
        </p>
      </div>
      <AddContactButton permitId={permitId} variant="primary" />
    </div>
  );

  const content =
    contacts.length === 0 ? (
      <div className="rounded-md border bg-muted/20 px-3 py-8 text-center">
        <User className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-2 text-[13px] font-medium">עוד אין אנשי קשר בפרויקט הזה</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          לחצו על &quot;הוסף איש קשר&quot; כדי להתחיל למלא את הספר.
        </p>
      </div>
    ) : (
      <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {contacts.map((c) => {
          const waUrl = buildWaMeUrl(c.phone, "");
          const addedByPortal = c.createdBy?.role === "CONTRACTOR";
          return (
            <li
              key={c.id}
              className="group flex flex-col rounded-lg border bg-card p-3 shadow-sm transition-all hover:border-foreground/30 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold leading-tight text-foreground">
                    {c.name}
                  </div>
                  <div className="mt-0.5 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    {c.role}
                  </div>
                </div>
                {canManage && (
                  <ContactRowActions
                    permitId={permitId}
                    contact={{
                      id: c.id,
                      name: c.name,
                      role: c.role,
                      phone: c.phone,
                      email: c.email,
                      notes: c.notes
                    }}
                  />
                )}
              </div>

              {c.notes && (
                <p className="mt-2 line-clamp-2 text-[11.5px] italic leading-snug text-muted-foreground">
                  {c.notes}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {waUrl && (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                    title={`WhatsApp · ${c.phone}`}
                  >
                    <MessageCircle className="size-3" />
                    WhatsApp
                  </a>
                )}
                <a
                  href={`tel:${c.phone}`}
                  className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:bg-accent"
                  title={`חיוג · ${c.phone}`}
                >
                  <Phone className="size-3" />
                  חייג
                </a>
                {c.email && (
                  <a
                    href={`mailto:${c.email}`}
                    className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:bg-accent"
                    title={c.email}
                  >
                    <Mail className="size-3" />
                    מייל
                  </a>
                )}
              </div>

              <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="tabular-nums tracking-tight">{c.phone}</span>
                {addedByPortal && (
                  <span
                    className="rounded bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-700 dark:text-amber-300"
                    title="נוסף ע&quot;י לקוח דרך הפורטל"
                  >
                    נוסף ע&quot;י לקוח
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    );

  if (variant === "embedded") {
    return (
      <div className="space-y-3">
        {header}
        {content}
      </div>
    );
  }

  return (
    <section className="space-y-3 rounded-md border bg-card p-3 sm:p-4">
      {header}
      {content}
    </section>
  );
}
