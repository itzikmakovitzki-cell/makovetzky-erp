import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Briefcase, Inbox } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPortalScope, permitClientFilter } from "@/lib/portal-access";
import { createSignedUrlsSafe, isStoragePath } from "@/lib/supabase-storage";
import { PartnerRequestDialog } from "@/components/portal/partner-request-dialog";

export const dynamic = "force-dynamic";

// Block 30 — Partners Marketplace (client portal half).
//
// Renders every Supplier where isPublic = true as a card with the supplier's
// marketing description, logo, and a "בקש שירות" CTA. The CTA opens a
// dialog that asks which permit the request is for (auto-selected when the
// client only has one) and calls generatePartnerLead.

export default async function PortalPartnersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = { id: session.user.id, role: session.user.role };
  const scope = await getPortalScope(user);

  // The permits the user can attach a request to. Same access scoping the
  // rest of the portal uses — admins see all, contractors see only their
  // client's permits.
  const permits = await prisma.permit.findMany({
    where: { deletedAt: null, ...permitClientFilter(scope) },
    select: {
      id: true,
      name: true,
      masterDeal: { select: { client: { select: { companyName: true } } } }
    },
    orderBy: [{ updatedAt: "desc" }]
  });

  const suppliers = await prisma.supplier.findMany({
    where: { isPublic: true },
    select: {
      id: true,
      name: true,
      type: true,
      marketingDescription: true,
      logoUrl: true,
      website: true
    },
    orderBy: [{ name: "asc" }]
  });

  // Resolve any Supabase-storage paths into signed URLs in one batch.
  const storagePaths = suppliers
    .map((s) => s.logoUrl)
    .filter((u): u is string => !!u && isStoragePath(u));
  const signed = await createSignedUrlsSafe(storagePaths);
  const resolveLogo = (raw: string | null): string | null => {
    if (!raw) return null;
    if (isStoragePath(raw)) return signed.get(raw) ?? null;
    return raw;
  };

  const permitOptions = permits.map((p) => ({
    id: p.id,
    label: `${p.name} — ${p.masterDeal.client.companyName}`
  }));

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/portal"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="size-3" />
          חזרה לפורטל
        </Link>
      </div>

      <header>
        <h1 className="text-base font-semibold sm:text-lg">מאגר ספקים ושותפים</h1>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          זקוק לבדיקת חשמל, מודד, יועץ בטיחות או שירות אחר לפרויקט? בחר ספק
          ושלח לו בקשה — נטפל בהמשך התיאום והעמלות מולו.
        </p>
      </header>

      {suppliers.length === 0 && (
        <div className="rounded-md border bg-card p-6 text-center">
          <Inbox className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 text-[13px] text-muted-foreground">
            עוד לא הוגדרו ספקים פומביים. נחזור אליך בקרוב עם מאגר מלא.
          </p>
        </div>
      )}

      {suppliers.length > 0 && permitOptions.length === 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-50/40 p-3 text-[12px] text-amber-800 dark:bg-amber-500/5 dark:text-amber-200">
          אין לך עדיין פרויקטים שניתן לקשר אליהם בקשת שירות. צוות מקובצקי
          יקשר אותך לפרויקט הרלוונטי בקרוב.
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {suppliers.map((s) => {
          const logo = resolveLogo(s.logoUrl);
          return (
            <li
              key={s.id}
              className="flex flex-col rounded-md border bg-card p-3 sm:p-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
                  {logo ? (
                    /* Plain <img>: logos come from arbitrary sources (Supabase
                       Storage + external URLs) and aren't worth Next/Image's
                       optimizer pipeline. */
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={logo}
                      alt=""
                      className="size-full object-contain"
                    />
                  ) : (
                    <Briefcase className="size-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold leading-tight">
                    {s.name}
                  </div>
                  {s.type && (
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {s.type}
                    </div>
                  )}
                  {s.website && (
                    <a
                      href={
                        s.website.startsWith("http") ? s.website : `https://${s.website}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-[10px] text-muted-foreground underline-offset-2 hover:underline"
                    >
                      {s.website}
                    </a>
                  )}
                </div>
              </div>

              {s.marketingDescription && (
                <p className="mt-2 whitespace-pre-wrap text-[12px] leading-snug text-muted-foreground">
                  {s.marketingDescription}
                </p>
              )}

              <div className="mt-auto flex justify-end pt-3">
                <PartnerRequestDialog
                  supplierId={s.id}
                  supplierName={s.name}
                  permitOptions={permitOptions}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
