"use client";

import {
  exportPermitTasksCsv,
  importPermitTasksCsv
} from "@/app/actions/csv";
import { CsvToolbar } from "@/components/global/csv-toolbar";

// Thin wrapper that injects the permitId into the import FormData and the
// export args. Lives in client-land because TasksTable (server) can pass
// only serializable props.
export function PermitTasksCsvToolbar({
  permitId,
  canImport
}: {
  permitId: string;
  canImport: boolean;
}) {
  return (
    <CsvToolbar
      entityLabel="משימות"
      helpText="עמודות: שם המשימה, תיאור, סטטוס, עדיפות, תאריך יעד, אחראי-אימייל"
      canImport={canImport}
      exportAction={() => exportPermitTasksCsv(permitId)}
      importAction={(fd) => {
        fd.append("permitId", permitId);
        return importPermitTasksCsv(fd);
      }}
    />
  );
}
