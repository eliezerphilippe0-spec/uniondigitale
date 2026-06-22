"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProfileForm({
  initial,
}: {
  initial: { display_name: string; bio: string; avatar_url: string };
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
