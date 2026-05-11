import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rafn Franklín Johnson — Einkaþjálfari í Reykjavík | 360 Heilsa",
  description:
    "Einkaþjálfari og heilsusráðgjafi í Reykjavík. Sérsniðin þjálfun, líkamsstöðugreining og 360 Heilsa Online Coach. Þjálfar í Hreyfingu Heilsulind, Glæsibæ.",
  keywords: [
    "einkaþjálfari reykjavík",
    "einkaþjálfun reykjavík",
    "personal trainer reykjavík",
    "heilsusráðgjafi",
    "þjálfari reykjavík",
    "CHEK exercise coach",
    "360 heilsa",
    "líkamsþjálfun reykjavík",
    "online þjálfari",
    "Rafn Franklín Johnson",
  ],
  openGraph: {
    title: "Rafn Franklín Johnson — Einkaþjálfari í Reykjavík",
    description:
      "Sérsniðin þjálfun í Hreyfingu Heilsulind, Reykjavík. Einkaþjálfun og 360 Heilsa Online Coach.",
    url: "https://www.360heilsa.is",
    siteName: "360 Heilsa",
    locale: "is_IS",
    type: "website",
  },
  alternates: {
    canonical: "https://www.360heilsa.is",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "360 Heilsa — Rafn Franklín Johnson",
  description:
    "Einkaþjálfari og heilsusráðgjafi í Reykjavík. Sérsniðin þjálfun og 360 Heilsa Online Coach.",
  url: "https://www.360heilsa.is",
  telephone: "+354-862-9343",
  email: "rafn@360heilsa.is",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Hreyfing Heilsulind, Glæsibær",
    addressLocality: "Reykjavík",
    addressCountry: "IS",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 64.1355,
    longitude: -21.8954,
  },
  sameAs: [
    "https://www.instagram.com/rafnfranklin",
  ],
  priceRange: "$$",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="is" style={{ background: "#0c0c0b" }}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body style={{ background: "#0c0c0b" }}>{children}</body>
    </html>
  );
}
