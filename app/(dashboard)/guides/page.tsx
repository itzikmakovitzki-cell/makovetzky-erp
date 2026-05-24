import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { GUIDES } from "@/lib/guides-data";

export const dynamic = "force-static";

// /guides — index of all in-app guides. Server component; no auth check here
// since middleware already enforces session, and guides contain no
// per-user data. Listed in registry order from lib/guides-data.ts.

export default function GuidesIndexPage() {
  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">מדריכים</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            מדריכי הפעלה ועזרה לשימוש במערכת.
          </p>
        </div>
        <span className="hidden text-xs text-muted-foreground md:inline">
          {GUIDES.length} מדריכים
        </span>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2">
        {GUIDES.map((guide) => (
          <li key={guide.slug}>
            <Link
              href={`/guides/${guide.slug}`}
              className="group flex h-full flex-col gap-2 rounded-lg border border-border bg-background p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-foreground/40 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                    <BookOpen
                      className="size-4 text-foreground/70"
                      strokeWidth={1.75}
                    />
                  </span>
                  <h2 className="text-[15px] font-semibold leading-snug">
                    {guide.title}
                  </h2>
                </div>
                <ArrowLeft
                  className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5 group-hover:text-foreground"
                  strokeWidth={1.75}
                />
              </div>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {guide.description}
              </p>
              <div className="mt-auto flex items-center gap-3 pt-2 text-[11px] text-muted-foreground/80">
                {guide.author && <span>{guide.author}</span>}
                <span>·</span>
                <span dir="ltr">עודכן {guide.updatedAt}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
