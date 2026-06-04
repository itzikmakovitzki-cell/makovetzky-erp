import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Lightbulb,
  ShieldAlert
} from "lucide-react";
import { cn } from "@/lib/utils";

// Richer Markdown renderer for the in-app Guides feature. The notes/wiki
// Markdown component at components/ui/markdown.tsx stays intentionally minimal
// (admin-authored short content); this one handles the long-form docs format
// we use for the system user guide. Still zero deps.
//
// Block-level grammar:
//   - # / ## / ### / #### headings
//   - "- " or "* " bullet lists
//   - "1. " / "2. " numbered lists — rendered as numbered step cards
//   - "> " blockquotes (consecutive lines = one quote block)
//   - "```" fenced code blocks (optional language tag)
//   - "---" horizontal rule
//   - "| a | b |" markdown tables with "|---|---|" separator
//   - ":::tip / :::info / :::warning / :::success / :::danger" fenced callouts
//   - ":::frame title=\"...\"" fenced browser-like mockup frame
//   - ":::cols" fenced 2-column layout (use "---" inside to split columns)
//   - "![alt](path)" image with optional caption (next non-blank line that
//     starts with "_caption: " becomes the caption italic line below)
//   - paragraphs separated by blank lines
//
// Inline grammar (priority order in regex alternation):
//   - **bold**
//   - *italic*
//   - `code`
//   - <kbd>Ctrl+K</kbd>
//   - {role:admin|employee|contractor|public} role chip
//   - [text](url) — external links open in new tab with rel="noopener"

export function GuideMarkdown({
  content,
  className
}: {
  content: string;
  className?: string;
}) {
  const blocks = parseBlocks(content);
  return (
    <div
      className={cn(
        "space-y-3 text-[14px] leading-7 text-foreground/90",
        className
      )}
    >
      {blocks}
    </div>
  );
}

type CalloutKind = "tip" | "info" | "warning" | "success" | "danger";

const CALLOUT_STYLES: Record<
  CalloutKind,
  { wrap: string; icon: React.ElementType; label: string }
> = {
  tip: {
    wrap: "border-amber-300/70 bg-amber-50 text-amber-950",
    icon: Lightbulb,
    label: "טיפ"
  },
  info: {
    wrap: "border-sky-300/70 bg-sky-50 text-sky-950",
    icon: Info,
    label: "לידיעתך"
  },
  warning: {
    wrap: "border-orange-300/70 bg-orange-50 text-orange-950",
    icon: AlertTriangle,
    label: "אזהרה"
  },
  success: {
    wrap: "border-emerald-300/70 bg-emerald-50 text-emerald-950",
    icon: CheckCircle2,
    label: "מצוין"
  },
  danger: {
    wrap: "border-rose-300/70 bg-rose-50 text-rose-950",
    icon: ShieldAlert,
    label: "חשוב"
  }
};

