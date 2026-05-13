import { Pin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { NewNoteForm } from "@/components/permit/new-note-form";
import { PinToggle } from "@/components/permit/pin-toggle";
import { cn, formatDateTime } from "@/lib/utils";

export async function NotesTab({ permitId }: { permitId: string }) {
  const notes = await prisma.note.findMany({
    where: { permitId },
    include: { author: { select: { id: true, name: true } } },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }]
  });

  const pinnedCount = notes.filter((n) => n.isPinned).length;

  return (
    <div className="flex flex-col gap-3">
      <NewNoteForm permitId={permitId} />

      <div className="rounded-md border bg-card">
        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            הערות ({notes.length})
          </h2>
          {pinnedCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Pin className="size-3 fill-amber-500 text-amber-600" />
              {pinnedCount} מוצמדות
            </span>
          )}
        </div>

        {notes.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            אין הערות עדיין. הוסף את הראשונה למעלה.
          </div>
        ) : (
          <ul className="divide-y">
            {notes.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

type NoteWithAuthor = {
  id: string;
  content: string;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; name: string } | null;
};

function NoteCard({ note }: { note: NoteWithAuthor }) {
  return (
    <li
      className={cn(
        "flex items-start gap-2 border-s-[3px] px-3 py-2.5",
        note.isPinned ? "border-s-amber-500 bg-amber-50/40 dark:bg-amber-500/5" : "border-s-transparent"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          {note.isPinned && (
            <Pin className="size-3 fill-amber-500 text-amber-600" aria-label="הערה מוצמדת" />
          )}
          <span className="font-medium text-foreground">{note.author?.name ?? "—"}</span>
          <span aria-hidden>·</span>
          <span>{formatDateTime(note.createdAt)}</span>
          {note.updatedAt.getTime() !== note.createdAt.getTime() && (
            <span className="italic">(נערך)</span>
          )}
        </div>
        <NoteContent content={note.content} />
      </div>
      <PinToggle noteId={note.id} isPinned={note.isPinned} />
    </li>
  );
}

// Minimal inline Markdown: **bold** + preserves newlines via whitespace-pre-wrap.
function NoteContent({ content }: { content: string }) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return (
    <div className="whitespace-pre-wrap text-[13px] leading-relaxed">
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
}
