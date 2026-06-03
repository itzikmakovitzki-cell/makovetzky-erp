import Link from "next/link";
import {
  ArrowLeft,
  Clipboard,
  ListChecks,
  MessageCircle,
  Rocket,
  Settings as SettingsIcon,
  Wallet
} from "lucide-react";
import { GUIDES, type GuideMeta } from "@/lib/guides-data";
import { PageHeader } from "@/components/global/page-header";

export const dynamic = "force-static";

// /guides — index of all in-app guides. Server component; no auth check here
// since middleware already enforces session, and guides contain no
// per-user data. Listed in registry order from lib/guides-data.ts.

const ICONS: Record<GuideMeta["iconKey"], typeof Rocket> = {
  rocket: Rocket,
  clipboard: Clipboard,
  wallet: Wallet,
  "message-circle": MessageCircle,
  "list-checks": ListChecks,
  settings: SettingsIcon
};

export default function GuidesIndexPage() {
  return (
    <section className="flex flex-col gap-4">
      <PageHeader
        title="מדריכים"
        accent={`(${GUIDES.length})`}
        description="מדריכי הפעלה ועזרה לשימוש במערכת. עברו עליהם פעם אחת ותגלו פיצ׳רים שלא הכרתם."
      />

      <ul className="grid gap-3 sm:grid-cols-2">
        {GUIDES.map((guide) => {
          const Icon = ICONS[guide.iconKey];
          return (
            <li key={guide.slug}>
              <Link
                href={`/guides/${guide.slug}`}
                className="group flex h-full flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="size-4" strokeWidth={1.75} />
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
                <div className="mt-auto pt-2 text-[11px] text-muted-foreground/80">
                  <span dir="ltr">עודכן {guide.updatedAt}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
