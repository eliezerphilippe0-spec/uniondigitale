"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PublishForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    kind: "fichier",
    category: "",
    priceHTG: "",
    description: "",
  });

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, priceHTG: Number(form.priceHTG) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Publication échouée.");
        return;
      }
      router.push(`/produit/${data.slug}`);
      router.refresh();
    } catch {
      setError("Connexion impossible.");
    } finally {
      setLoading(false);
    }
  }

  const input =
    "w-full rounded-xl border border-line bg-ink/40 px-4 py-3 text-sm outline-none focus:border-violet";

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        className={input}
        placeholder="Titre du produit"
        value={form.title}
        onChange={(e) => set("title", e.target.value)}
        required
      />
      <div className="flex gap-3">
        <select
          className={input}
          value={form.kind}
          onChange={(e) => set("kind", e.target.value)}
        >
          <option value="fichier">Fichier digital</option>
          <option value="service">Service / prestation</option>
        </select>
        <input
          className={input}
          placeholder="Catégorie"
          value={form.category}
          onChange={(e) => set("category", e.target.value)}
        />
      </div>
      <input
        className={input}
        type="number"
        min={0}
        placeholder="Prix (HTG)"
        value={form.priceHTG}
        onChange={(e) => set("priceHTG", e.target.value)}
        required
      />
      <textarea
        className={input}
        rows={4}
        placeholder="Description"
        value={form.description}
        onChange={(e) => set("description", e.target.value)}
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-ink transition hover:opacity-90 disabled:opacity-60"
      >
        {loading ? "Publication…" : "Publier le produit"}
      </button>
      {error && <p className="text-center text-xs text-danger-text">{error}</p>}
      <p className="text-center text-xs text-mist">
        L'envoi du fichier livrable se fera depuis la fiche produit (étape
        suivante).
      </p>
    </form>
  );
}
