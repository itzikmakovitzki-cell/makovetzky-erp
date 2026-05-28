import { taskEmoji } from "@/lib/task-emoji";

// Renders a task name, prefixed with a category emoji when the name carries a
// recognized bracketed authority tag (Block 25). Returns an inline fragment so
// callers keep their own wrapping element + styling (e.g. line-through).
export function TaskTitle({ name }: { name: string }) {
  const emoji = taskEmoji(name);
  return (
    <>
      {emoji && (
        <span aria-hidden className="me-1">
          {emoji}
        </span>
      )}
      {name}
    </>
  );
}
