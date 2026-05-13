import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium leading-none whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-foreground/20 bg-foreground/5 text-foreground",
        success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        warning: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        destructive: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
        info: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
        muted: "border-foreground/15 bg-foreground/5 text-muted-foreground",
        outline: "border-foreground/30 text-foreground"
      }
    },
    defaultVariants: { variant: "default" }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
