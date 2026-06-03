import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

// Build a slim Edge-safe auth() from authConfig (no Credentials provider, no
// Prisma, no bcryptjs). Session checks here read the JWT only — they never
// touch the DB.
const { auth } = NextAuth(authConfig);

// Cross-permit managerial views — admins only.
const ADMIN_ONLY_PREFIXES = ["/suppliers", "/finances", "/settings"];

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;
  const pathname = nextUrl.pathname;

  // Field-worker access via magic link tokens — auth via token, not session.
  if (pathname.startsWith("/m/")) return NextResponse.next();

  // Public proposal/quote pages — auth via the unguessable cuid in the URL,
  // not via session. Lets prospects sign before becoming a Client/user.
  if (pathname.startsWith("/quote/")) return NextResponse.next();

  // Check session.user.id directly — Auth.js v5 can return a session shell
  // object that is truthy but has no user when there is no JWT in the edge
  // runtime, so a bare `if (session)` would let unauthenticated traffic through.
  if (pathname === "/login" || pathname.startsWith("/login/")) {
    if (session?.user?.id) {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
    return NextResponse.next();
  }

  // "Forgot password" + token-consume routes — auth via the unguessable
  // token (verified by the server action), not via session. Anyone needs
  // to be able to reach these without first logging in (that's the point).
  if (
    pathname === "/forgot-password" ||
    pathname.startsWith("/forgot-password/") ||
    pathname.startsWith("/reset-password/")
  ) {
    return NextResponse.next();
  }

  // Everything else requires a session. The user check here narrows `session`
  // to non-null for the rest of the function.
  if (!session?.user?.id) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname + nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  const role = session.user.role;

  // Contractors live in /portal and nowhere else.
  if (role === "CONTRACTOR") {
    if (pathname.startsWith("/portal")) return NextResponse.next();
    return NextResponse.redirect(new URL("/portal", nextUrl));
  }

  // Employees are not contractors — /portal isn't for them either.
  if (pathname.startsWith("/portal") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/permits", nextUrl));
  }

  // Admin-only sections — employees bounce to /permits.
  if (ADMIN_ONLY_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (role !== "ADMIN") {
      return NextResponse.redirect(new URL("/permits", nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  // Skip Next internals, auth handler, third-party webhooks (no session), and
  // static assets (any path containing a dot).
  matcher: ["/((?!api/auth|api/whatsapp|api/webhooks|_next/static|_next/image|favicon\\.ico|.*\\..*).*)"]
};
