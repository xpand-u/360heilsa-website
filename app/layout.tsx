import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rafn Franklín Johnson — Einkaþjálfari & Heilsusráðgjafi",
  description:
    "Sérsniðin heildræn þjálfun í Hreyfingu Heilsulind, Reykjavík. Einkaþjálfun og 360 Heilsa Online Coach.",
  openGraph: {
    title: "Rafn Franklín Johnson",
    description: "Einkaþjálfari. Heilsusráðgjafi. CHEK Exercise Coach.",
    url: "https://www.360heilsa.is",
    siteName: "360 Heilsa",
    locale: "is_IS",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="is">
      <body>{children}</body>
    </html>
  );
}
