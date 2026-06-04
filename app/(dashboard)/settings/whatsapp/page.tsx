import Link from "next/link";
import { CheckCircle2, XCircle, AlertCircle, Link2, Link2Off } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { isWhatsAppConfigured, getWhatsAppConfig } from "@/lib/whatsapp";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function WhatsAppSettingsPage() {
  const cloudConfigured = isWhatsAppConfigured();
  const { displayPhoneNumber, phoneNumberId, appSecret } = getWhatsAppConfig();
  const webhookSecret = process.env.WHATSAPP_WEBHOOK_SECRET ?? "";
  const greenConfigured = Boolean(webhookSecret);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const cloudWebhookUrl = appUrl ? `${appUrl}/api/whatsapp/webhook` : null;
  const greenWebhookUrl = appUrl ? `${appUrl}/api/webhooks/green-api?secret=YOUR_WEBHOOK_SECRET` : null;

  const recentCount = await prisma.pendingDocument.count({
    where: {
      sourceChannel: "WHATSAPP",
      createdAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30) }
    }
  });

  // Cross-project overview of every connected WhatsApp group. Lets admin
  // see in one place which projects are wired, which have "capture all
  // files" on, and which orphan groups are still waiting to be assigned.
  const [connectedGroups, orphanGroups] = await Promise.all([
    prisma.projectWhatsAppGroup.findMany({
      where: { isActive: true, masterDealId: { not: null } },
      select: {
        id: true,
        groupChatId: true,
        groupName: true,
        captureAllFiles: true,
        connectedAt: true,
        masterDeal: {
          select: {
            id: true,
            name: true,
            client: { select: { companyName: true } }
          }
        }
      },
      orderBy: { connectedAt: "desc" }
    }),
    prisma.projectWhatsAppGroup.findMany({
      where: { isActive: true, masterDealId: null },
      select: {
        id: true,
        groupChatId: true,
        groupName: true,
        createdAt: true
      },
      orderBy: { createdAt: "desc" },
      take: 20
    })
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-base font-semibold">חיבור WhatsApp</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          הודעות נכנסות הופכות לרשומות ב-תיבת WhatsApp לטריאז&apos;. שתי אפשרויות חיבור: Green API (סריקת QR, ללא פייסבוק) או Meta Cloud API (רשמי, דורש Business Manager).
        </p>
        <div className="mt-1 text-[11px] text-muted-foreground">
          סה&quot;כ הודעות WhatsApp שהתקבלו ב-30 הימים האחרונים: <span className="font-medium tabular-nums">{recentCount}</span>
        </div>
      </header>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Green API — חיבור QR (מומלץ להתחלה)</h3>
        <StatusCard configured={greenConfigured} label="Green API" />

        <div className="grid gap-4 md:grid-cols-2">
          <Field label='URL ל-"outgoingMessageWebhook" ב-Green API'>
            <code dir="ltr" className="block break-all text-[12px]">
              {greenWebhookUrl ?? "הגדר NEXT_PUBLIC_APP_URL"}
            </code>
          </Field>
          <Field label="פעולות שצריך לעשות ב-Green API">
            <ol className="list-decimal space-y-0.5 pr-4 text-[11px] leading-relaxed text-muted-foreground">
              <li>פתח חשבון ב-console.green-api.com</li>
              <li>צור Instance חינמי, סרוק QR מהטלפון</li>
              <li>Settings → outgoingMessageWebhook → הדבק את ה-URL מימין</li>
              <li>החלף <code>YOUR_WEBHOOK_SECRET</code> בערך שב-Vercel</li>
            </ol>
          </Field>
        </div>

        <div className="rounded border border-dashed border-input bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">משתני סביבה ב-Vercel:</span>{" "}
          <code>WHATSAPP_WEBHOOK_SECRET</code> — מחרוזת אקראית שאתה ממציא, מודבקת גם ב-URL כפרמטר <code>secret</code>.
        </div>
      </section>

      <section className="space-y-3 border-t pt-5">
        <h3 className="text-sm font-semibold">
          קבוצות WhatsApp מחוברות ({connectedGroups.length})
        </h3>
        <p className="text-[11px] text-muted-foreground">
          כל הקבוצות שמחוברות לפרויקטים. לחץ על שם הפרויקט כדי לעבור לטאב
          ה-WhatsApp של אותו פרויקט ולנהל את ההגדרות (תפוס הכל / יעד ברירת מחדל / שליחה).
        </p>
        {connectedGroups.length === 0 ? (
          <div className="rounded border border-dashed border-input bg-muted/30 p-3 text-[11px] text-muted-foreground">
            אין קבוצות מחוברות עדיין. אחרי שתחבר קבוצה לפרויקט הראשון, היא תופיע כאן.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border bg-card">
            <table className="w-full text-[12px]">
              <thead className="border-b bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-right">קבוצה</th>
                  <th className="px-2 py-1.5 text-right">פרויקט</th>
                  <th className="px-2 py-1.5 text-right">לקוח</th>
                  <th className="px-2 py-1.5 text-center">תפוס הכל</th>
                  <th className="px-2 py-1.5 text-right">חובר ב-</th>
                </tr>
              </thead>
              <tbody>
                {connectedGroups.map((g) => (
                  <tr key={g.id} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="px-2 py-1.5">
                      <div className="font-medium">{g.groupName ?? "(ללא שם)"}</div>
                      <div className="text-[10px] text-muted-foreground" dir="ltr">{g.groupChatId}</div>
                    </td>
                    <td className="px-2 py-1.5">
                      {g.masterDeal ? (
                        <Link
                          href={`/projects/${g.masterDeal.id}/whatsapp`}
                          className="inline-flex items-center gap-1 text-foreground hover:underline"
                        >
                          <Link2 className="size-3 text-emerald-600" />
                          {g.masterDeal.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {g.masterDeal?.client.companyName ?? "—"}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {g.captureAllFiles ? (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                          פעיל
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">כבוי</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-[10px] tabular-nums text-muted-foreground">
                      {formatDate(g.connectedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {orphanGroups.length > 0 && (
          <details className="mt-3 rounded border border-dashed border-input bg-muted/20 p-2">
            <summary className="cursor-pointer text-[11px] font-medium">
              קבוצות ממתינות לשיוך לפרויקט ({orphanGroups.length})
            </summary>
            <ul className="mt-2 space-y-1 text-[11px]">
              {orphanGroups.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2 rounded bg-card px-2 py-1">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{g.groupName ?? "(ללא שם)"}</div>
                    <div className="truncate text-[10px] text-muted-foreground" dir="ltr">
                      {g.groupChatId}
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Link2Off className="size-3" />
                    {formatDate(g.createdAt)}
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-muted-foreground">
              כדי לשייך קבוצה: היכנס לעמוד פרויקט →
              <Link href="/projects" className="underline">
                /projects
              </Link>
              → לשונית WhatsApp → "חבר קבוצה".
            </p>
          </details>
        )}
      </section>

      <section className="space-y-3 border-t pt-5">
        <h3 className="text-sm font-semibold">Meta WhatsApp Cloud API — חיבור רשמי</h3>
        <StatusCard configured={cloudConfigured} appSecretConfigured={Boolean(appSecret)} label="Cloud API" />

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="מספר העסק המחובר">
            <code className="text-[13px]">{displayPhoneNumber || "—"}</code>
          </Field>
          <Field label="Phone Number ID">
            <code className="text-[13px]">{phoneNumberId || "—"}</code>
          </Field>
          <Field label="כתובת Webhook (להדבקה ב-Meta App Dashboard)">
            <code dir="ltr" className="block break-all text-[12px]">{cloudWebhookUrl || "הגדר NEXT_PUBLIC_APP_URL"}</code>
          </Field>
          <Field label="משתני סביבה נדרשים ב-Vercel">
            <ul className="list-disc space-y-0.5 pr-4 text-[11px] leading-relaxed text-muted-foreground">
              <li><code>WHATSAPP_VERIFY_TOKEN</code></li>
              <li><code>WHATSAPP_ACCESS_TOKEN</code></li>
              <li><code>WHATSAPP_PHONE_NUMBER_ID</code></li>
              <li><code>WHATSAPP_APP_SECRET</code></li>
              <li><code>WHATSAPP_DISPLAY_PHONE_NUMBER</code> (אופציונלי)</li>
            </ul>
          </Field>
        </div>
      </section>
    </div>
  );
}

function StatusCard({
  configured,
  appSecretConfigured,
  label
}: {
  configured: boolean;
  appSecretConfigured?: boolean;
  label: string;
}) {
  if (!configured) {
    return (
      <div className="flex items-start gap-2 rounded border border-red-500/40 bg-red-500/5 px-3 py-2">
        <XCircle className="size-4 shrink-0 text-red-600" />
        <div className="text-[13px]">
          <div className="font-medium">{label} — לא מחובר</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">חסרים משתני סביבה.</div>
        </div>
      </div>
    );
  }
  if (appSecretConfigured === false) {
    return (
      <div className="flex items-start gap-2 rounded border border-amber-500/40 bg-amber-500/5 px-3 py-2">
        <AlertCircle className="size-4 shrink-0 text-amber-600" />
        <div className="text-[13px]">
          <div className="font-medium">{label} — פעיל, ללא אימות חתימה</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">WHATSAPP_APP_SECRET לא מוגדר. חובה בפרודקשן.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded border border-emerald-500/40 bg-emerald-500/5 px-3 py-2">
      <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
      <div className="text-[13px]">
        <div className="font-medium">{label} — מחובר ופעיל</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">הודעות נכנסות יופיעו אוטומטית בתיבת WhatsApp.</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-0.5 text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="rounded border border-input bg-card px-2 py-1.5">{children}</div>
    </div>
  );
}
