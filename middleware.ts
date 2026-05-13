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

  // /login is the only public app route. Use a typed presence check on the
  // user.id we attach in the jwt callback — Auth.js v5 can return a session
  // shell object when there is no actual JWT in the edge runtime.
  const isAuthenticated = Boolean(session?.user?.id);
  if (pathname === "/login" || pathname.startsWith("/login/")) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
    return NextResponse.next();
  }

  // Everything else requires a session.
  if (!isAuthenticated) {
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
  // Skip Next internals, auth handler, static assets (files with extensions).
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon\\.ico|.*\\..*).*)"]
};
