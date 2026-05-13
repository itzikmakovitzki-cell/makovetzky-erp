import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <header>
        <h1 className="text-base font-semibold">הגדרות</h1>
        <p className="text-[11px] text-muted-foreground">
          ניהול נתוני יסוד. גישה ל-ADMIN בלבד.
        </p>
      </header>
      <SettingsNav />
      <div>{children}</div>
    </div>
  );
}
