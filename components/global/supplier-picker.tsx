"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Truck } from "lucide-react";
import { cn } from "@/lib/utils";

export function SupplierPicker({
  suppliers,
  currentSupplierId
}: {
  suppliers: { id: string; name: string; type: string | null }[];
  currentSupplierId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onPick = (value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (!value) next.delete("supplier");
    else next.set("supplier", value);
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const onToggleAll = (showAll: boolean) => {
    const next = new URLSearchParams(searchParams.toString());
    if (showAll) next.set("all", "true");
    else next.delete("all");
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const showingAll = searchParams.get("all") === "true";

  return (
    <div className="rounded-md border bg-card">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
        <div className="inline-flex items-center gap-2">
          <Truck className="size-4 text-muted-foreground" />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            ספק
          </span>
          <select
            value={currentSupplierId ?? ""}
            onChange={(e) => onPick(e.target.value)}
            className="rounded border border-input bg-background px-2 py-0.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">— בחר ספק —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.type ? ` (${s.type})` : ""}
              </option>
            ))}
          </select>
        </div>

        {currentSupplierId && (
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px]">
            <input
              type="checkbox"
              checked={showingAll}
              onChange={(e) => onToggleAll(e.target.checked)}
              className="size-3.5"
            />
            הצג גם משימות סגורות
          </label>
        )}
      </div>
    </div>
  );
}
