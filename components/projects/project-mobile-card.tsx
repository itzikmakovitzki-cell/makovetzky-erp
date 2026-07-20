import Link from "next/link";
import { ArrowLeft, Building2, ListChecks } from "lucide-react";
import type { MasterDealStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { MASTER_DEAL_STATUS_LABEL, MASTER_DEAL_STATUS_VARIANT } from "@/lib/status-maps";
import { cn, formatDate } from "@/lib/utils";

export type ProjectMobileCardData = {
  id: string;
  name: string;
  status: MasterDealStatus;
  clientId: string;
  clientName: string;
  contractDate: Date | null;
  createdAt: Date;
  totalPermits: number;
  activePermits: number;
  totalTasks: number;
  completedTasks: number;
  progressPercent: number;
};

export function ProjectMobileCard({ project }: { project: ProjectMobileCardData }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group block cursor-pointer rounded-2xl transition-transform duration-200 md:hover:-translate-y-0.5"
      aria-label={project.name}
    >
      <Card className="h-full overflow-hidden rounded-2xl border-white/80 bg-white/95 shadow-[0_8px_28px_rgba(31,41,55,0.07)] transition-shadow duration-200 group-hover:shadow-[0_14px_36px_rgba(31,41,55,0.12)]">
        <div aria-hidden className="h-1 bg-gradient-to-l from-primary via-brand-orange-light to-brand-cream" />
        <CardHeader className="p-4 pb-3">
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-base font-extrabold leading-snug text-brand-navy">
              {project.name}
            </h3>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {project.clientName}
            </p>
          </div>
          <Badge variant={MASTER_DEAL_STATUS_VARIANT[project.status]}>
            {MASTER_DEAL_STATUS_LABEL[project.status]}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-2 px-4 pb-4">
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  project.progressPercent === 100 ? "bg-emerald-600" : "bg-emerald-500"
                )}
                style={{ width: `${project.progressPercent}%` }}
              />
            </div>
            <span className="w-11 text-end text-sm font-extrabold tabular-nums text-brand-navy">
              {project.progressPercent}%
            </span>
          </div>
          <div className="text-xs tabular-nums text-muted-foreground">
            {project.completedTasks}/{project.totalTasks} משימות הושלמו
          </div>
        </CardContent>

        <CardFooter className="min-h-12 bg-[#fbfaf7] px-4 py-3">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Building2 className="size-3" />
              <span className="tabular-nums">{project.activePermits}</span>
              <span>פעילים</span>
              {project.totalPermits > project.activePermits && (
                <span className="text-muted-foreground/70">
                  / {project.totalPermits}
                </span>
              )}
            </span>
            <span className="inline-flex items-center gap-1">
              <ListChecks className="size-3" />
              <span className="tabular-nums">{project.totalTasks}</span>
            </span>
          </div>
          <span className="inline-flex items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
            {project.contractDate ? `חוזה: ${formatDate(project.contractDate)}` : `נוצר: ${formatDate(project.createdAt)}`}
            <ArrowLeft className="size-3.5 text-primary transition-transform duration-200 group-hover:-translate-x-1" />
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}
