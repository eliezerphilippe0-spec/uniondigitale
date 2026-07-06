"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type BuyOption = {
  rail: "moncash" | "stripe" | "zelle";
  label: string;
};

/**
 * Lance le checkout sur le rail choisi : POST /api/checkout { productId, rail }
 * puis redirection (passerelle MonCash/Stripe, ou page d'instructions Zelle).
 * La confirmation se fait toujours serveur-à-serveur — jamais ici.
 * Les options sont construites CÔTÉ SERVEUR (rails activés + libellés i18n) ;
 * une seule option = bouton simple (parcours MVP inchangé).
 */
export function BuyButton({
  productId,
  options,
  othersLabel,
  loadingLabel = "Redirection…",
}: {
  productId: string;
  options: BuyOption[];
  /** Petit titre au-dessus des rails secondaires (ex. « Diaspora ? … »). */
  othersLabel?: string;
  loadingLabel?: string;
}) {
  const router = useRouter();
  const [loadingRail, setLoadingRail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy(rail: string) {
    setLoadingRail(rail);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, rail }),
      });

      if (res.status === 401) {
        // Préserve le contexte : retour automatique sur la page produit
        // après connexion (le point de friction n°1 vs Gumroad).
        router.push(`/connexion?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Une erreur est survenue.");
        return;
      }
      // Redirection vers le rail (URL absolue opérateur ou page interne).
      if (String(data.redirectUrl).startsWith("/")) {
        router.push(data.redirectUrl);
      } else {
        window.location.href = data.redirectUrl;
      }
    } catch {
      setError("Connexion impossible. Réessayez.");
    } finally {
      setLoadingRail(null);
    }
  }

  const [primary, ...others] = options;
  const busy = loadingRail !== null;

  return (
    <div>
      <button
        onClick={() => handleBuy(primary.rail)}
        disabled={busy}
        className="w-full rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-ink transition hover:opacity-90 disabled:opacity-60"
      >
        {loadingRail === primary.rail ? loadingLabel : primary.label}
      </button>

      {others.length > 0 && (
        <div className="mt-3">
          {othersLabel && (
            <p className="text-center text-xs text-mist">{othersLabel}</p>
          )}
          <div className="mt-2 grid gap-2">
            {others.map((o) => (
              <button
                key={o.rail}
                onClick={() => handleBuy(o.rail)}
                disabled={busy}
                className="w-full rounded-xl border border-line bg-surface/60 px-6 py-2.5 text-sm font-semibold text-cloud transition hover:border-brand/60 disabled:opacity-60"
              >
                {loadingRail === o.rail ? loadingLabel : o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-center text-xs text-danger-text">{error}</p>}
    </div>
  );
}
