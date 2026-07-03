"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Lance le checkout MonCash : POST /api/checkout puis redirection vers la
 * passerelle MonCash. La confirmation se fait serveur-à-serveur au retour.
 */
export function BuyButton({
  productId,
  priceLabel,
}: {
  productId: string;
  priceLabel: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });

      if (res.status === 401) {
        router.push("/connexion");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Une erreur est survenue.");
        return;
      }
      // Redirection vers MonCash.
      window.location.href = data.redirectUrl;
    } catch {
      setError("Connexion impossible. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleBuy}
        disabled={loading}
        className="w-full rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-ink transition hover:opacity-90 disabled:opacity-60"
      >
        {loading ? "Redirection vers MonCash…" : `Payer ${priceLabel} avec MonCash`}
      </button>
      {error && <p className="mt-2 text-center text-xs text-danger-text">{error}</p>}
    </div>
  );
}
