import Link from "next/link";
import { cn } from "@/lib/utils";
import { projectColor } from "@/lib/project-color";

/**
 * Color-coded, clickable project (permit) tag. The color is derived from the
 * permit id so it stays consistent everywhere the project appears. Works in
 * both server and client components (no hooks).
 */
export function ProjectTag({
  permitId,
  name,
  href,
  title,
  className
}: {
  permitId: string;
  name: string;
  /** Defaults to the permit's task board. */
  href?: string;
  title?: string;
  className?: string;
}) {
  const color = projectColor(permitId);
  return (
    <Link
      href={href ?? `/permits/${permitId}/tasks`}
      title={title ?? name}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-tight transition hover:brightness-95",
        color.badge,
        className
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", color.dot)} aria-hidden />
      <span className="truncate">{name}</span>
    </Link>
  );
}
