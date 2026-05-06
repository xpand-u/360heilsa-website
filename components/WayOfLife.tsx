export default function WayOfLife() {
  return (
    <section className="section-divider py-24 px-6">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-10">
        <div>
          <p
            className="text-xs tracking-widest uppercase mb-6"
            style={{ color: "var(--muted)", letterSpacing: "0.2em" }}
          >
            Mælt með
          </p>
          <h2
            className="display mb-4"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)", color: "var(--foreground)" }}
          >
            SVEFN. NÆRING. ORKA.
          </h2>
          <p
            style={{
              color: "var(--muted)",
              fontSize: "1rem",
              fontWeight: 300,
              maxWidth: "480px",
              lineHeight: 1.7,
            }}
          >
            Hlutir sem ég nota sjálfur og mæli með til skjólstæðinga minna.
            Vandlega valið úrval af vörum fyrir svefn, næringu og heilsufar.
          </p>
        </div>
        <a
          href="https://wayoflife.is"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline"
          style={{ whiteSpace: "nowrap", flexShrink: 0 }}
        >
          SKOÐA WAYOFLIFE.IS →
        </a>
      </div>
    </section>
  );
}
