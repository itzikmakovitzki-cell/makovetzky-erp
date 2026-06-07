"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Paperclip,
  X
} from "lucide-react";
import {
  sendProjectGroupFile,
  sendProjectGroupMessage
} from "@/app/actions/whatsapp-groups";

// Compose dialog for the connected project WhatsApp group. Extracted from
// project-whatsapp-panel.tsx (June 2026) — the 712-line panel had grown to
// mix three independent concerns (connect wizard, compose, route toggle)
// and splitting them by file makes the call sites easier to follow.
//
// Sends either a text-only message OR a file with optional caption. 64MB
// file ceiling matches what Green API actually accepts.

export function GroupComposeDialog({
  masterDealId,
  dealName,
  groupName,
  onClose
}: {
  masterDealId: string;
  dealName: string;
  groupName: string;
  onClose: () => void;
}) {
  const [text, setText] = useState(`עדכון בנושא הפרויקט ${dealName}\n\n`);
  const [file, setFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onPickFile = (f: File | null) => {
    setError(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (f.size > 64 * 1024 * 1024) {
      setError("הקובץ גדול מ-64MB");
      return;
    }
    setFile(f);
    // Default the caption to empty (rather than the long boilerplate from
    // text-only sends) so the file stands on its own unless admin types.
    if (!text.trim() || text.trim() === `עדכון בנושא הפרויקט ${dealName}`) {
      setText("");
    }
  };

  const send = () => {
    setError(null);
    const trimmed = text.trim();
    if (!file && !trimmed) {
      setError("ההודעה ריקה — הוסף טקסט או בחר קובץ");
      return;
    }
    const proceed = window.confirm(
      file
        ? `לשלוח את הקובץ "${file.name}" לקבוצה "${groupName}"?\n\nכולם בקבוצה יקבלו אותו.`
        : `לשלוח את ההודעה לקבוצה "${groupName}"?\n\nכולם בקבוצה יקבלו אותה. ההודעה תצא מהמערכת מיד דרך Green API.`
    );
    if (!proceed) return;
    startTransition(async () => {
      let r: { ok: boolean; error?: string };
      if (file) {
        const fd = new FormData();
        fd.set("masterDealId", masterDealId);
        fd.set("caption", trimmed);
        fd.set("file", file);
        r = await sendProjectGroupFile(fd);
      } else {
        r = await sendProjectGroupMessage({ masterDealId, message: trimmed });
      }
      if (!r.ok) {
        setError(r.error ?? "שליחה נכשלה");
        return;
      }
      setSent(true);
      setTimeout(onClose, 1200);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-md border bg-card shadow-lg">
        <div className="border-b bg-muted/30 px-3 py-1.5">
          <h3 className="text-sm font-semibold">שלח לקבוצה — {groupName}</h3>
        </div>
        <div className="space-y-2 px-3 py-3">
          <p className="text-[10.5px] text-muted-foreground">
            ההודעה תישלח דרך Green API לכל חברי הקבוצה ברגע שתאשר.
            ניתן לצרף קובץ (תמונה, PDF, וידאו וכו') עד 64MB.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={file ? 3 : 6}
            placeholder={file ? "הוסף תיאור לקובץ (לא חובה)…" : "הקלד את ההודעה לקבוצה…"}
            className="w-full resize-y rounded border border-input bg-background px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            autoFocus
          />

          {/* File attachment row */}
          {file ? (
            <div className="flex items-center justify-between gap-2 rounded border border-input bg-muted/30 px-2 py-1.5 text-[11px]">
              <div className="flex min-w-0 items-center gap-1.5">
                <Paperclip className="size-3 shrink-0 text-emerald-600" />
                <span className="truncate font-medium">{file.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </div>
              <button
                type="button"
                onClick={() => onPickFile(null)}
                disabled={pending}
                title="הסר קובץ"
                className="inline-flex items-center justify-center rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-red-600 disabled:opacity-50"
              >
                <X className="size-3" />
              </button>
            </div>
          ) : (
            <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-dashed border-input bg-muted/20 px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted/40">
              <Paperclip className="size-3" />
              צרף קובץ
              <input
                type="file"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                disabled={pending}
              />
            </label>
          )}

          {error && (
            <p className="inline-flex items-center gap-1 text-[11px] text-red-700">
              <AlertTriangle className="size-3" />
              {error}
            </p>
          )}
          {sent && (
            <p className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
              <CheckCircle2 className="size-3" />
              ההודעה נשלחה לקבוצה
            </p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-3 py-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded border border-input bg-background px-3 py-1 text-[12px] hover:bg-accent disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={send}
            disabled={pending || sent}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-1 text-[12px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : sent ? (
              <CheckCircle2 className="size-3" />
            ) : file ? (
              <Paperclip className="size-3" />
            ) : (
              <MessageCircle className="size-3" />
            )}
            {file ? "📎 שלח קובץ" : "📤 שלח עכשיו"}
          </button>
        </div>
      </div>
    </div>
  );
}
