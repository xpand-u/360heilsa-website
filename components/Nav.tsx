import Image from "next/image";

export default function Nav() {
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{ background: "rgba(12,12,11,0.92)", borderBottom: "1px solid var(--border)" }}
      aria-label="Aðalvalmynd"
    >
      <div
        className="max-w-5xl mx-auto px-6 flex items-center justify-between"
        style={{ height: "56px" }}
      >
        <a href="#" style={{ display: "flex", alignItems: "center" }}>
          <Image
            src="/logo.png"
            alt="360 Heilsa"
            width={100}
            height={32}
            style={{ objectFit: "contain", objectPosition: "left center" }}
          />
        </a>
        {/* Nav links — hidden on small screens */}
        <div className="hidden sm:flex gap-8">
          <a href="#einkapjalfun" className="text-sm nav-link">
            Einkaþjálfun
          </a>
          <a href="/dashboard/login" className="text-sm nav-link">
            360 Heilsa Online Coach
          </a>
        </div>
        {/* Mobile CTA */}
        <a
          href="#einkapjalfun"
          className="sm:hidden text-xs btn-primary"
          style={{ padding: "8px 16px" }}
        >
          UMSÓKN
        </a>
      </div>
    </nav>
  );
}
