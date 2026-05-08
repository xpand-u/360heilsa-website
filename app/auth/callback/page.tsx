"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

/**
 * Handles Supabase auth redirects (password reset, email confirmation).
 * Supabase sends users here after email link clicks.
 * The session token arrives as a URL hash fragment — the browser client picks it up automatically.
 */
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        router.replace("/auth/reset-password");
      } else if (session) {
        router.replace("/dashboard");
      } else {
        router.replace("/login?error=link_expired");
      }
    });

    // Also check current session in case event already fired
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Check if this is a recovery session via URL hash
        const hash = window.location.hash;
        if (hash.includes("type=recovery")) {
          router.replace("/auth/reset-password");
        } else {
          router.replace("/dashboard");
        }
      }
    });
  }, [router]);

  return (
    <div style={{
      minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#0c0c0b", fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <div style={{ fontSize: "13px", color: "#6b6860" }}>Verifying…</div>
    </div>
  );
}
