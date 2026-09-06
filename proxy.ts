import { NextRequest, NextResponse } from "next/server";
import { validateSessionToken, AUTH_COOKIE_NAME } from "./lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow static assets and Next.js internal requests
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/public") ||
    pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico)$/)
  ) {
    return NextResponse.next();
  }

  // 2. Allow auth API routes
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // 3. Inspect the session cookie
  const sessionCookie = request.cookies.get(AUTH_COOKIE_NAME);
  const isValid = await validateSessionToken(sessionCookie?.value);

  // 4. Handle /login page specifically
  if (pathname === "/login") {
    if (isValid) {
      // Already authenticated; redirect to home
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // 5. If not valid and accessing an API route: return 401 JSON
  if (!isValid && pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Unauthorized. Please authenticate first." },
      { status: 401 }
    );
  }

  // 6. If not valid and accessing any other page/route: redirect to /login
  if (!isValid) {
    const loginUrl = new URL("/login", request.url);
    // Keep original destination so user can return after logging in
    if (pathname !== "/") {
      loginUrl.searchParams.set("from", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
