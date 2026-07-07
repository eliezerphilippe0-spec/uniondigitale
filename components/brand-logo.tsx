import Link from "next/link";

/**
 * Logo Zabelie Talent — monogramme "Z" géométrique (chevrons), avec
 * dégradé or → violet de la marque.
 * 100% SVG, aucune dépendance externe.
 */
export function BrandMark({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="zt-grad" x1="4" y1="4" x2="44" y2="44">
          <stop offset="0" stopColor="#f5b53d" />
          <stop offset="0.4" stopColor="#ff8a3d" />
          <stop offset="0.7" stopColor="#e0408f" />
          <stop offset="1" stopColor="#7c5cff" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#zt-grad)" />
      {/* Z stylisé en chevrons */}
      <path
        d="M14 15h20l-13 12h13l-2 6H13l13-12H14z"
        fill="#0a0a0f"
        fillOpacity="0.92"
      />
    </svg>
  );
}

export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2 ${className}`}>
      <BrandMark size={32} />
      <span className="text-sm font-semibold tracking-tight">
        Zabelie <span className="text-mist">Talent</span>
      </span>
    </Link>
  );
}
