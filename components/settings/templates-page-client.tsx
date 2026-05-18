"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import type { TaskResponsibility } from "@prisma/client";
import { cn } from "@/lib/utils";
import { deleteTaskTemplate } from "@/app/actions/task-templates";
import {
  exportTaskTemplatesCsv,
  importTaskTemplatesCsv
} from "@/app/actions/csv";
import {
  TASK_RESPONSIBILITY_LABEL,
  TASK_RESPONSIBILITY_VARIANT
} from "@/lib/status-maps";
import { Badge } from "@/components/ui/badge";
import { CsvToolbar } from "@/components/global/csv-toolbar";
import { TemplateFormDialog } from "./template-form-dialog";
import { DependencyManager } from "./dependency-manager";

export type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  defaultDurationDays: number | null;
  orderIndex: number;
  isActive: boolean;
  taskCount: number;
  deps: { id: string; name: string }[];
  category: string | null;
  responsibility: TaskResponsibility | null;
  tags: string[];
  defaultAssignee: { id: string; name: string } | null;
};

type AssignableUser = { id: string; name: string };

export function TemplatesPageClient({
  authorities,
  buildingTypes,
  assignableUsers,
  selectedAuthorityId,
  selectedBuildingTypeId,
  templates
}: {
  authorities: { id: string; name: string }[];
  buildingTypes: { id: string; name: string }[];
  assignableUsers: AssignableUser[];
  selectedAuthorityId: string | null;
  selectedBuildingTypeId: string | null;
  templates: TemplateRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<
    | {
        kind: "create";
        authorityId: string;
        buildingTypeId: string;
      }
    | {
        kind: "update";
        id: string;
        authorityId: string;
        buildingTypeId: string;
        initial: {
          name: string;
          description: string;
          defaultDurationDays: string;
          orderIndex: string;
          category: string;
          responsibility: TaskResponsibility | "";
          tags: string;
          defaultAssigneeId: string;
        };
      }
    | null
  >(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (!value) next.delete(key);
    else next.set(key, value);
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const handleDelete = (t: TemplateRow) => {
    if (!window.confirm(`למחוק את התבנית "${t.name}"?`)) return;
    setDeletingId(t.id);
    startTransition(async () => {
      try {
        await deleteTaskTemplate(t.id);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "שגיאה");
      } finally {
        setDeletingId(null);
      }
    });
  };

  const comboSelected = !!selectedAuthorityId && !!selectedBuildingTypeId;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border bg-card px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="inline-flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              רשות
            </span>
            <select
              value={selectedAuthorityId ?? ""}
              onChange={(e) => setParam("authority", e.target.value || null)}
              className="rounded border border-input bg-background px-2 py-0.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">— בחר רשות —</option>
              {authorities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="inline-flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              סוג בניין
            </span>
            <select
              value={selectedBuildingTypeId ?? ""}
              onChange={(e) => setParam("buildingType", e.target.value || null)}
              className="rounded border border-input bg-background px-2 py-0.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">— בחר סוג —</option>
              {buildingTypes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!comboSelected ? (
        <div className="rounded-md border bg-card px-3 py-6 text-center text-xs text-muted-foreground">
          בחר רשות וסוג בניין כדי לנהל את תבניות המשימות שלהם.
        </div>
      ) : (
        <div className="rounded-md border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-3 py-1.5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              תבניות עבור הצירוף ({templates.length})
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <CsvToolbar
                entityLabel="תבניות"
                helpText="עמודות: שם תבנית, תיאור, משך ימים, סדר, פעיל, קטגוריה, אחריות, תגיות, אחראי ב״מ - אימייל"
                exportAction={() =>
                  exportTaskTemplatesCsv(
                    selectedAuthorityId!,
                    selectedBuildingTypeId!
                  )
                }
                importAction={(fd) => {
                  fd.append("authorityId", selectedAuthorityId!);
                  fd.append("buildingTypeId", selectedBuildingTypeId!);
                  return importTaskTemplatesCsv(fd);
                }}
              />
              <button
                type="button"
                onClick={() =>
                  setMode({
                    kind: "create",
                    authorityId: selectedAuthorityId!,
                    buildingTypeId: selectedBuildingTypeId!
                  })
                }
                className="inline-flex items-center gap-1 rounded border border-foreground bg-foreground px-2.5 py-1 text-[11px] font-medium text-background hover:opacity-90"
              >
                <Plus className="size-3" />
                תבנית חדשה
              </button>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th className="w-12 text-center">סדר</th>
                <th>תבנית</th>
                <th className="w-44">סיווג</th>
                <th className="w-32">אחראי ב״מ</th>
                <th className="w-20 text-center">משך</th>
                <th className="w-16 text-center">משימות</th>
                <th>תלויות</th>
                <th className="w-32">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {templates.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-xs text-muted-foreground">
                    אין תבניות לצירוף זה. הוסף את הראשונה.
                  </td>
                </tr>
              )}
              {templates.map((t) => {
                const isDeleting = deletingId === t.id && pending;
                const canDelete = t.taskCount === 0;
                // Candidates = other templates in this combo that aren't already deps and aren't self.
                const depIds = new Set(t.deps.map((d) => d.id));
                const candidates = templates
                  .filter((other) => other.id !== t.id && !depIds.has(other.id))
                  .map((other) => ({ id: other.id, name: other.name }));

                return (
                  <tr key={t.id} className="hover:bg-muted/30">
                    <td className="text-center text-[11px] tabular-nums">{t.orderIndex}</td>
                    <td>
                      <div className="font-medium">{t.name}</div>
                      {t.description && (
                        <div className="mt-0.5 text-[10px] text-muted-foreground line-clamp-1">
                          {t.description}
                        </div>
                      )}
                    </td>
                    <td>
                      <ClassificationCell
                        category={t.category}
                        responsibility={t.responsibility}
                        tags={t.tags}
                      />
                    </td>
                    <td className="text-[11px]">
                      {t.defaultAssignee ? (
                        t.defaultAssignee.name
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="text-center text-[11px] tabular-nums">
                      {t.defaultDurationDays !== null ? `${t.defaultDurationDays}י` : "—"}
                    </td>
                    <td className="text-center text-[11px] tabular-nums">{t.taskCount}</td>
                    <td>
                      <DependencyManager
                        templateId={t.id}
                        currentDeps={t.deps}
                        candidates={candidates}
                      />
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setMode({
                              kind: "update",
                              id: t.id,
                              authorityId: selectedAuthorityId!,
                              buildingTypeId: selectedBuildingTypeId!,
                              initial: {
                                name: t.name,
                                description: t.description ?? "",
                                defaultDurationDays:
                                  t.defaultDurationDays !== null
                                    ? String(t.defaultDurationDays)
                                    : "",
                                orderIndex: String(t.orderIndex),
                                category: t.category ?? "",
                                responsibility: t.responsibility ?? "",
                                tags: t.tags.join("|"),
                                defaultAssigneeId: t.defaultAssignee?.id ?? ""
                              }
                            })
                          }
                          className="inline-flex items-center gap-1 rounded border border-input px-1.5 py-0.5 text-[10px] hover:bg-accent"
                        >
                          <Pencil className="size-2.5" /> ערוך
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(t)}
                          disabled={!canDelete || isDeleting}
                          title={
                            canDelete
                              ? "מחק"
                              : `לא ניתן למחוק — ${t.taskCount} משימות נוצרו מהתבנית`
                          }
                          className={cn(
                            "inline-flex items-center gap-1 rounded border border-red-500/50 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-800 hover:bg-red-500/20 dark:text-red-300",
                            (!canDelete || isDeleting) && "cursor-not-allowed opacity-50"
                          )}
                        >
                          {isDeleting ? (
                            <Loader2 className="size-2.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-2.5" />
                          )}
                          מחק
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {mode && (
        <TemplateFormDialog
          key={mode.kind === "update" ? `edit-${mode.id}` : "create"}
          mode={mode}
          assignableUsers={assignableUsers}
          onClose={() => setMode(null)}
        />
      )}
    </div>
  );
}

function ClassificationCell({
  category,
  responsibility,
  tags
}: {
  category: string | null;
  responsibility: TaskResponsibility | null;
  tags: string[];
}) {
  if (!category && !responsibility && tags.length === 0) {
    return <span className="text-[10px] text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-col gap-0.5">
      {category && <span className="text-[10px] text-muted-foreground">{category}</span>}
      {responsibility && (
        <Badge variant={TASK_RESPONSIBILITY_VARIANT[responsibility]}>
          {TASK_RESPONSIBILITY_LABEL[responsibility]}
        </Badge>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-0.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-muted px-1 py-0 text-[9px] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
