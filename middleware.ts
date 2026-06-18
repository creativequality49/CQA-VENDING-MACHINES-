import { NextResponse, type NextRequest } from "next/server";

const ADMIN_ROLES = new Set(["owner", "admin", "content_admin", "ADMIN", "OPERATIONS", "FULFILLMENT", "SUPPORT", "FINANCE"]);

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/admin")) return NextResponse.next();
  const role = req.headers.get("x-cqa-role") ?? req.cookies.get("cqa_role")?.value;
  if (role && ADMIN_ROLES.has(role)) return NextResponse.next();
  return NextResponse.redirect(new URL("/login?next=/admin", req.url));
}

export const config = {
  matcher: ["/admin/:path*"],
};
