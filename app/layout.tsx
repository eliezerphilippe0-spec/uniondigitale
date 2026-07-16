import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { getLang } from "@/lib/i18n-server";

// Polices AUTO-HÉBERGÉES par Next (sous-ensemble latin, servies depuis notre
// domaine) — supprime la requête tierce bloquante vers Google Fonts, gain net
// sur 3G. `swap` : le texte s'affiche immédiatement en repli puis bascule.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["800"],
  variable: "--font-manrope",
  display: "swap",
});

const title = "Zabelie Digi — Produits digitaux & talents haïtiens";
const description =
  "Vendez vos produits digitaux et vos talents. Paiement mobile money, livraison instantanée. La marketplace digitale haïtienne.";

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
    siteName: "Zabelie Digi",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#17123a",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // BL-112 : lang suit la langue de session (lecteurs d'écran + SEO) — figé
  // sur "fr" auparavant, le Kreyòl était prononcé avec les règles du français.
  const lang = await getLang();
  return (
    <html lang={lang} className={`${inter.variable} ${manrope.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
