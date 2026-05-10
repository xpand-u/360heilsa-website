"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Detects Supabase auth hash fragments on any page (e.g. after a password reset email
 * redirects to the site root instead of /auth/callback) and forwards them correctly.
 */
export default function AuthHashRedirect() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("type=recovery")) {
      router.replace("/auth/callback" + hash);
    } else if (hash && hash.includes("access_token")) {
      router.replace("/auth/callback" + hash);
    }
  }, [router]);

  return null;
}
