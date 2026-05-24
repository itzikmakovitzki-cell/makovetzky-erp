import * as React from "react";
import { cn } from "@/lib/utils";

// Richer Markdown renderer for the in-app Guides feature. The notes/wiki
// Markdown component at components/ui/markdown.tsx stays intentionally minimal
// (admin-authored short content); this one handles the long-form docs format
// we use for the system user guide. Still zero deps.
//
// Supported block elements:
//   - # / ## / ### / #### headings
//   - "- " or "* " bullet lists
//   - "1. " / "2. " numbered lists
//   - "> " blockquotes (consecutive lines = one quote block)
//   - "```" fenced code blocks (optional language tag, rendered as monospace pre)
//   - "---" horizontal rule (own line, three or more dashes)
//   - "| a | b |" tables — the row immediately after the header must be a
//     separator like "|---|---|"; cells are rendered with cell-by-cell inline
//     formatting. Pipes inside table content are not escaped — keep them out.
//   - paragraphs separated by blank lines
//
// Supported inline elements (in priority order, alternation inside one regex):
//   - **bold**
//   - *italic*
//   - `code`
//   - [text](url) — external links open in new tab with rel="noopener"
//
// Anything we don't recognize falls through as plain paragraph text.

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

function parseBlocks(content: string): React.ReactElement[] {
  const lines = content.split("\n");
  const out: React.ReactElement[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Blank line — skip.
    if (trimmed === "") {
      i++;
      continue;
    }

    // Horizontal rule (--- or more).
    if (/^-{3,}$/.test(trimmed)) {
      out.push(<hr key={key++} className="my-4 border-border/60" />);
      i++;
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
      // Consume the closing fence (if present).
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

    // Headings: longer prefix first so "### " wins over "## " before "# ".
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

    // Blockquote — consume consecutive "> " lines.
    if (line.startsWith("> ") || line.startsWith(">")) {
      const quoteLines: string[] = [];
      while (
        i < lines.length &&
        (lines[i].startsWith("> ") || lines[i].startsWith(">"))
      ) {
        // strip leading ">" plus optional single space
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

    // Table — detect "| ... |" with a "|---|" separator on the next line.
    if (line.startsWith("|") && i + 1 < lines.length && /^\s*\|[\s|:-]+\|\s*$/.test(lines[i + 1])) {
      const headerCells = splitTableRow(line);
      i += 2; // skip header + separator
      const bodyRows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        bodyRows.push(splitTableRow(lines[i]));
        i++;
      }
      out.push(
        <div
          key={key++}
          className="-mx-2 overflow-x-auto md:mx-0"
        >
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

    // Numbered list — consume consecutive "N. " lines.
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      out.push(
        <ol key={key++} className="list-decimal space-y-1 ps-6">
          {items.map((item, k) => (
            <li key={k}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Bullet list — "- " or "* ".
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

    // Paragraph — collect consecutive non-blank, non-special lines.
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
      !/^\d+\.\s/.test(lines[i]) &&
      !/^-{3,}$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length === 0) {
      // Defensive — shouldn't happen because we'd have matched something above.
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

function splitTableRow(line: string): string[] {
  // Strip leading/trailing pipe + whitespace, then split on "|".
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

// Inline formatting: a single regex with alternation handles **bold**, *italic*,
// `code`, and [text](url). Order in the alternation matters — bold must come
// before italic so `**x**` isn't greedily eaten by the italic pattern.
const INLINE_RE = /(\*\*[^*]+?\*\*|\*[^*]+?\*|`[^`]+?`|\[[^\]]+?\]\([^)]+?\))/g;

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
    // Link: [text](url)
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
