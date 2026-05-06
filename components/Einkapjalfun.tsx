"use client";
import { useState } from "react";
import ApplyModal from "./ApplyModal";

export default function Einkapjalfun() {
  const [open, setOpen] = useState(false);

  return (
    <section id="einkapjalfun" className="section-divider py-28 px-6">
      {open && <ApplyModal onClose={() => setOpen(false)} />}

      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
        <div>
          <p
            className="text-xs tracking-widest uppercase mb-6"
            style={{ color: "var(--muted)", letterSpacing: "0.2em" }}
          >
            Einkaþjálfun
          </p>
          <h2
            className="display mb-8"
            style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)", color: "var(--foreground)" }}
          >
            PERSÓNULEG
            <br />
            ÞJÁLFUN.
            <br />
            TAKMÖRKUÐ
            <br />
            PLÁSS.
          </h2>
          <p className="leading-relaxed mb-4" style={{ color: "var(--foreground)" }}>
            Ég tek að mér fáa skjólstæðinga í einu.
            Lágmark 3 mánaða binditími.
          </p>
          <p className="mb-10" style={{ color: "var(--muted)", fontSize: "0.95rem" }}>
            Þjálfunin fer fram í Hreyfingu Heilsulind í Glæsibæ, Reykjavík.
          </p>
          <button onClick={() => setOpen(true)} className="btn-primary">
            SENDA UMSÓKN
          </button>
        </div>

        <div className="p-8" style={{ border: "1px solid var(--border)" }}>
          <p
            className="text-xs tracking-widest uppercase mb-6"
            style={{ color: "var(--muted)", letterSpacing: "0.2em" }}
          >
            Hvað er innifalið
          </p>
          <ul className="space-y-4">
            {[
              "Heildarmat á líkamsstöðu og getu",
              "Einstaklingsmiðað æfingaplan",
              "Þjálfun sem tekur tillit til meiðsla og líkamlegra takmarkana",
              "Reglulegt eftirlit og leiðrétting",
              "Beinn aðgangur að mér milli æfinga",
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 text-sm leading-relaxed"
                style={{ color: "var(--foreground)" }}
              >
                <span style={{ color: "var(--accent)", flexShrink: 0, marginTop: "2px" }}>✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