function parseBlocks(content: string): React.ReactElement[] {
  const lines = content.split("\n");
  const out: React.ReactElement[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      i++;
      continue;
    }

    // Horizontal rule.
    if (/^-{3,}$/.test(trimmed)) {
      out.push(<hr key={key++} className="my-4 border-border/60" />);
      i++;
      continue;
    }

    // ":::" fenced blocks — callouts, frame, cols.
    if (trimmed.startsWith(":::")) {
      const directive = trimmed.slice(3).trim();
      const inner: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== ":::") {
        inner.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      out.push(renderDirective(directive, inner, key++));
      continue;
    }

    // Fenced code block.
    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      out.push(
        <pre
          key={key++}
          dir="ltr"
          className="overflow-x-auto rounded-md border border-border/60 bg-muted/40 p-3 text-[12px] leading-5"
        >
          <code className="font-mono">{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Headings: longer prefix first.
    if (line.startsWith("#### ")) {
      out.push(
        <h5 key={key++} className="mt-3 text-[14px] font-semibold">
          {renderInline(line.slice(5))}
        </h5>
      );
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      out.push(
        <h4 key={key++} className="mt-4 text-[15px] font-semibold">
          {renderInline(line.slice(4))}
        </h4>
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      out.push(
        <h3
          key={key++}
          className="mt-6 border-b border-border/60 pb-1.5 text-[17px] font-semibold"
        >
          {renderInline(line.slice(3))}
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      out.push(
        <h2 key={key++} className="mt-2 text-[20px] font-bold">
          {renderInline(line.slice(2))}
        </h2>
      );
      i++;
      continue;
    }

    // Image — "![alt](src)" on its own line, optional "_caption: ..." next.
    const imgMatch = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/.exec(trimmed);
    if (imgMatch) {
      const [, alt, src] = imgMatch;
      let caption: string | null = null;
      // peek next non-blank for an optional caption
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === "") j++;
      if (j < lines.length && lines[j].trim().startsWith("_caption:")) {
        caption = lines[j].trim().slice("_caption:".length).trim();
        i = j + 1;
      } else {
        i++;
      }
      out.push(
        <figure
          key={key++}
          className="my-3 overflow-hidden rounded-lg border border-border/60 bg-muted/20 shadow-sm"
        >
          {/* Plain <img> on purpose — guides are static, dimensions vary, and
              next/image requires explicit sizes for non-public assets. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="block h-auto w-full"
            loading="lazy"
          />
          {caption && (
            <figcaption className="border-t border-border/60 bg-card px-3 py-2 text-[12px] italic text-muted-foreground">
              {renderInline(caption)}
            </figcaption>
          )}
        </figure>
      );
      continue;
    }

    // Blockquote — consume consecutive "> " lines.
    if (line.startsWith("> ") || line.startsWith(">")) {
      const quoteLines: string[] = [];
      while (
        i < lines.length &&
        (lines[i].startsWith("> ") || lines[i].startsWith(">"))
      ) {
        const stripped = lines[i].replace(/^>\s?/, "");
        quoteLines.push(stripped);
        i++;
      }
      out.push(
        <blockquote
          key={key++}
          className="border-s-4 border-border ps-3 text-foreground/70 italic"
        >
          {quoteLines.map((l, k) => (
            <React.Fragment key={k}>
              {k > 0 && <br />}
              {renderInline(l)}
            </React.Fragment>
          ))}
        </blockquote>
      );
      continue;
    }

    // Table.
    if (
      line.startsWith("|") &&
      i + 1 < lines.length &&
      /^\s*\|[\s|:-]+\|\s*$/.test(lines[i + 1])
    ) {
      const headerCells = splitTableRow(line);
      i += 2;
      const bodyRows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        bodyRows.push(splitTableRow(lines[i]));
        i++;
      }
      out.push(
        <div key={key++} className="-mx-2 overflow-x-auto md:mx-0">
          <table className="w-full min-w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {headerCells.map((cell, k) => (
                  <th
                    key={k}
                    className="px-3 py-2 text-right font-semibold"
                  >
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, r) => (
                <tr
                  key={r}
                  className="border-b border-border/40 hover:bg-muted/30"
                >
                  {row.map((cell, c) => (
                    <td key={c} className="px-3 py-2 align-top">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Numbered list — rendered as a vertical stack of step cards.
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      out.push(
        <ol key={key++} className="space-y-2">
          {items.map((item, k) => (
            <li
              key={k}
              className="flex gap-3 rounded-md border border-border/60 bg-card/60 p-2.5"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[13px] font-semibold text-primary">
                {k + 1}
              </span>
              <div className="flex-1 pt-0.5">{renderInline(item)}</div>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Bullet list.
    if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = [];
      while (
        i < lines.length &&
        (lines[i].startsWith("- ") || lines[i].startsWith("* "))
      ) {
        items.push(lines[i].slice(2));
        i++;
      }
      out.push(
        <ul key={key++} className="list-disc space-y-1 ps-6">
          {items.map((item, k) => (
            <li key={k}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Paragraph.
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("- ") &&
      !lines[i].startsWith("* ") &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith(">") &&
      !lines[i].startsWith("|") &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].trim().startsWith(":::") &&
      !/^\d+\.\s/.test(lines[i]) &&
      !/^-{3,}$/.test(lines[i].trim()) &&
      !/^!\[/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length === 0) {
      i++;
      continue;
    }
    out.push(
      <p key={key++}>
        {paraLines.map((l, k) => (
          <React.Fragment key={k}>
            {k > 0 && <br />}
            {renderInline(l)}
          </React.Fragment>
        ))}
      </p>
    );
  }

  return out;
}

function renderDirective(
  directive: string,
  inner: string[],
  key: number
): React.ReactElement {
  // Callouts: :::tip / :::info / :::warning / :::success / :::danger
  const calloutKind = directive.toLowerCase() as CalloutKind;
  if (calloutKind in CALLOUT_STYLES) {
    const style = CALLOUT_STYLES[calloutKind];
    const Icon = style.icon;
    return (
      <aside
        key={key}
        className={cn(
          "my-3 flex gap-3 rounded-md border ps-3 pe-4 py-3 text-[13.5px] leading-6",
          style.wrap
        )}
      >
        <Icon className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
        <div className="flex-1 space-y-1.5">
          <div className="text-[11.5px] font-bold uppercase tracking-wide opacity-70">
            {style.label}
          </div>
          <div className="space-y-1.5">{parseBlocks(inner.join("\n"))}</div>
        </div>
      </aside>
    );
  }

  // Frame: :::frame title="..." [tone="dashboard|table|mobile"]
  if (directive.startsWith("frame")) {
    const titleMatch = /title="([^"]+)"/.exec(directive);
    const toneMatch = /tone="([^"]+)"/.exec(directive);
    const title = titleMatch?.[1] ?? "מסך מהמערכת";
    const tone = toneMatch?.[1] ?? "dashboard";
    const isMobile = tone === "mobile";
    return (
      <div
        key={key}
        className={cn(
          "my-4 overflow-hidden rounded-xl border border-slate-300 bg-white shadow-md",
          isMobile && "mx-auto max-w-[320px]"
        )}
      >
        {/* Browser-like / phone-like title bar */}
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-3 py-1.5">
          {!isMobile && (
            <div className="flex gap-1">
              <span className="size-2.5 rounded-full bg-rose-400" />
              <span className="size-2.5 rounded-full bg-amber-400" />
              <span className="size-2.5 rounded-full bg-emerald-400" />
            </div>
          )}
          <div className="flex-1 truncate rounded-sm bg-white/80 px-2 py-0.5 text-center text-[11px] text-slate-600">
            {title}
          </div>
        </div>
        <div className="space-y-2 bg-white p-3 text-[13px] text-slate-800">
          {parseBlocks(inner.join("\n"))}
        </div>
      </div>
    );
  }

  // 2-column layout: split by "---" line.
  if (directive === "cols") {
    const splitIdx = inner.findIndex((l) => /^-{3,}$/.test(l.trim()));
    const left = splitIdx >= 0 ? inner.slice(0, splitIdx) : inner;
    const right = splitIdx >= 0 ? inner.slice(splitIdx + 1) : [];
    return (
      <div key={key} className="my-3 grid gap-3 md:grid-cols-2">
        <div className="space-y-2">{parseBlocks(left.join("\n"))}</div>
        <div className="space-y-2">{parseBlocks(right.join("\n"))}</div>
      </div>
    );
  }

  // Fallback — render as plain block.
  return (
    <div key={key} className="space-y-2">
      {parseBlocks(inner.join("\n"))}
    </div>
  );
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

// Inline grammar. <kbd>...</kbd> and {role:...} added on top of the original.
const INLINE_RE =
  /(\*\*[^*]+?\*\*|\*[^*]+?\*|`[^`]+?`|<kbd>[^<]+?<\/kbd>|\{role:(?:admin|employee|contractor|public)\}|\[[^\]]+?\]\([^)]+?\))/g;

const ROLE_CHIPS: Record<
  string,
  { label: string; classes: string }
> = {
  admin: {
    label: "מנהל",
    classes: "border-primary/40 bg-primary/10 text-primary"
  },
  employee: {
    label: "עובד",
    classes: "border-sky-300 bg-sky-50 text-sky-800"
  },
  contractor: {
    label: "קבלן",
    classes: "border-violet-300 bg-violet-50 text-violet-800"
  },
  public: {
    label: "אורח",
    classes: "border-slate-300 bg-slate-100 text-slate-700"
  }
};

function renderInline(text: string): React.ReactNode {
  const parts = text.split(INLINE_RE);
  return parts.map((part, i) => {
    if (!part) return null;
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (
      part.startsWith("*") &&
      part.endsWith("*") &&
      !part.startsWith("**") &&
      part.length > 2
    ) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={i}
          dir="ltr"
          className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[12px]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("<kbd>") && part.endsWith("</kbd>")) {
      const label = part.slice(5, -6);
      return (
        <kbd
          key={i}
          dir="ltr"
          className="mx-0.5 inline-flex items-center rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[11.5px] font-medium text-foreground shadow-[0_1px_0_0_rgba(0,0,0,0.08)]"
        >
          {label}
        </kbd>
      );
    }
    const roleMatch = /^\{role:(admin|employee|contractor|public)\}$/.exec(
      part
    );
    if (roleMatch) {
      const chip = ROLE_CHIPS[roleMatch[1]];
      return (
        <span
          key={i}
          className={cn(
            "mx-0.5 inline-flex items-center rounded-full border px-2 py-0.5 text-[11.5px] font-medium",
            chip.classes
          )}
        >
          {chip.label}
        </span>
      );
    }
    const linkMatch = /^\[([^\]]+?)\]\(([^)]+?)\)$/.exec(part);
    if (linkMatch) {
      const [, label, url] = linkMatch;
      const isExternal = /^https?:\/\//.test(url);
      return (
        <a
          key={i}
          href={url}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          className="text-sky-700 underline decoration-sky-700/40 underline-offset-2 hover:decoration-sky-700"
        >
          {label}
        </a>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}
