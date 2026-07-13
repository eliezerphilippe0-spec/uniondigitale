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
    deliveryDays: "",
    serviceIncludes: "",
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
        body: JSON.stringify({
          title: form.title,
          kind: form.kind,
          category: form.category,
          description: form.description,
          priceHTG: Number(form.priceHTG),
          deliveryDays: form.deliveryDays ? Number(form.deliveryDays) : null,
          // Un élément par ligne — le serveur reborne (10 max, 140 car.).
          serviceIncludes: form.serviceIncludes
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
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
      {form.kind === "service" && (
        <div className="space-y-3 rounded-xl border border-line/60 p-4">
          <p className="text-xs text-mist">
            Page service (façon Fiverr) — optionnel, mais rassure l&apos;acheteur.
          </p>
          <input
            className={input}
            type="number"
            min={1}
            max={365}
            placeholder="Délai de livraison (en jours)"
            value={form.deliveryDays}
            onChange={(e) => set("deliveryDays", e.target.value)}
          />
          <textarea
            className={input}
            rows={3}
            placeholder={"Ce qui est inclus — un élément par ligne\nEx. 3 révisions\nFichier source livré"}
            value={form.serviceIncludes}
            onChange={(e) => set("serviceIncludes", e.target.value)}
          />
        </div>
      )}
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
