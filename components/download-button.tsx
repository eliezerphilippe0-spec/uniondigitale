"use client";

import { useState } from "react";

/** Récupère une URL signée via /api/download et ouvre le fichier. */
export function DownloadButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/download?orderId=${orderId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Téléchargement indisponible.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Connexion impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="text-right">
      <button
        onClick={download}
        disabled={loading}
        className="rounded-lg bg-cloud px-4 py-2 text-xs font-semibold text-ink transition hover:opacity-90 disabled:opacity-60"
      >
        {loading ? "…" : "Télécharger"}
      </button>
      {error && <p className="mt-1 text-xs text-magenta">{error}</p>}
    </div>
  );
}
