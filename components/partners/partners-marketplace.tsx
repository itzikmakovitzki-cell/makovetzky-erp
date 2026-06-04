import { Briefcase, Inbox, Sparkles, Tag } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getPortalScope, permitClientFilter } from "@/lib/portal-access";
import { createSignedUrlsSafe, isStoragePath } from "@/lib/supabase-storage";
import { PartnerRequestDialog } from "@/components/portal/partner-request-dialog";

// Block 30 polish — shared marketplace renderer used by both
// /portal/partners and /(dashboard)/partners. Owns the data fetch + hero +
// card grid; each route adds its own back-link / chrome wrapper.

export async function PartnersMarketplace({
  user
}: {
  user: { id: string; role: string };
}) {
  const scope = await getPortalScope(user);

  const [permits, suppliers] = await Promise.all([
    prisma.permit.findMany({
      where: { deletedAt: null, ...permitClientFilter(scope) },
      select: {
        id: true,
        name: true,
        masterDeal: { select: { client: { select: { companyName: true } } } }
      },
      orderBy: [{ updatedAt: "desc" }]
    }),
    prisma.supplier.findMany({
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
    })
  ]);

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
    <div className="space-y-5">
      {/* Hero — primary accent + cream background. This is the public-
          facing marketplace tile; it intentionally breaks from the dense
          back-office aesthetic per Block 30 polish brief. */}
      <section className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-brand-cream via-background to-orange-50/40 px-5 py-6 dark:from-brand-navy/60 dark:via-background dark:to-orange-900/10 sm:px-8 sm:py-9">
        <div className="absolute -top-10 -end-10 size-48 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="absolute -bottom-12 -start-12 size-56 rounded-full bg-primary/5 blur-3xl" aria-hidden />
        <div className="relative max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="size-3" />
            Partners Marketplace
          </span>
          <h1 className="mt-3 text-[22px] font-bold leading-tight text-foreground sm:text-[28px]">
            בואו לרכוש מהשותפים שלנו
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground sm:text-[14px]">
            תהנו ממחירים משתלמים והנחות בלעדיות לחברים במאגר. כל הספקים שלנו
            עברו סינון, עומדים בלוחות זמנים, ומחויבים לאיכות. בקשו שירות בקליק
            אחד — אנחנו מתאמים את ההמשך.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full border bg-card/70 px-2 py-0.5">
              <Tag className="size-3" />
              הנחות לחברי המאגר
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border bg-card/70 px-2 py-0.5">
              <Briefcase className="size-3" />
              {suppliers.length} ספקים פעילים
            </span>
          </div>
        </div>
      </section>

      {suppliers.length === 0 && (
        <div className="rounded-md border bg-card p-8 text-center">
          <Inbox className="mx-auto size-10 text-muted-foreground" />
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

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {suppliers.map((s) => {
          const logo = resolveLogo(s.logoUrl);
          return (
            <li
              key={s.id}
              className="group flex flex-col rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-5"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
                  {logo ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={logo} alt="" className="size-full object-contain" />
                  ) : (
                    <Briefcase className="size-6 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold leading-tight text-foreground">
                    {s.name}
                  </div>
                  {s.type && (
                    <div className="mt-0.5 inline-block rounded bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {s.type}
                    </div>
                  )}
                  {s.website && (
                    <a
                      href={s.website.startsWith("http") ? s.website : `https://${s.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ms-1 inline-block text-[10px] text-muted-foreground underline-offset-2 hover:underline"
                    >
                      {s.website}
                    </a>
                  )}
                </div>
              </div>

              {s.marketingDescription && (
                <p className="mt-3 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted-foreground">
                  {s.marketingDescription}
                </p>
              )}

              <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                <span className="text-[10px] font-medium uppercase tracking-wider text-primary">
                  הטבת חברים
                </span>
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
