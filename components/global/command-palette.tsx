"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Search,
  Loader2,
  Building2,
  FileText,
  FolderKanban,
  CornerDownLeft
} from "lucide-react";
import { globalSearch, type SearchResult } from "@/app/actions/search";
import { cn } from "@/lib/utils";

const TYPE_META: Record<
  SearchResult["type"],
  { label: string; icon: typeof Building2 }
> = {
  client: { label: "לקוח", icon: Building2 },
  permit: { label: "היתר", icon: FileText },
  project: { label: "פרויקט", icon: FolderKanban }
};

// Global ⌘K / Ctrl+K command palette. In-house (no cmdk dependency) to match
// the project's no-deps primitives. Opens on the hotkey or an `open-command-palette`
// window event (dispatched by the sidebar/mobile triggers). Navigates to the
// chosen client / permit / project.
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [active, setActive] = React.useState(0);
  const [mounted, setMounted] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => setMounted(true), []);

  const close = React.useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setActive(0);
  }, []);

  // Hotkey + custom open event.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpen);
    };
  }, []);

  // Focus the input when the palette opens.
  React.useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Debounced search.
  React.useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setActive(0);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        try {
          const res = await globalSearch(q);
          setResults(res);
          setActive(0);
        } catch {
          setResults([]);
        }
      });
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  const go = React.useCallback(
    (r: SearchResult) => {
      close();
      router.push(r.href);
    },
    [close, router]
  );

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[active];
      if (r) go(r);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  if (!mounted || !open) return null;

  const q = query.trim();

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="חיפוש מהיר"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={close}
        aria-hidden
      />
      <div
        dir="rtl"
        className="relative w-full max-w-xl overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b px-3">
          {pending ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <Search className="size-4 shrink-0 text-muted-foreground" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="חיפוש לקוח, היתר או פרויקט…"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="שדה חיפוש מהיר"
          />
          <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
            ESC
          </kbd>
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-1">
          {q.length < 2 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              הקלד לפחות 2 תווים לחיפוש לקוחות, היתרים ופרויקטים
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              {pending ? "מחפש…" : "לא נמצאו תוצאות"}
            </p>
          ) : (
            results.map((r, i) => {
              const meta = TYPE_META[r.type];
              const Icon = meta.icon;
              return (
                <button
                  key={`${r.type}-${r.id}`}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(r)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-start text-sm",
                    i === active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
                  )}
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{r.label}</span>
                    {r.sublabel && (
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {r.sublabel}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {meta.label}
                  </span>
                  {i === active && (
                    <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
