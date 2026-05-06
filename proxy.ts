import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect /dashboard routes (not login or connect)
  if (!pathname.startsWith("/dashboard") || pathname.startsWith("/dashboard/login") || pathname.startsWith("/dashboard/connect")) {
    return NextResponse.next();
  }

  const token = req.cookies.get("dash_auth")?.value;
  const expected = process.env.DASHBOARD_TOKEN;

  if (!expected || token !== expected) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/dashboard/login";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
