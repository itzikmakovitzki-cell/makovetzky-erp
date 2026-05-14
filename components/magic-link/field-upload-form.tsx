"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, FileText, Loader2, RefreshCcw, Upload } from "lucide-react";
import { uploadViaMagicLink } from "@/app/actions/magic-links";
import { cn, formatFileSize } from "@/lib/utils";

export function FieldUploadForm({
  token,
  taskName
}: {
  token: string;
  taskName: string;
}) {
  const [resetKey, setResetKey] = useState(0);
  return (
    <FieldUploadFormInner
      key={resetKey}
      token={token}
      taskName={taskName}
      onAnother={() => setResetKey((k) => k + 1)}
    />
  );
}

function FieldUploadFormInner({
  token,
  taskName,
  onAnother
}: {
  token: string;
  taskName: string;
  onAnother: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [state, formAction, isPending] = useActionState(uploadViaMagicLink, {
    error: null,
    ok: false
  });

  // Success screen — appears after a successful upload. The "another" button
  // bumps the resetKey on the parent which remounts this whole form, clearing
  // useActionState back to its initial value.
  if (state.ok) {
    return (
      <div className="rounded-md border bg-card p-5 text-center">
        <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
        <h2 className="mt-3 text-base font-semibold">הקובץ הועלה בהצלחה</h2>
        <p className="mt-1 text-[12px] text-muted-foreground">
          ההנהלה תקבל הודעה. תודה!
        </p>
        <button
          type="button"
          onClick={onAnother}
          className="mt-4 inline-flex items-center gap-1.5 rounded border border-input bg-background px-3 py-1.5 text-[12px] hover:bg-accent"
        >
          <RefreshCcw className="size-3" />
          העלה קובץ נוסף
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="rounded-md border bg-card p-4">
      <input type="hidden" name="token" value={token} />

      <h2 className="mb-3 text-sm font-semibold">העלאת קובץ</h2>

      <label
        className={cn(
          "flex cursor-pointer items-center gap-2 rounded border border-dashed border-input bg-background px-3 py-3 text-[13px] hover:bg-accent/50",
          file && "border-solid border-foreground/30 bg-muted/20"
        )}
      >
        <Upload className="size-4 text-muted-foreground" />
        {file ? (
          <span className="flex flex-1 items-center gap-2">
            <FileText className="size-4 text-muted-foreground" />
            <span className="font-medium">{file.name}</span>
            <span className="text-muted-foreground">{formatFileSize(file.size)}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">לחץ לבחירת קובץ מהמכשיר…</span>
        )}
        <input
          type="file"
          name="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="hidden"
        />
      </label>

      <label className="mt-3 block">
        <span className="mb-0.5 block text-[11px] font-medium">הערה (אופציונלי)</span>
        <textarea
          name="note"
          rows={2}
          placeholder="למשל: בדיקת בטון לוילה 3 — התוצאות תקינות"
          className="w-full resize-y rounded border border-input bg-background px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </label>

      {state.error && (
        <div className="mt-3 rounded border border-red-500/40 bg-red-500/10 px-2 py-1.5 text-[12px] text-red-700 dark:text-red-300">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || !file}
        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded border border-foreground bg-foreground px-3 py-2 text-[13px] font-medium text-background hover:opacity-90 disabled:opacity-40"
      >
        {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
        {isPending ? "מעלה…" : "העלה למערכת"}
      </button>

      <p className="mt-3 text-center text-[10px] text-muted-foreground">
        המשימה: {taskName}
      </p>
    </form>
  );
}
