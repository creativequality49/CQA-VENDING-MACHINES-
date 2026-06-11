import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

function isAdminRole(role?: string | null) {
  return role === "owner" || role === "admin" || role === "content_admin";
}

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isProtectedPath(pathname: string) {
  return pathname === "/vault" || pathname.startsWith("/api/signed-download");
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (!isAdminPath(pathname) && !isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token?.sub) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("auth", "required");
    return NextResponse.redirect(url);
  }

  if (isAdminPath(pathname) && !isAdminRole(token.role as string | undefined)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("auth", "admin-required");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/vault", "/api/signed-download"]
};
