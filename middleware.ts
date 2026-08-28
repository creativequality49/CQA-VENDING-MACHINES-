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
function isAgeRestrictedPath(pathname:string){
  return ["/fanxfantasy/unlock","/fanxfantasy/messages","/fanxfantasy/checkout","/fanxfantasy/success","/fanxfantasy/library","/fanxfantasy/character-studio","/fanxfantasy/create","/creator-studio"].some(p=>pathname===p||pathname.startsWith(`${p}/`));
}
function base64url(bytes:ArrayBuffer){return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}
async function verifiedAge(token:string|undefined){
  const secret=process.env.AGE_GATE_SECRET;
  if(!secret||!token)return false;
  const [version,expRaw,sig]=token.split(".");
  if(version!=="v1"||!expRaw||!sig)return false;
  const exp=Number(expRaw);if(!Number.isFinite(exp)||exp<=Math.floor(Date.now()/1000))return false;
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const digest=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(`${version}.${expRaw}`));
  return base64url(digest)===sig;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if(isAgeRestrictedPath(pathname) && !(await verifiedAge(request.cookies.get("cqa_age_verified")?.value))){
    const url=request.nextUrl.clone();url.pathname="/age-check";url.searchParams.set("returnTo",pathname);return NextResponse.redirect(url);
  }
  if (!isAdminPath(pathname) && !isProtectedPath(pathname)) return NextResponse.next();
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.sub) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const url = request.nextUrl.clone();url.pathname = "/";url.searchParams.set("auth", "required");return NextResponse.redirect(url);
  }
  if (isAdminPath(pathname) && !isAdminRole(token.role as string | undefined)) {
    const url = request.nextUrl.clone();url.pathname = "/";url.searchParams.set("auth", "admin-required");return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/vault", "/api/signed-download", "/creator-studio/:path*", "/fanxfantasy/:path*"] };
