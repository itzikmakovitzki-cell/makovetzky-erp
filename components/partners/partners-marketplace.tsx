import Link from "next/link";
import { Briefcase, Inbox, Search, Sparkles, Tag } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPortalScope, permitClientFilter } from "@/lib/portal-access";
import { createSignedUrlsSafe, isStoragePath } from "@/lib/supabase-storage";
import { PartnerRequestDialog } from "@/components/portal/partner-request-dialog";
import { cn } from "@/lib/utils";

// Block 30 polish — shared marketplace renderer used by both
// /portal/partners and /(dashboard)/partners. Owns the data fetch + hero +
// category pills + name search + card grid. Each route adds its own
// back-link / chrome wrapper around it.
//
// Filters drive off search params on the URL — zero client state:
//   * ?category=<categoryId>   — exact match (omit for "all")
//   * ?q=<text>                — case-insensitive name OR marketing match

export type PartnersMarketplaceSearch = {
  category?: string;
  q?: string;
};

export async function PartnersMarketplace({
  user,
  basePath,
  search
}: {
  user: { id: string; role: string };
  // Used to build the filter-pill / search-form action URLs so the same
  // component works under /partners and /portal/partners.
  basePath: string;
  search: PartnersMarketplaceSearch;
}) {
  const scope = await getPortalScope(user);
  const activeCategoryId = search.category?.trim() || null;
  const query = (search.q ?? "").trim();

  // Filter clause for suppliers — composed up-front so a single query
  // does the lookup. categoryId is exact-match; q does case-insensitive
  // contains on name + marketing copy + type so a single search box
  // covers all the buckets a customer might type into it.
  const supplierWhere: Prisma.SupplierWhereInput = {
    isPublic: true,
    ...(activeCategoryId ? { categoryId: activeCategoryId } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { marketingDescription: { contains: query, mode: "insensitive" } },
            { type: { contains: query, mode: "insensitive" } }
          ]
        }
      : {})
  };

  const [permits, categories, suppliers, totalPublic] = await Promise.all([
    prisma.permit.findMany({
      where: { deletedAt: null, ...permitClientFilter(scope) },
      select: {
        id: true,
        name: true,
        masterDeal: { select: { client: { select: { companyName: true } } } }
      },
      orderBy: [{ updatedAt: "desc" }]
    }),
    prisma.partnerCategory.findMany({
      include: {
        _count: { select: { suppliers: { where: { isPublic: true } } } }
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }]
    }),
    prisma.supplier.findMany({
      where: supplierWhere,
      select: {
        id: true,
        name: true,
        type: true,
        marketingDescription: true,
        logoUrl: true,
        website: true,
        categoryId: true,
        category: { select: { id: true, name: true } }
      },
      orderBy: [{ name: "asc" }]
    }),
    prisma.supplier.count({ where: { isPublic: true } })
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

  // Build href that preserves the search query when switching category.
  const buildHref = (next: { category?: string | null; q?: string | null }) => {
    const params = new URLSearchParams();
    const cat = next.category === undefined ? activeCategoryId : next.category;
    const qv = next.q === undefined ? query : next.q;
    if (cat) params.set("category", cat);
    if (qv) params.set("q", qv);
    const s = params.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  const activeCategory = activeCategoryId
    ? categories.find((c) => c.id === activeCategoryId) ?? null
    : null;
  const isFiltered = !!activeCategoryId || !!query;

  return (
    <div className="space-y-5">
      {/* Hero */}
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
              {totalPublic} ספקים פעילים
            </span>
          </div>
        </div>
      </section>

      {/* Filters — search box + category pills, both URL-driven. */}
      <div className="flex flex-col gap-3">
        <form action={basePath} method="get" className="flex flex-wrap items-center gap-2">
          {activeCategoryId && (
            <input type="hidden" name="category" value={activeCategoryId} />
          )}
          <label className="relative flex-1 min-w-[200px]">
            <span className="sr-only">חיפוש לפי שם או תיאור</span>
            <Search className="pointer-events-none absolute end-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="חיפוש לפי שם ספק, מקצוע או מילת מפתח…"
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 pe-7 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-foreground px-3 py-1.5 text-[12px] font-medium text-background hover:opacity-90"
          >
            חפש
          </button>
          {isFiltered && (
            <Link
              href={basePath}
              className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
            >
              נקה סינון
            </Link>
          )}
        </form>

        {categories.length > 0 && (
          <div className="-mx-1 flex flex-wrap gap-1.5 overflow-x-auto px-1 pb-1">
            <CategoryPill
              href={buildHref({ category: null })}
              label="כל הקטגוריות"
              count={totalPublic}
              active={!activeCategoryId}
            />
            {categories.map((c) => (
              <CategoryPill
                key={c.id}
                href={buildHref({ category: c.id })}
                label={c.name}
                count={c._count.suppliers}
                description={c.description ?? undefined}
                active={activeCategoryId === c.id}
              />
            ))}
          </div>
        )}

        {(activeCategory?.description || query) && (
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-[11.5px] text-muted-foreground">
            {activeCategory?.description && (
              <span className="font-medium text-foreground">
                {activeCategory.name}:
              </span>
            )}{" "}
            {activeCategory?.description}
            {query && (
              <>
                {activeCategory?.description ? " · " : ""}
                <span>חיפוש: &quot;{query}&quot;</span>
              </>
            )}
          </div>
        )}
      </div>

      {suppliers.length === 0 && (
        <div className="rounded-md border bg-card p-8 text-center">
          <Inbox className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-2 text-[13px] text-muted-foreground">
            {isFiltered
              ? "לא נמצאו ספקים שמתאימים לסינון."
              : "עוד לא הוגדרו ספקים פומביים. נחזור אליך בקרוב עם מאגר מלא."}
          </p>
          {isFiltered && (
            <Link
              href={basePath}
              className="mt-2 inline-block text-[12px] text-foreground underline-offset-2 hover:underline"
            >
              איפוס סינון
            </Link>
          )}
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
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {s.category && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        {s.category.name}
                      </span>
                    )}
                    {s.type && (
                      <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {s.type}
                      </span>
                    )}
                  </div>
                  {s.website && (
                    <a
                      href={s.website.startsWith("http") ? s.website : `https://${s.website}`}
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

function CategoryPill({
  href,
  label,
  count,
  description,
  active
}: {
  href: string;
  label: string;
  count: number;
  description?: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      title={description}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-card hover:bg-accent"
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "rounded-full px-1.5 text-[10px] tabular-nums",
          active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
        )}
      >
        {count}
      </span>
    </Link>
  );
}
