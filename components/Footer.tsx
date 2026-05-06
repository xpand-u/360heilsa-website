export default function Footer() {
  return (
    <footer
      className="section-divider py-16 px-6"
      style={{ background: "#0a0a09" }}
    >
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between gap-10">
        <div>
          <p
            className="text-sm mb-1"
            style={{ color: "var(--foreground)" }}
          >
            Rafn Franklín Johnson
          </p>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Hreyfing Heilsulind, Glæsibær, Reykjavík
          </p>
          <a
            href="tel:+3548629343"
            className="text-sm mt-2 block transition-colors"
            style={{ color: "var(--muted)" }}
          >
            +354 862 9343
          </a>
        </div>

        <div className="flex flex-col gap-3">
          <a
            href="https://www.wayoflife.is"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm flex items-center gap-1 transition-colors"
            style={{ color: "var(--muted)" }}
          >
            wayoflife.is ↗
          </a>
          <a
            href="https://www.instagram.com/rafnfranklin_360heilsa"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm transition-colors"
            style={{ color: "var(--muted)" }}
          >
            Instagram ↗
          </a>
        </div>

        <div>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            © {new Date().getFullYear()} 360 Heilsa
          </p>
        </div>
      </div>
    </footer>
  );
}
