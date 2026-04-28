import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * `/` always opens the auth screen first (not the dashboard), even if a session cookie exists.
 * `/home` is public marketing (not in this matcher). Protected app routes still require a valid JWT.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const secret = process.env.NEXTAUTH_SECRET;

  if (!secret) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret });

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
    return NextResponse.next();
  }

  const protectedPrefixes = ["/dashboard", "/datasets", "/audit", "/settings", "/reports"];
  const isProtected = protectedPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isProtected && !token) {
    const login = new URL("/login", request.url);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/register",
    "/dashboard/:path*",
    "/datasets/:path*",
    "/audit/:path*",
    "/settings/:path*",
    "/reports/:path*",
  ],
};
