"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserCog, X, Search, Loader2 } from "lucide-react";
import type { UserRole } from "@prisma/client";
import {
  listImpersonationCandidates,
  startImpersonating,
  type ImpersonationCandidate
} from "@/app/actions/impersonation";

// Block 43 — admin impersonation launcher.
//
// Sits to the LEFT of the scratchpad sticky-note in the bottom-right
// corner, so the existing pen-and-paper affordance keeps its place
// and the new "switch user" affordance reads as a sibling tool. Only
// rendered when the layout server-side knows the caller is ADMIN and
// isn't already impersonating — see the wiring in
// app/(dashboard)/layout.tsx for the gate.
//
// The list of candidates is fetched lazily on open (one DB hit), so
// the bundle stays light for the 95 % of dashboard renders where the
// admin never opens this dialog.

const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: "אדמין",
  EMPLOYEE: "עובד",
  CONTRACTOR: "קבלן/לקוח"
};

const ROLE_BADGE: Record<UserRole, string> = {
  ADMIN: "bg-brand-navy text-white",
  EMPLOYEE: "bg-primary text-white",
  CONTRACTOR: "bg-brand-cream text-brand-navy border border-[#E5E7EB]"
};

export function ImpersonationLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-20 right-20 z-40 print:hidden md:bottom-4 md:right-20">
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="התחבר כמשתמש אחר"
        aria-label="התחבר כמשתמש אחר"
        className="relative flex size-12 items-center justify-center rounded-full border-2 border-brand-navy bg-white text-brand-navy shadow-lg transition hover:bg-brand-cream"
      >
        <UserCog className="size-5" />
      </button>
      {open && <ImpersonationDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

function ImpersonationDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [candidates, setCandidates] = useState<ImpersonationCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [pendingTargetId, setPendingTargetId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Open the native dialog and fetch the candidate list together.
  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
    let cancelled = false;
    (async () => {
      const res = await listImpersonationCandidates();
      if (cancelled) return;
      if (res.ok && res.users) setCandidates(res.users);
      else setError(res.error || "נכשלה טעינת המשתמשים");
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    const handler = () => onClose();
    d.addEventListener("close", handler);
    return () => d.removeEventListener("close", handler);
  }, [onClose]);

  const filtered = (candidates ?? []).filter((u) => {
    const f = filter.trim().toLowerCase();
    if (!f) return true;
    return (
      u.name.toLowerCase().includes(f) || u.email.toLowerCase().includes(f)
    );
  });

  function handlePick(target: ImpersonationCandidate) {
    setError(null);
    setPendingTargetId(target.id);
    startTransition(async () => {
      const res = await startImpersonating(target.id);
      if (!res.ok) {
        setError(res.error);
        setPendingTargetId(null);
        return;
      }
      // Hard-reload so every server component re-evaluates auth() and
      // picks up the new identity. router.refresh() alone leaves
      // client components with the stale `session.user` cached.
      window.location.href = "/";
    });
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
      className="mk-dialog w-[480px] max-w-[calc(100vw-2rem)]"
    >
      <div className="flex items-center justify-between border-b-2 border-primary bg-brand-cream px-3 py-2">
        <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-navy">
          <UserCog className="size-3.5" />
          התחבר כמשתמש
        </h2>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="rounded p-0.5 text-brand-charcoal-70 hover:bg-black/5"
          aria-label="סגור"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="space-y-2 px-3 py-3">
        <p className="text-[11px] leading-relaxed text-brand-charcoal-70">
          בחר משתמש כדי לראות את המערכת כפי שהוא רואה אותה. הפעולה תעוד
          ביומן המערכת. תוכל לחזור לזהותך המקורית מתוך הבאנר שיופיע בראש המסך.
        </p>
        <label className="relative block">
          <Search className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-[#6B7280]" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="חיפוש לפי שם או אימייל…"
            className="w-full rounded border border-[#E5E7EB] bg-white px-2 py-1 pr-7 text-[13px] focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>

        {error && (
          <div className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] text-red-700">
            {error}
          </div>
        )}

        <ul className="max-h-72 space-y-1 overflow-auto">
          {candidates === null ? (
            <li className="flex items-center justify-center gap-2 py-6 text-[11px] text-[#6B7280]">
              <Loader2 className="size-3 animate-spin" />
              טוען משתמשים…
            </li>
          ) : filtered.length === 0 ? (
            <li className="rounded border border-dashed border-[#E5E7EB] bg-[#F9F9F7] py-6 text-center text-[11px] text-[#6B7280]">
              לא נמצאו משתמשים
            </li>
          ) : (
            filtered.map((u) => {
              const isLoadingThis = pendingTargetId === u.id;
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => handlePick(u)}
                    disabled={isPending}
                    className="flex w-full items-center justify-between gap-2 rounded border border-[#E5E7EB] bg-white px-2 py-1.5 text-start hover:border-brand-navy disabled:opacity-50"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[12.5px] font-medium text-brand-navy">
                        {u.name}
                      </div>
                      <div className="truncate text-[10.5px] text-[#6B7280]">
                        {u.email}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide ${ROLE_BADGE[u.role as UserRole]}`}
                      >
                        {ROLE_LABEL[u.role as UserRole]}
                      </span>
                      {isLoadingThis && (
                        <Loader2 className="size-3 animate-spin text-brand-navy" />
                      )}
                    </div>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </dialog>
  );
}
