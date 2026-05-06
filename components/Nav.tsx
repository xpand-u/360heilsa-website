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
            width={110}
            height={36}
            style={{ objectFit: "contain", objectPosition: "left center" }}
          />
        </a>
        <div className="flex gap-8">
          <a href="#einkapjalfun" className="text-sm nav-link">
            Einkaþjálfun
          </a>
          <a href="#coach" className="text-sm nav-link">
            360 Heilsa Online Coach
          </a>
        </div>
      </div>
    </nav>
  );
}
