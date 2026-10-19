import { NextResponse, type NextRequest } from "next/server";

import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/session-token";

const publicPaths = new Set(["/", "/login", "/recover", "/api/radar/cron"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicPaths.has(pathname) || pathname.startsWith("/recover/")) {
    return NextResponse.next();
  }

  const userId = readSessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (userId === undefined) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff2?)$).*)"],
};
