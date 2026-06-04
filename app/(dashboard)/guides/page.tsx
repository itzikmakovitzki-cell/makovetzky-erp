import Link from "next/link";
import {
  ArrowLeft,
  CheckSquare,
  Clipboard,
  Coins,
  FileSpreadsheet,
  Layers,
  Link as LinkIcon,
  ListChecks,
  MessageCircle,
  PlusCircle,
  Rocket,
  Search,
  Send,
  Settings as SettingsIcon,
  Sparkles,
  Wallet
} from "lucide-react";
import { GUIDES, type GuideMeta } from "@/lib/guides-data";
import { PageHeader } from "@/components/global/page-header";

export const dynamic = "force-static";

// /guides — index of all in-app guides. Server component; no auth check here
// since middleware already enforces session, and guides contain no
// per-user data. Two sections: main long-form guides and short how-to
// pocket guides.

const ICONS: Record<GuideMeta["iconKey"], typeof Rocket> = {
  rocket: Rocket,
  clipboard: Clipboard,
  wallet: Wallet,
  "message-circle": MessageCircle,
  "list-checks": ListChecks,
  settings: SettingsIcon,
  "plus-circle": PlusCircle,
  send: Send,
  "file-spreadsheet": FileSpreadsheet,
  layers: Layers,
  link: LinkIcon,
  coins: Coins,
  search: Search,
  "check-square": CheckSquare
};

export default function GuidesIndexPage() {
  const main = GUIDES.filter((g) => g.category === "main");
  const howto = GUIDES.filter((g) => g.category === "howto");

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="מדריכים"
        accent={`(${GUIDES.length})`}
        description="מדריכי הפעלה ועזרה לשימוש במערכת — עם מוקאפים ויזואליים, קיצורי דרך, וטיפים מהשטח."
      />

      {/* Hero callout */}
      <div className="flex gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="size-5" strokeWidth={1.75} />
        </span>
        <div className="flex-1 space-y-1.5">
          <h2 className="text-[15px] font-semibold text-foreground">
            חדשים במערכת?
          </h2>
          <p className="text-[13px] leading-6 text-muted-foreground">
            התחילו עם{" "}
            <Link
              href="/guides/quick-start"
              className="font-medium text-primary hover:underline"
            >
              התחלה מהירה
            </Link>{" "}
            (5 דקות) שמסביר את ההיררכיה, התפקידים והניווט. אחר כך{" "}
            <Link
              href="/guides/form-4-end-to-end"
              className="font-medium text-primary hover:underline"
            >
              טופס 4 — תהליך מקצה לקצה
            </Link>{" "}
            הוא הזרימה הראשית של היומיום.
          </p>
        </div>
      </div>

      {/* Main guides */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[16px] font-semibold">מדריכים ראשיים</h2>
          <span className="text-[12px] text-muted-foreground">
            {main.length} מדריכים מקיפים · קריאה של 5–10 דקות כל אחד
          </span>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {main.map((guide) => (
            <GuideCard key={guide.slug} guide={guide} ICONS={ICONS} />
          ))}
        </ul>
      </div>

      {/* How-to pocket guides */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[16px] font-semibold">איך עושים…? (How-to)</h2>
          <span className="text-[12px] text-muted-foreground">
            {howto.length} מדריכי כיס · 1–2 דקות קריאה
          </span>
        </div>
        <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {howto.map((guide) => (
            <GuideCardCompact
              key={guide.slug}
              guide={guide}
              ICONS={ICONS}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

function GuideCard({
  guide,
  ICONS
}: {
  guide: GuideMeta;
  ICONS: Record<GuideMeta["iconKey"], typeof Rocket>;
}) {
  const Icon = ICONS[guide.iconKey];
  return (
    <li>
      <Link
        href={`/guides/${guide.slug}`}
        className="group flex h-full flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="size-4" strokeWidth={1.75} />
            </span>
            <h3 className="text-[15px] font-semibold leading-snug">
              {guide.title}
            </h3>
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
}

function GuideCardCompact({
  guide,
  ICONS
}: {
  guide: GuideMeta;
  ICONS: Record<GuideMeta["iconKey"], typeof Rocket>;
}) {
  const Icon = ICONS[guide.iconKey];
  return (
    <li>
      <Link
        href={`/guides/${guide.slug}`}
        className="group flex h-full items-start gap-2.5 rounded-md border border-border/70 bg-card/60 p-2.5 transition-colors hover:border-primary/40 hover:bg-card"
      >
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-foreground/70 group-hover:bg-primary/10 group-hover:text-primary">
          <Icon className="size-3.5" strokeWidth={1.75} />
        </span>
        <div className="flex-1 space-y-0.5">
          <h3 className="text-[13px] font-semibold leading-snug">
            {guide.title}
          </h3>
          <p className="text-[12px] leading-snug text-muted-foreground line-clamp-2">
            {guide.description}
          </p>
        </div>
        <ArrowLeft
          className="mt-1 size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5 group-hover:text-foreground"
          strokeWidth={1.75}
        />
      </Link>
    </li>
  );
}
