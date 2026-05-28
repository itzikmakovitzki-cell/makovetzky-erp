import { cn } from "@/lib/utils";
import { projectColor } from "@/lib/project-color";

// Compact initials avatar. Color is derived from the name so each person keeps
// a stable hue. Falls back to a neutral "—" chip when unassigned.
export function AssigneeAvatar({
  name,
  className
}: {
  name: string | null;
  className?: string;
}) {
  if (!name) {
    return (
      <span
        className={cn(
          "inline-flex size-5 items-center justify-center rounded-full border border-dashed border-input text-[9px] text-muted-foreground",
          className
        )}
        title="לא משויך"
      >
        —
      </span>
    );
  }
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  const color = projectColor(name);
  return (
    <span
      title={name}
      className={cn(
        "inline-flex size-5 items-center justify-center rounded-full text-[9px] font-semibold text-white",
        color.dot,
        className
      )}
    >
      {initials}
    </span>
  );
}
