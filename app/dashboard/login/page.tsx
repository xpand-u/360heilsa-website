"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError("Wrong password");
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "var(--background)" }}
    >
      <div
        className="w-full max-w-sm"
        style={{ border: "1px solid var(--border)", padding: "48px 40px" }}
      >
        <p
          className="display mb-8"
          style={{ fontSize: "2rem", color: "var(--foreground)" }}
        >
          360 HEILSA
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <p className="text-xs mb-2" style={{ color: "var(--muted)", letterSpacing: "0.1em" }}>
              LYKILORÐ
            </p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              className="w-full px-4 py-3 text-sm"
              style={{
                background: "#1a1a18",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
                outline: "none",
              }}
            />
          </div>
          {error && (
            <p className="text-sm" style={{ color: "#e55" }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="btn-primary w-full text-center"
          >
            {loading ? "..." : "OPNA"}
          </button>
        </form>
      </div>
    </div>
  );
}
