import Link from "next/link";
import { Building2, ListChecks } from "lucide-react";
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
      className="block transition-colors active:bg-muted/40"
      aria-label={project.name}
    >
      <Card>
        <CardHeader>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium leading-snug text-foreground line-clamp-2">
              {project.name}
            </h3>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {project.clientName}
            </p>
          </div>
          <Badge variant={MASTER_DEAL_STATUS_VARIANT[project.status]}>
            {MASTER_DEAL_STATUS_LABEL[project.status]}
          </Badge>
        </CardHeader>

        <CardContent>
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  project.progressPercent === 100 ? "bg-emerald-600" : "bg-emerald-500"
                )}
                style={{ width: `${project.progressPercent}%` }}
              />
            </div>
            <span className="w-10 text-end text-[11px] font-medium tabular-nums text-foreground">
              {project.progressPercent}%
            </span>
          </div>
          <div className="text-[11px] tabular-nums text-muted-foreground">
            {project.completedTasks}/{project.totalTasks} משימות הושלמו
          </div>
        </CardContent>

        <CardFooter>
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
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {project.contractDate
              ? `חוזה: ${formatDate(project.contractDate)}`
              : `נוצר: ${formatDate(project.createdAt)}`}
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}
