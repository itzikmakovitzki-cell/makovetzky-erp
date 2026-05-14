import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { isWhatsAppConfigured, getWhatsAppConfig } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export default async function WhatsAppSettingsPage() {
  const configured = isWhatsAppConfigured();
  const { displayPhoneNumber, phoneNumberId, appSecret } = getWhatsAppConfig();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const webhookUrl = appUrl ? `${appUrl}/api/whatsapp/webhook` : null;

  const recentCount = await prisma.pendingDocument.count({
    where: {
      sourceChannel: "WHATSAPP",
      createdAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30) }
    }
  });

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-base font-semibold">חיבור WhatsApp Cloud API</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          הודעות שמתקבלות במספר העסקי הופכות לרשומות ב-תיבת WhatsApp לטריאז&apos;.
        </p>
      </header>

      <StatusCard configured={configured} appSecretConfigured={Boolean(appSecret)} />

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="מספר העסק המחובר">
          <code className="text-[13px]">{displayPhoneNumber || "—"}</code>
        </Field>
        <Field label="Phone Number ID">
          <code className="text-[13px]">{phoneNumberId || "—"}</code>
        </Field>
        <Field label="כתובת Webhook (להדבקה ב-Meta App Dashboard)">
          <code dir="ltr" className="block break-all text-[12px]">{webhookUrl || "הגדר NEXT_PUBLIC_APP_URL"}</code>
        </Field>
        <Field label="הודעות שהתקבלו ב-30 הימים האחרונים">
          <span className="text-[13px] tabular-nums">{recentCount}</span>
        </Field>
      </div>

      <section className="rounded border border-dashed border-input bg-muted/30 p-3 text-[12px] leading-relaxed">
        <div className="mb-1 font-medium text-foreground">משתני סביבה ב-Vercel</div>
        <ul className="list-disc space-y-0.5 pr-4 text-muted-foreground">
          <li><code>WHATSAPP_VERIFY_TOKEN</code> — המחרוזת האקראית שתשים גם ב-Meta Webhook configuration</li>
          <li><code>WHATSAPP_ACCESS_TOKEN</code> — Permanent token של System User עם הרשאת whatsapp_business_messaging</li>
          <li><code>WHATSAPP_PHONE_NUMBER_ID</code> — מזהה המספר ב-API Setup של Meta</li>
          <li><code>WHATSAPP_APP_SECRET</code> — מ-App Settings → Basic → App Secret (לאימות חתימת ההודעות)</li>
          <li><code>WHATSAPP_DISPLAY_PHONE_NUMBER</code> — אופציונלי, רק לתצוגה במסך הזה</li>
        </ul>
        <div className="mt-2 text-muted-foreground">
          אחרי שתעדכן ב-Vercel תצטרך redeploy אחד (שינוי ENV לא מתקדש לבד).
        </div>
      </section>
    </div>
  );
}

function StatusCard({ configured, appSecretConfigured }: { configured: boolean; appSecretConfigured: boolean }) {
  if (!configured) {
    return (
      <div className="flex items-start gap-2 rounded border border-red-500/40 bg-red-500/5 p-3">
        <XCircle className="size-4 shrink-0 text-red-600" />
        <div className="text-[13px]">
          <div className="font-medium">לא מחובר</div>
          <div className="mt-0.5 text-muted-foreground">חסרים משתני סביבה. ראה הרשימה למטה.</div>
        </div>
      </div>
    );
  }
  if (!appSecretConfigured) {
    return (
      <div className="flex items-start gap-2 rounded border border-amber-500/40 bg-amber-500/5 p-3">
        <AlertCircle className="size-4 shrink-0 text-amber-600" />
        <div className="text-[13px]">
          <div className="font-medium">פעיל — אבל ללא אימות חתימה</div>
          <div className="mt-0.5 text-muted-foreground">WHATSAPP_APP_SECRET לא מוגדר. בפרודקשן חובה להגדיר כדי לאמת ש-Meta הם השולחים.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded border border-emerald-500/40 bg-emerald-500/5 p-3">
      <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
      <div className="text-[13px]">
        <div className="font-medium">מחובר ופעיל</div>
        <div className="mt-0.5 text-muted-foreground">הודעות נכנסות יופיעו אוטומטית בתיבת WhatsApp.</div>
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
