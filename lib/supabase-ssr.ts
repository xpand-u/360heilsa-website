import { createServerClient as createSSRServerClient } from "@supabase/ssr";
import { type ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

/**
 * Supabase client that reads the user's auth session from cookies.
 * Use this when you need to identify WHO is making a request.
 * Uses the anon key — respects RLS.
 */
export function createSessionClient(cookieStore: ReadonlyRequestCookies) {
  return createSSRServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );
}
