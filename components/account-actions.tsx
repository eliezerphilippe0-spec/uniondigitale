"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AccountActions() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function remove() {
    const ok = window.confirm(
      "Supprimer votre compte ? Vos données personnelles seront effacées. " +
        "Les informations nécessaires à nos obligations légales (paiements) " +
        "seront anonymisées. Cette action est irréversible.",
    );
    if (!ok) return;

    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Échec de la suppression.");
      }
      // Fin de session puis retour à l'accueil.
      await createClient().auth.signOut();
      router.push("/");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Échec de la suppression.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <a
          href="/api/account/export"
          className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-cloud transition hover:border-violet"
        >
          Exporter mes données
        </a>
        <button
          onClick={remove}
          disabled={busy}
          className="rounded-xl border border-magenta/40 px-4 py-2.5 text-sm font-semibold text-magenta transition hover:bg-magenta/10 disabled:opacity-60"
        >
          {busy ? "Suppression…" : "Supprimer mon compte"}
        </button>
      </div>
      {msg && <p className="text-xs text-magenta">{msg}</p>}
    </div>
  );
}
