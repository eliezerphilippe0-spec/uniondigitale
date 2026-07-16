"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BrandMark } from "@/components/brand-logo";
import { safeNext } from "@/lib/safe-next";

type Mode = "signin" | "signup";

function ConnexionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNext(searchParams.get("next"));
  // BL-121 : /auth/callback redirige ici avec ?erreur=lien_expire quand le
  // lien de confirmation est expiré/déjà consommé — message clair d'entrée.
  const erreur = searchParams.get("erreur");
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(
    erreur === "lien_expire"
      ? "Ce lien de confirmation a expiré ou a déjà été utilisé. Connectez-vous, ou créez à nouveau votre compte pour recevoir un nouveau lien."
      : null
  );
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      // Dans le try : sans Supabase configuré (mode démo), createClient()
      // lève — l'utilisateur doit voir un message, pas un bouton figé.
      const supabase = createClient();
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // Crée le profil (RLS : self insert autorisé) si session active.
        if (data.user && data.session) {
          await supabase.from("profiles").insert({
            id: data.user.id,
            display_name: name || email.split("@")[0],
            role: "buyer",
          });
          router.push(nextPath);
          router.refresh();
          return;
        }
        setMsg("Compte créé. Vérifiez votre e-mail pour confirmer, puis connectez-vous.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push(nextPath);
        router.refresh();
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Une erreur est survenue.";
      setMsg(
        raw.includes("URL and API key")
          ? "Mode démo : connectez le projet Supabase pour activer les comptes."
          : raw
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <Link href="/" className="mb-8 flex items-center justify-center gap-2">
        <BrandMark size={36} />
        <span className="text-lg font-semibold">
          Zabelie <span className="text-mist">Digi</span>
        </span>
      </Link>

      <div className="glass rounded-3xl p-7">
        <div className="mb-6 flex rounded-xl border border-line p-1 text-sm">
          <button
            onClick={() => setMode("signin")}
            className={`flex-1 rounded-lg py-2 transition ${
              mode === "signin" ? "bg-cloud text-ink" : "text-mist"
            }`}
          >
            Connexion
          </button>
          <button
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-lg py-2 transition ${
              mode === "signup" ? "bg-cloud text-ink" : "text-mist"
            }`}
          >
            Inscription
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Nom d'affichage"
              aria-label="Nom d'affichage"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-line bg-ink/40 px-4 py-3 text-sm outline-none focus:border-violet"
            />
          )}
          <input
            type="email"
            required
            placeholder="E-mail"
            aria-label="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-line bg-ink/40 px-4 py-3 text-sm outline-none focus:border-violet"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Mot de passe"
            aria-label="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-line bg-ink/40 px-4 py-3 text-sm outline-none focus:border-violet"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-ink transition hover:opacity-90 disabled:opacity-60"
          >
            {loading
              ? "…"
              : mode === "signin"
                ? "Se connecter"
                : "Créer mon compte"}
          </button>
        </form>

        {msg && <p className="mt-4 text-center text-xs text-mist">{msg}</p>}
      </div>

      <p className="mt-6 text-center text-xs text-mist">
        <Link href="/" className="hover:text-cloud">
          ← Retour à l'accueil
        </Link>
      </p>
    </div>
  );
}

export default function ConnexionPage() {
  return (
    <div className="bg-grain flex min-h-screen items-center justify-center px-5">
      {/* useSearchParams exige une frontière Suspense (App Router). */}
      <Suspense fallback={null}>
        <ConnexionForm />
      </Suspense>
    </div>
  );
}
