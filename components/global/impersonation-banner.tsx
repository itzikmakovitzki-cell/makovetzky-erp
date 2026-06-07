"use client";

import { useTransition } from "react";
import { Eye, ArrowLeft, Loader2 } from "lucide-react";
import { stopImpersonating } from "@/app/actions/impersonation";

// Block 43 — sticky banner shown whenever the current session is being
// impersonated by an ADMIN. Renders the impersonated user's name + the
// admin's name + a "back to myself" button. Wired into the dashboard
// layout only when `session.impersonating` is set server-side.

export function ImpersonationBanner({
  impersonatedName,
  impersonatedRole,
  originalName
}: {
  impersonatedName: string;
  impersonatedRole: string;
  originalName: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleStop() {
    startTransition(async () => {
      await stopImpersonating();
      // Hard reload so every server component re-evaluates auth().
      window.location.href = "/";
    });
  }

  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#1F2937] bg-[#E25822] px-3 py-1.5 text-white shadow-md print:hidden"
    >
      <div className="flex min-w-0 items-center gap-1.5 text-[12px]">
        <Eye className="size-3.5 shrink-0" />
        <span className="font-semibold">מצב התחזות:</span>
        <span className="truncate">
          מציג כ-<strong>{impersonatedName}</strong> ({impersonatedRole}) ·
          <span className="opacity-80"> מקור: {originalName}</span>
        </span>
      </div>
      <button
        type="button"
        onClick={handleStop}
        disabled={isPending}
        className="inline-flex shrink-0 items-center gap-1 rounded border border-white bg-white/10 px-2.5 py-0.5 text-[11.5px] font-semibold text-white hover:bg-white/20 disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <ArrowLeft className="size-3" />
        )}
        חזור לעצמי
      </button>
    </div>
  );
}
