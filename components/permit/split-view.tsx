"use client";

import { useState, type ReactNode } from "react";
import { Wallet, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Panel = "none" | "finance" | "documents";

export function SplitView({
  finance,
  documents,
  children
}: {
  finance: ReactNode;
  documents: ReactNode;
  children: ReactNode;
}) {
  const [panel, setPanel] = useState<Panel>("none");

  const toggle = (target: Exclude<Panel, "none">) =>
    setPanel((prev) => (prev === target ? "none" : target));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => toggle("finance")}
          className={cn(
            "inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] transition-colors",
            panel === "finance"
              ? "border-foreground bg-foreground text-background"
              : "border-input bg-background hover:bg-accent"
          )}
        >
          <Wallet className="size-3" /> כספים
        </button>
        <button
          type="button"
          onClick={() => toggle("documents")}
          className={cn(
            "inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] transition-colors",
            panel === "documents"
              ? "border-foreground bg-foreground text-background"
              : "border-input bg-background hover:bg-accent"
          )}
        >
          <FileText className="size-3" /> מסמכים
        </button>
      </div>

      <div className={cn("grid gap-3", panel === "none" ? "grid-cols-1" : "grid-cols-[1fr_320px]")}>
        <main className="min-w-0">{children}</main>
        {panel !== "none" && (
          <aside className="rounded-md border bg-card">
            <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
              <h3 className="text-xs font-semibold">
                {panel === "finance" ? "סיכום כספי" : "מסמכים אחרונים"}
              </h3>
              <button
                type="button"
                onClick={() => setPanel("none")}
                className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="סגור"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="p-2">{panel === "finance" ? finance : documents}</div>
          </aside>
        )}
      </div>
    </div>
  );
}
