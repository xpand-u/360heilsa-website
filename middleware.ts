import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/login", "/signup", "/api/auth", "/api/health/ingest", "/api/calendar"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let public paths through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Only protect dashboard and API routes
  const isDashboard = pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding");
  const isAPI = pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/health/ingest") &&
    !pathname.startsWith("/api/calendar");

  if (!isDashboard && !isAPI) {
    return NextResponse.next();
  }

  // Verify Supabase session
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    if (isAPI) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Onboarding gate — authenticated users who haven't finished onboarding
  // cannot access /dashboard or any /api/dashboard route.
  // The `ob` cookie is set by /api/onboarding/save when onboarding completes.
  const onboardingComplete = request.cookies.get("ob")?.value === "1";
  const isDashboardRoute = pathname.startsWith("/dashboard") ||
    (pathname.startsWith("/api/") && !pathname.startsWith("/api/onboarding"));

  if (!onboardingComplete && isDashboardRoute) {
    if (isAPI) {
      return NextResponse.json({ error: "Onboarding required" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/api/dashboard/:path*",
    "/api/onboarding/:path*",
    "/api/program/:path*",
    "/api/strava/:path*",
    "/api/terra/:path*",
    "/api/exercise/:path*",
    "/api/cycle/:path*",
    "/api/health/manual",
    "/api/apply",
  ],
};
