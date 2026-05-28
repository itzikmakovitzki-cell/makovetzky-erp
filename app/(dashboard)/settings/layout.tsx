import { SettingsNav } from "@/components/settings/settings-nav";
import { PageHeader } from "@/components/global/page-header";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="הגדרות"
        description="ניהול נתוני יסוד. גישה ל-ADMIN בלבד."
      />
      <SettingsNav />
      <div>{children}</div>
    </div>
  );
}
