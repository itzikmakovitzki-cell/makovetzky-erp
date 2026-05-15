import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { isWhatsAppConfigured, getWhatsAppConfig } from "@/lib/whatsapp";

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
