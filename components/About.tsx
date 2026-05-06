export default function About() {
  const credentials = [
    "CHEK Exercise Coach",
    "ACE Certified Personal Trainer",
    "Functional Nutrition Lab",
    "Evrópumeistari í hnébeygju — yngstafl. -100kg (2015)",
    "Íslandsmet í -90kg flokki",
    "Höfundur: Borðum Betur",
    "360 Heilsa hlaðvarp",
    "Stofnandi Way of Life",
  ];

  return (
    <section id="um-mig" className="section-divider py-28 px-6">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
        <div>
          <p
            className="text-xs tracking-widest uppercase mb-6"
            style={{ color: "var(--muted)", letterSpacing: "0.2em" }}
          >
            Um mig
          </p>
          <h2
            className="display mb-8"
            style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)", color: "var(--foreground)" }}
          >
            RAFN FRANKLÍN
            <br />
            JOHNSON
          </h2>
          <p className="leading-relaxed mb-6" style={{ color: "var(--foreground)" }}>
            Ég hef þjálfað fólk í yfir áratug. Sérhæft mig í styrktarþjálfun,
            líkamsstöðu og alhliða heilsu.
          </p>
          <p className="leading-relaxed mb-6" style={{ color: "var(--foreground)" }}>
            Gaf út bókina <em>Borðum Betur</em> og hélt uppi 360 Heilsa —
            eitt vinsælasta heilsuhlaðvarp landsins í sinni tíð.
          </p>
          <p className="leading-relaxed mb-8" style={{ color: "var(--foreground)" }}>
            Er stofnandi og meðeigandi{" "}
            <a
              href="https://www.wayoflife.is"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent)", textDecoration: "none" }}
            >
              Way of Life
            </a>{" "}
            — netverslun og heildsala með heilsuvörur um allt land.
          </p>
          <p style={{ color: "var(--muted)", fontSize: "0.95rem" }}>
            Þjálfa hjá Hreyfingu Heilsulind í Glæsibæ, Reykjavík.
          </p>
        </div>

        <div>
          <p
            className="text-xs tracking-widest uppercase mb-6"
            style={{ color: "var(--muted)", letterSpacing: "0.2em" }}
          >
            Menntun &amp; reynsla
          </p>
          <ul className="space-y-3">
            {credentials.map((c) => (
              <li
                key={c}
                className="flex items-start gap-3 text-sm"
                style={{ color: "var(--foreground)" }}
              >
                <span style={{ color: "var(--accent)", marginTop: "2px", flexShrink: 0 }}>
                  —
                </span>
                {c}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
