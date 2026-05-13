"use client";

import { useState, useTransition } from "react";
import { Lock, Plus, X, Loader2 } from "lucide-react";
import {
  addTemplateDependency,
  removeTemplateDependency
} from "@/app/actions/task-templates";
import { cn } from "@/lib/utils";

type Dep = { id: string; name: string };
type Candidate = { id: string; name: string };

export function DependencyManager({
  templateId,
  currentDeps,
  candidates
}: {
  templateId: string;
  currentDeps: Dep[];
  candidates: Candidate[];
}) {
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState("");
  const [pending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleAdd = () => {
    if (!selected) return;
    startTransition(async () => {
      try {
        await addTemplateDependency(templateId, selected);
        setSelected("");
        setAdding(false);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "שגיאה");
      }
    });
  };

  const handleRemove = (depId: string) => {
    setRemovingId(depId);
    startTransition(async () => {
      try {
        await removeTemplateDependency(templateId, depId);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "שגיאה");
      } finally {
        setRemovingId(null);
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
        <Lock className="size-3" />
        תלוי ב:
      </span>
      {currentDeps.length === 0 && !adding && (
        <span className="text-[10px] text-muted-foreground/70">—</span>
      )}
      {currentDeps.map((d) => {
        const isRemoving = removingId === d.id && pending;
        return (
          <span
            key={d.id}
            className={cn(
              "inline-flex items-center gap-0.5 rounded border border-zinc-300 bg-muted/40 ps-1.5 pe-0.5 text-[10px]",
              isRemoving && "opacity-50"
            )}
          >
            <span>{d.name}</span>
            <button
              type="button"
              onClick={() => handleRemove(d.id)}
              disabled={isRemoving}
              className="ms-0.5 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              title="הסר תלות"
            >
              {isRemoving ? (
                <Loader2 className="size-2.5 animate-spin" />
              ) : (
                <X className="size-2.5" />
              )}
            </button>
          </span>
        );
      })}

      {adding ? (
        <span className="inline-flex items-center gap-1">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={pending}
            className="rounded border border-input bg-background px-1.5 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">בחר תבנית…</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!selected || pending}
            className="inline-flex items-center gap-0.5 rounded border border-foreground bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background hover:opacity-90 disabled:opacity-40"
          >
            {pending ? <Loader2 className="size-2.5 animate-spin" /> : null}
            הוסף
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setSelected("");
            }}
            disabled={pending}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="בטל"
          >
            <X className="size-2.5" />
          </button>
        </span>
      ) : (
        candidates.length > 0 && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-0.5 rounded border border-dashed border-input px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus className="size-2.5" />
            הוסף תלות
          </button>
        )
      )}
    </div>
  );
}
