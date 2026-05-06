export default function Coach360() {
  const features = [
    "Einstaklingsmiðuð þjálfun",
    "Líkamsstöðugreining",
    "Æfingaplan byggt í kringum meiðsli og líkamlegar takmarkanir",
    "Utanumhald",
    "App í símann",
    "Eftirfylgni og yfirsýn",
  ];

  return (
    <section
      id="coach"
      className="section-divider py-28 px-6"
      style={{ background: "#111110" }}
    >
      <div className="max-w-5xl mx-auto">
        <p
          className="text-xs tracking-widest uppercase mb-6"
          style={{ color: "var(--muted)", letterSpacing: "0.2em" }}
        >
          360 Heilsa Online Coach
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
          <div>
            <h2
              className="display mb-8"
              style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)", color: "var(--foreground)" }}
            >
              SAMA KERFIÐ.
              <br />
              ÁN ÞESS AÐ
              <br />
              ÞURFA MIG.
            </h2>

            <p className="leading-relaxed mb-5" style={{ color: "var(--foreground)" }}>
              Þjálfunarforrit knúið af gervigreind — byggt á sömu aðferðafræði
              og ég nota með skjólstæðingum mínum.
            </p>

            <p className="leading-relaxed mb-10" style={{ color: "var(--foreground)" }}>
              Þú færð þjálfunaráætlun sem er gerð fyrir þig. Ekki sniðmát.
              Ekki almenn ráð. Þjálfun sem tekur tillit til markmiða þinna,
              þinnar líkamsbyggingar og þess sem er að koma í veg fyrir það í dag.
            </p>

            <a href="#" className="btn-accent">
              HEFJA ÁSKRIFT
            </a>
            <p className="mt-4 text-xs" style={{ color: "var(--muted)" }}>
              Væntanlegt.
            </p>
          </div>

          <div>
            <ul>
              {features.map((f, i) => (
                <li
                  key={f}
                  className="flex items-center gap-4 py-4 text-sm"
                  style={{
                    borderTop: "1px solid var(--border)",
                    borderBottom: i === features.length - 1 ? "1px solid var(--border)" : undefined,
                    color: "var(--foreground)",
                  }}
                >
                  <span
                    className="text-xs w-5 text-right flex-shrink-0"
                    style={{ color: "var(--accent)", fontFamily: "var(--font-display)", fontSize: "1rem" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
