"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Envoie le fichier livrable d'un produit vers /api/products/asset.
 */
export function UploadAsset({
  productId,
  hasAsset,
}: {
  productId: string;
  hasAsset: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("productId", productId);
      fd.append("file", file);
      const res = await fetch("/api/products/asset", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Envoi échoué.");
        return;
      }
      setMsg("Fichier enregistré.");
      router.refresh();
    } catch {
      setMsg("Connexion impossible.");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="text-right">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={onChange}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-cloud transition hover:border-violet/50 disabled:opacity-60"
      >
        {loading ? "Envoi…" : hasAsset ? "Remplacer le fichier" : "Ajouter le fichier"}
      </button>
      {msg && <p className="mt-1 text-xs text-mist">{msg}</p>}
    </div>
  );
}
