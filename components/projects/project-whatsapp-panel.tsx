"use client";

import { useEffect, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  Link2Off,
  Loader2,
  MessageCircle,
  ShieldOff,
  Unplug
} from "lucide-react";
import type { WhatsAppDefaultRoute } from "@prisma/client";
import {
  checkGreenApiConfiguredForGroups,
  disconnectGroupFromProject,
  setGroupCaptureAllFiles,
  setProjectWhatsAppDefaultRoute,
  type OrphanGroup
} from "@/app/actions/whatsapp-groups";
import { cn, formatDate } from "@/lib/utils";
import { GroupComposeDialog } from "./project-whatsapp-compose-dialog";
import { ConnectGroupWizard } from "./project-whatsapp-connect-wizard";

// Spec: docs/spec-whatsapp-groups.md §6 (PR-2).
// Section A — connection status + connect wizard listing orphan groups
// Section B — compose dialog to send to the connected group
// Section C (timeline) is deferred to PR-3.

type ConnectedGroup = {
  id: string;
  groupChatId: string;
  groupName: string | null;
  connectedAt: Date;
  isActive: boolean;
  connectedByName: string | null;
  captureAllFiles: boolean;
};

export function ProjectWhatsAppPanel({
  masterDealId,
  dealName,
  defaultRoute,
  connectedGroup,
  orphanGroups,
  clientNotificationPreference
}: {
  masterDealId: string;
  dealName: string;
  defaultRoute: WhatsAppDefaultRoute;
  connectedGroup: ConnectedGroup | null;
  orphanGroups: OrphanGroup[];
  clientNotificationPreference: "OFF" | "MANUAL_ONLY";
}) {
  const [route, setRoute] = useState<WhatsAppDefaultRoute>(defaultRoute);
  const [savingRoute, startRouteSave] = useTransition();
  const [routeError, setRouteError] = useState<string | null>(null);
  // Block 22: per-group capture-all toggle. Mirrors the connected group's flag.
  const [captureAll, setCaptureAll] = useState<boolean>(
    connectedGroup?.captureAllFiles ?? false
  );
  const [savingCapture, startCaptureSave] = useTransition();
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [greenApiConfigured, setGreenApiConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    void checkGreenApiConfiguredForGroups().then((r) => {
      if (alive) setGreenApiConfigured(r.configured);
    });
    return () => {
      alive = false;
    };
  }, []);

  const toggleCaptureAll = (next: boolean) => {
    if (next === captureAll) return;
    setCaptureError(null);
    setCaptureAll(next);
    startCaptureSave(async () => {
      const r = await setGroupCaptureAllFiles({
        masterDealId,
        captureAllFiles: next
      });
      if (!r.ok) {
        setCaptureAll(!next);
        setCaptureError(r.error);
      }
    });
  };

  const changeRoute = (next: WhatsAppDefaultRoute) => {
    if (next === route) return;
    setRouteError(null);
    setRoute(next);
    startRouteSave(async () => {
      const r = await setProjectWhatsAppDefaultRoute({
        masterDealId,
        route: next
      });
      if (!r.ok) {
        setRoute(defaultRoute);
        setRouteError(r.error);
      }
    });
  };

  const sendDisabledReason = (() => {
    if (route === "NONE") return "תקשורת WhatsApp כבויה לפרויקט הזה";
    if (route === "CLIENT_DIRECT") {
      return "ברירת המחדל לפרויקט = שליחה ישירה ללקוח. השתמש בפאנל בפרופיל הלקוח.";
    }
    if (!connectedGroup) return "לא מחוברת קבוצה לפרויקט";
    if (!connectedGroup.isActive) return "הקבוצה המשויכת לא פעילה";
    return null;
  })();

  return (
    <div className="flex flex-col gap-3">
      {/* Section A — connection status */}
      <div className="rounded-md border bg-card">
        <div className="border-b bg-muted/30 px-3 py-1.5">
          <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Link2 className="size-3.5 text-emerald-600" />
            סטטוס חיבור — קבוצת הפרויקט
          </h2>
        </div>
        <div className="space-y-3 px-3 py-2">
          {connectedGroup ? (
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-0.5 text-[11px]">
                <div className="font-medium">
                  <span className="text-muted-foreground">מחובר לקבוצה: </span>
                  {connectedGroup.groupName ?? "(ללא שם)"}
                </div>
                <div className="text-muted-foreground" dir="ltr">
                  {connectedGroup.groupChatId}
                </div>
                <div className="text-muted-foreground">
                  מחובר מאז: {formatDate(connectedGroup.connectedAt)}
                  {connectedGroup.connectedByName && (
                    <> ע&quot;י {connectedGroup.connectedByName}</>
                  )}
                </div>
                {!connectedGroup.isActive && (
                  <div className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                    <AlertTriangle className="size-3" />
                    הקבוצה לא פעילה
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setWizardOpen(true)}
                  className="inline-flex items-center gap-1 rounded border border-input bg-card px-2 py-1 text-[11px] hover:bg-accent"
                >
                  <Link2 className="size-3" />
                  חבר קבוצה אחרת
                </button>
                <DisconnectButton masterDealId={masterDealId} />
              </div>
              {/* Block 22 — capture-all toggle. Full-width row below the
                  connection summary so it's prominent but doesn't crowd
                  the action buttons. */}
              <div className="mt-2 w-full rounded border border-input bg-muted/30 p-2 text-[11px]">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={captureAll}
                    onChange={(e) => toggleCaptureAll(e.target.checked)}
                    disabled={savingCapture || !connectedGroup.isActive}
                    className="mt-0.5 accent-foreground"
                  />
                  <div className="flex-1">
                    <div className="font-medium">
                      תפוס את כל הקבצים בקבוצה
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      כשהאפשרות פעילה, כל קובץ או הודעה בקבוצה נכנסים לתיבת
                      הנכנסים — בלי צורך לתייג את המערכת (@system) או להגיב
                      להודעה שלנו. ברירת המחדל: כבוי.
                    </div>
                    {savingCapture && (
                      <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Loader2 className="size-2.5 animate-spin" />
                        שומר...
                      </div>
                    )}
                    {captureError && (
                      <div className="mt-0.5 text-[10px] text-red-600">
                        {captureError}
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                <Link2Off className="size-3.5" />
                לא מחוברת קבוצה לפרויקט הזה
              </div>
              <p className="text-[10.5px] text-muted-foreground">
                כדי לחבר: הוסף את מספר ה-WhatsApp של המערכת לקבוצה הקיימת של
                הפרויקט, ושלח שם הודעה שמתייגת את המספר. הקבוצה תופיע ברשימה
                למטה ותוכל לבחור אותה.
              </p>
              <button
                type="button"
                onClick={() => setWizardOpen(true)}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-[12px] font-medium text-white hover:bg-emerald-700"
              >
                <Link2 className="size-3.5" />
                חבר קבוצה
              </button>
            </div>
          )}

          {/* Route preference */}
          <div className="space-y-1 border-t pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium">יעד שליחה ברירת מחדל:</span>
              <div
                role="radiogroup"
                className="inline-flex items-center rounded-md border border-input bg-background p-0.5"
              >
                <RoutePill
                  label="📣 קבוצה"
                  active={route === "GROUP"}
                  onClick={() => changeRoute("GROUP")}
                  disabled={savingRoute}
                />
                <RoutePill
                  label="👤 ללקוח"
                  active={route === "CLIENT_DIRECT"}
                  onClick={() => changeRoute("CLIENT_DIRECT")}
                  disabled={savingRoute}
                />
                <RoutePill
                  label="🔕 כבוי"
                  active={route === "NONE"}
                  onClick={() => changeRoute("NONE")}
                  disabled={savingRoute}
                />
              </div>
              {savingRoute && (
                <Loader2 className="size-3 animate-spin text-muted-foreground" />
              )}
            </div>
            {routeError && (
              <p className="inline-flex items-center gap-1 text-[10px] text-red-700">
                <AlertTriangle className="size-3" />
                {routeError}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Section B — outbound send */}
      <div className="rounded-md border bg-card">
        <div className="border-b bg-muted/30 px-3 py-1.5">
          <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <MessageCircle className="size-3.5 text-emerald-600" />
            שליחה לקבוצה
          </h2>
        </div>
        <div className="space-y-2 px-3 py-2">
          {route === "NONE" ? (
            <div className="inline-flex items-center gap-1.5 rounded border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] text-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-300">
              <ShieldOff className="size-3" />
              תקשורת WhatsApp כבויה לפרויקט הזה
            </div>
          ) : (
            <>
              <p className="text-[10.5px] text-muted-foreground">
                הכפתור שולח דרך Green API לקבוצה {connectedGroup?.groupName ?? "—"}. כולם בקבוצה יראו את ההודעה. לוחץ ידנית, אין שליחה אוטומטית.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setComposeOpen(true)}
                  disabled={sendDisabledReason !== null}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
                    sendDisabledReason
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                  )}
                >
                  <MessageCircle className="size-3.5" />
                  📤 שלח לקבוצה
                </button>
                {sendDisabledReason && (
                  <span className="text-[10px] text-amber-700">
                    {sendDisabledReason}
                  </span>
                )}
              </div>
              {/* Secondary action — only when the client allows manual sends */}
              {route === "GROUP" &&
                clientNotificationPreference === "MANUAL_ONLY" && (
                  <p className="text-[10px] text-muted-foreground">
                    רוצה לשלוח ללקוח בלבד? פתח את פרופיל הלקוח והשתמש בפאנל
                    שם — המסלול הפרטי שמור למקרים נדירים.
                  </p>
                )}
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]",
                  greenApiConfigured === true &&
                    "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300",
                  greenApiConfigured === false &&
                    "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
                  greenApiConfigured === null &&
                    "border-input text-muted-foreground"
                )}
              >
                {greenApiConfigured === true && <CheckCircle2 className="size-3" />}
                {greenApiConfigured === false && <AlertTriangle className="size-3" />}
                {greenApiConfigured === true
                  ? "Green API: מוגדר — שליחה ישירה דרך השרת"
                  : greenApiConfigured === false
                    ? "Green API: לא מוגדר — שליחה לקבוצה לא תעבוד עד שיוגדר"
                    : "בודק תצורת Green API…"}
              </span>
            </>
          )}
        </div>
      </div>

      {composeOpen && connectedGroup && (
        <GroupComposeDialog
          masterDealId={masterDealId}
          dealName={dealName}
          groupName={connectedGroup.groupName ?? connectedGroup.groupChatId}
          onClose={() => setComposeOpen(false)}
        />
      )}
      {wizardOpen && (
        <ConnectGroupWizard
          masterDealId={masterDealId}
          dealName={dealName}
          orphans={orphanGroups}
          onClose={() => setWizardOpen(false)}
        />
      )}
    </div>
  );
}

function RoutePill({
  label,
  active,
  onClick,
  disabled
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded px-2 py-0.5 text-[11px] transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
        disabled && "opacity-60"
      )}
    >
      {label}
    </button>
  );
}

function DisconnectButton({ masterDealId }: { masterDealId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    const proceed = window.confirm(
      "לנתק את הקבוצה מהפרויקט?\n\nהקבוצה עצמה תישאר במערכת (לא נאבדת היסטוריה), אבל הכפתור 'שלח לקבוצה' יהפוך לא פעיל עד שתחבר קבוצה אחרת."
    );
    if (!proceed) return;
    setError(null);
    startTransition(async () => {
      const r = await disconnectGroupFromProject({ masterDealId });
      if (!r.ok) setError(r.error);
    });
  };

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
      >
        {pending ? <Loader2 className="size-3 animate-spin" /> : <Unplug className="size-3" />}
        בטל חיבור
      </button>
      {error && (
        <span className="text-[10px] text-red-700">{error}</span>
      )}
    </div>
  );
}

