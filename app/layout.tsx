import type { Metadata, Viewport } from "next";
import "./globals.css";

const title = "Zabelie Talent — Produits digitaux & talents africains";
const description =
  "Vendez vos produits digitaux et vos talents. Paiement mobile money, livraison instantanée. La marketplace digitale africaine.";

export const metadata: Metadata = {
  title: {
    default: title,
    template: "%s",
  },
  description,
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
  openGraph: {
    title,
    description,
    type: "website",
    locale: "fr_FR",
    siteName: "Zabelie Talent",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
