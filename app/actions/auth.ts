"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

// Type is internal to this file — "use server" files can only export async functions.
// Clients infer this shape via Awaited<ReturnType<typeof signInAction>>.
type SignInState = { error: string | null };

export async function signInAction(
  _prev: SignInState,
  formData: FormData
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "") || "/";

  if (!email || !password) {
    return { error: "יש להזין אימייל וסיסמה" };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl
    });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return { error: "אימייל או סיסמה שגויים" };
      }
      return { error: "שגיאת התחברות. נסה שוב." };
    }
    // signIn redirects on success by throwing NEXT_REDIRECT — must re-throw.
    throw error;
  }
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
