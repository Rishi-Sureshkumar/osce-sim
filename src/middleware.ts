import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authConfig, verifyToken } from "@/server/authToken";

const PUBLIC = [/^\/gate$/, /^\/api\/gate$/];

/** Access-code gate for the whole app. Coach routes need the coach role. */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC.some((r) => r.test(pathname))) return NextResponse.next();

  const cfg = authConfig();
  if (cfg.open) return NextResponse.next();

  const isApi = pathname.startsWith("/api/");
  const deny = (status: number, msg: string) => {
    if (isApi) return NextResponse.json({ error: msg }, { status });
    const url = req.nextUrl.clone();
    url.pathname = "/gate";
    url.search = `?next=${encodeURIComponent(pathname + search)}${status === 403 ? "&coach=1" : ""}`;
    return NextResponse.redirect(url);
  };
  if (cfg.misconfigured) return deny(503, "Access codes are not configured on this deployment.");

  const role = await verifyToken(req.cookies.get(AUTH_COOKIE)?.value, cfg.secret!);
  if (!role) return deny(401, "Please enter the access code.");
  const coachOnly = pathname.startsWith("/coach") || pathname.startsWith("/api/coach") || pathname.startsWith("/dev");
  if (coachOnly && role !== "coach") return deny(403, "Coach access required.");
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
