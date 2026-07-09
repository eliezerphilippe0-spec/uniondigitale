"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES } from "@/lib/geo/countries";
import { HT_DEPARTMENTS } from "@/lib/geo/haiti";

export function ProfileForm({
  initial,
}: {
  initial: {
    display_name: string;
    bio: string;
    avatar_url: string;
    country_code: string;
    region_code: string;
  };
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      setMsg(res.ok ? "Profil mis à jour." : (data.error ?? "Échec."));
      if (res.ok) router.refresh();
    } catch {
      setMsg("Connexion impossible.");
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
        placeholder="Nom d'affichage"
        value={form.display_name}
        onChange={(e) => set("display_name", e.target.value)}
        required
      />
      <input
        className={input}
        placeholder="URL de l'avatar (optionnel)"
        value={form.avatar_url}
        onChange={(e) => set("avatar_url", e.target.value)}
      />
      <select
        className={input}
        value={form.country_code}
        onChange={(e) => {
          const country = e.target.value;
          // Le département n'existe qu'en Haïti : on le réinitialise sinon.
          setForm((f) => ({
            ...f,
            country_code: country,
            region_code: country === "HT" ? f.region_code : "",
          }));
        }}
        aria-label="Pays"
      >
        <option value="">Pays (optionnel)</option>
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
      {form.country_code === "HT" && (
        <select
          className={input}
          value={form.region_code}
          onChange={(e) => set("region_code", e.target.value)}
          aria-label="Département"
        >
          <option value="">Département (optionnel)</option>
          {HT_DEPARTMENTS.map((d) => (
            <option key={d.code} value={d.code}>
              {d.name}
            </option>
          ))}
        </select>
      )}
      <textarea
        className={input}
        rows={3}
        placeholder="Bio — présente ton talent"
        value={form.bio}
        onChange={(e) => set("bio", e.target.value)}
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-cloud px-5 py-2.5 text-sm font-semibold text-ink transition hover:opacity-90 disabled:opacity-60"
      >
        {loading ? "…" : "Enregistrer"}
      </button>
      {msg && <p className="text-xs text-mist">{msg}</p>}
    </form>
  );
}
