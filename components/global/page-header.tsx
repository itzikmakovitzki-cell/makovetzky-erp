import { cn } from "@/lib/utils";

/**
 * Bold brand page header — navy title with an optional orange-accented word and
 * an orange underline rule, echoing the marketing site's hero typography.
 * Use at the top of main pages; tables/panels below stay dense and neutral.
 */
export function PageHeader({
  title,
  accent,
  description,
  action,
  className
}: {
  title: string;
  /** Optional trailing word rendered in brand orange (the landing-page split-heading trick). */
  accent?: string;
  description?: React.ReactNode;
  /** Optional right-aligned slot, e.g. a primary CTA button. */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-3 border-b border-border/60 pb-3",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-extrabold leading-tight tracking-tight text-brand-navy md:text-2xl">
          {title}
          {accent && <span className="text-primary">{" "}{accent}</span>}
        </h1>
        {/* Orange underline accent */}
        <span aria-hidden className="mt-2 block h-1 w-12 rounded-full bg-primary" />
        {description && (
          <p className="mt-2 text-xs text-muted-foreground md:text-[13px]">{description}</p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </header>
  );
}
