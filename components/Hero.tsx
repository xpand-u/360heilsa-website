"use client";
import { useState } from "react";
import ApplyModal from "./ApplyModal";

export default function Hero() {
  const [open, setOpen] = useState(false);

  return (
    <section
      className="min-h-screen flex flex-col md:flex-row"
      style={{ paddingTop: "56px" }}
    >
      {open && <ApplyModal onClose={() => setOpen(false)} />}

      {/* LEFT — text panel */}
      <div
        className="flex flex-col justify-center px-8 md:px-16 py-20 md:py-0 w-full md:w-1/2"
        style={{ background: "var(--background)" }}
      >
        <p
          className="text-xs tracking-widest uppercase mb-8"
          style={{ color: "var(--muted)", letterSpacing: "0.2em" }}
        >
          Reykjavík, Ísland
        </p>

        <h1
          className="display mb-5"
          style={{
            fontSize: "clamp(3.5rem, 8vw, 7rem)",
            color: "var(--foreground)",
            lineHeight: 0.95,
          }}
        >
          RAFN
          <br />
          FRANKLÍN
          <br />
          JOHNSON
        </h1>

        <p
          className="text-xs tracking-widest uppercase mb-6"
          style={{ color: "var(--accent)", letterSpacing: "0.18em" }}
        >
          Einkaþjálfari · Heilsusráðgjafi · CHEK Exercise Coach
        </p>

        <p
          className="mb-12"
          style={{
            color: "var(--muted)",
            fontSize: "1.05rem",
            fontWeight: 300,
            maxWidth: "380px",
            lineHeight: 1.6,
          }}
        >
          Þitt besta form til frambúðar.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <button onClick={() => setOpen(true)} className="btn-primary text-center">
            SÆKJA UM EINKAÞJÁLFUN
          </button>
          <a href="/login" className="btn-outline text-center">
            360 HEILSA ONLINE COACH →
          </a>
        </div>
      </div>

      {/* RIGHT — photo panel */}
      <div
        className="relative w-full md:w-1/2"
        style={{ height: "70vw", maxHeight: "100vh", minHeight: "320px" }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "url('/hero.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "55% 75%",
            backgroundRepeat: "no-repeat",
          }}
        />
        {/* Top fade on mobile */}
        <div
          className="md:hidden"
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to bottom, var(--background) 0%, transparent 20%)",
          }}
        />
        {/* Left fade on desktop */}
        <div
          className="hidden md:block"
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to right, var(--background) 0%, transparent 12%)",
          }}
        />
      </div>
    </section>
  );
}
