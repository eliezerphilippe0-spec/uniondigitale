import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-12 md:flex-row md:justify-between">
        <div className="max-w-xs">
          <BrandLogo />
          <p className="mt-3 text-sm text-mist">
            La marketplace des produits digitaux et talents africains. Paiement
            mobile money, livraison instantanée.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <p className="font-semibold text-cloud">Explorer</p>
            <Link href="/catalogue" className="text-mist hover:text-cloud">
              Catalogue
            </Link>
            <Link href="/#talents" className="text-mist hover:text-cloud">
              Talents
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-semibold text-cloud">Vendre</p>
            <Link href="/vendre" className="text-mist hover:text-cloud">
              Devenir créateur
            </Link>
            <Link href="/#comment" className="text-mist hover:text-cloud">
              Comment ça marche
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-semibold text-cloud">Paiement</p>
            <span className="text-mist">MonCash</span>
            <span className="text-mist/50">NatCash — bientôt</span>
          </div>
        </div>
      </div>
      <div className="border-t border-line py-5 text-center text-xs text-mist">
        © {new Date().getFullYear()} Zabelie Digi. Tous droits réservés.
      </div>
    </footer>
  );
}
