import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { GUIDES, getGuideBySlug, readGuideContent } from "@/lib/guides-data";
import { GuideMarkdown } from "@/components/guides/guide-markdown";

export const dynamic = "force-static";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export default async function GuideDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const meta = getGuideBySlug(slug);
  if (!meta) notFound();

  const content = readGuideContent(meta);

  return (
    <div className="space-y-4">
      <Link
        href="/guides"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="size-4" strokeWidth={1.75} />
        כל המדריכים
      </Link>

      <article className="rounded-lg border border-border bg-card p-5 shadow-sm md:p-7">
        <header className="mb-4 border-b border-border/60 pb-4">
          <h1 className="text-xl font-bold md:text-2xl">{meta.title}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {meta.description}
          </p>
          <div className="mt-2 text-[11px] text-muted-foreground/80">
            <span dir="ltr">עודכן {meta.updatedAt}</span>
          </div>
        </header>

        <GuideMarkdown content={content} />
      </article>
    </div>
  );
}
