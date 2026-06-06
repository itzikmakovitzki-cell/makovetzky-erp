import Link from "next/link";
import { ArrowLeft, Gift, Sparkles, Tag } from "lucide-react";

// Block 31 — the "VIP" entry point to the Partners Marketplace from the
// portal landing. Replaces the original small outline button per user
// feedback that the entry was plain / unclickable. Whole card is a Link
// so taps and hover work consistently across mouse and touch.
//
// Live supplier count is passed in so the banner reads as "alive" rather
// than a static piece of marketing copy. Falls back to a generic copy
// when zero suppliers are marked public yet.

export function MarketplacePromoBanner({
  href,
  supplierCount
}: {
  href: string;
  supplierCount: number;
}) {
  return (
    <Link
      href={href}
      aria-label="כניסה למאגר הספקים והשותפים"
      className="group relative block overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-l from-orange-50 via-brand-cream to-orange-100/70 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-primary/60 dark:from-brand-navy/40 dark:via-background dark:to-orange-900/20"
    >
      {/* Decorative blur orbs — match the marketplace hero so the visual
          language carries from landing → marketplace. Pure decoration,
          aria-hidden so screen readers skip them. */}
      <div
        className="pointer-events-none absolute -top-12 -end-12 size-48 rounded-full bg-primary/25 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-16 -start-12 size-56 rounded-full bg-primary/10 blur-3xl"
        aria-hidden
      />

      <div className="relative flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6">
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="size-3" />
            מועדון ההטבות
          </span>

          <h2 className="mt-2.5 text-[20px] font-bold leading-tight text-foreground sm:text-[24px]">
            מאגר הספקים והשותפים{" "}
            <span className="inline-block translate-y-[1px] text-[18px] sm:text-[22px]">
              ✨
            </span>
          </h2>

          <p className="mt-2 max-w-xl text-[12.5px] leading-relaxed text-muted-foreground sm:text-[13.5px]">
            מחפשים קבלן, יועץ או נותן שירות? קבלו גישה ישירה למאגר הספקים
            המומלצים שלנו, עם הנחות בלעדיות ללקוחות וקבלני מקובצקי.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded-full bg-card/80 px-2 py-0.5 text-muted-foreground ring-1 ring-border">
              <Gift className="size-3 text-primary" />
              הטבות לחברי מועדון
            </span>
            {supplierCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-card/80 px-2 py-0.5 text-muted-foreground ring-1 ring-border">
                <Tag className="size-3 text-primary" />
                {supplierCount} ספקים פעילים במאגר
              </span>
            )}
          </div>
        </div>

        {/* Magnet CTA — solid brand-orange, transforms into a chevron-lead
            invitation on hover. We size it big enough on mobile that it
            stays tappable even though the whole card is a link. */}
        <div className="flex shrink-0 items-center justify-start sm:justify-end">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all duration-200 group-hover:gap-2.5 group-hover:shadow-md">
            גלה את ההטבות
            <ArrowLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
