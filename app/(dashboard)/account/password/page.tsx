import { auth } from "@/auth";
import { PageHeader } from "@/components/global/page-header";
import { ChangePasswordForm } from "@/components/account/change-password-form";

export const dynamic = "force-dynamic";

// Self-service password change — accessible to ANY logged-in user (ADMIN,
// EMPLOYEE, CONTRACTOR). Sits under /account so the admin-only middleware
// gate on /settings doesn't block employees. The server action handles all
// validation; this page just renders the form + identity.

export default async function ChangePasswordPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const name = session?.user?.name ?? "";

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="שינוי סיסמה"
        description="עדכן את סיסמת ההתחברות שלך. נדרשת אישור באמצעות הסיסמה הנוכחית."
      />
      <div className="rounded-md border bg-card p-4">
        <div className="mb-3 text-[11px] text-muted-foreground">
          חשבון: <span className="font-medium">{name}</span> · {email}
        </div>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
