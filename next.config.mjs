/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Pas de générique "**" : next/image proxie le fetch côté serveur, un
    // hostname illimité en ferait un SSRF-as-a-service. Scindé au strict
    // besoin (Supabase Storage) — élargir explicitement si un autre hôte
    // d'images de confiance est ajouté.
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
