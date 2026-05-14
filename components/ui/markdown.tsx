import * as React from "react";
import { cn } from "@/lib/utils";

// Minimal Markdown renderer — supports the subset we actually use in
// AuthorityWikiEntry, Notes, and similar admin-authored content:
//   - ## / ### headings
//   - "- " or "* " bullet lists
//   - **bold**, *italic*
//   - paragraphs separated by blank lines
//   - soft line breaks within a paragraph via <br>
//
// No links, code blocks, or tables. If the wiki use case outgrows this,
// swap in react-markdown — the consumer API stays the same.

export function Markdown({
  content,
  className
}: {
  content: string;
  className?: string;
}) {
  const blocks = parseBlocks(content);
  return (
    <div className={cn("space-y-2 text-[13px] leading-relaxed", className)}>
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

    if (line.startsWith("### ")) {
      out.push(
        <h4 key={key++} className="text-[14px] font-semibold">
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
          className="border-b border-border/60 pb-1 text-[15px] font-semibold"
        >
          {renderInline(line.slice(3))}
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      out.push(
        <h3 key={key++} className="text-base font-semibold">
          {renderInline(line.slice(2))}
        </h3>
      );
      i++;
      continue;
    }

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
        <ul key={key++} className="list-disc space-y-0.5 ps-5">
          {items.map((item, k) => (
            <li key={k}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph — collect consecutive non-blank, non-special lines.
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("- ") &&
      !lines[i].startsWith("* ") &&
      !lines[i].startsWith("#")
    ) {
      paraLines.push(lines[i]);
      i++;
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

function renderInline(text: string): React.ReactNode {
  // Alternation order matters: **bold** is tried before *italic*, so the
  // bold pattern wins on `**hello**` and `*italic*` only matches single
  // asterisks.
  const parts = text.split(/(\*\*[^*]+?\*\*|\*[^*]+?\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}
