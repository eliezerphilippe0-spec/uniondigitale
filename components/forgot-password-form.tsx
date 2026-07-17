"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export type ForgotPasswordLabels = {
  title: string;
  subtitle: string;
  emailPh: string;
  submit: string;
  sending: string;
  success: string;
  back: string;
  errorGeneric: string;
  demoMode: string;
};

export function ForgotPasswordForm({ labels }: { labels: ForgotPasswordLabels }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const supabase = createClient();
      const site = window.location.origin;
      // Message identique succès/échec (pas d'énumération de comptes) : le
      // formulaire ne révèle jamais si l'e-mail existe.
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${site}/auth/callback?next=/reinitialiser-mot-de-passe`,
      });
      setDone(true);
    } catch (err) {
      const raw = err instanceof Error ? err.message : labels.errorGeneric;
      setMsg(raw.includes("URL and API key") ? labels.demoMode : labels.errorGeneric);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-grain flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="glass rounded-3xl p-7">
          <h1 className="text-lg font-semibold">{labels.title}</h1>
          {done ? (
            <p className="mt-4 text-sm text-mist">{labels.success}</p>
          ) : (
            <>
              <p className="mt-2 text-sm text-mist">{labels.subtitle}</p>
              <form onSubmit={submit} className="mt-4 space-y-3">
                <input
                  type="email"
                  required
                  placeholder={labels.emailPh}
                  aria-label={labels.emailPh}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-line bg-ink/40 px-4 py-3 text-sm outline-none focus:border-violet"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-ink transition hover:opacity-90 disabled:opacity-60"
                >
                  {loading ? labels.sending : labels.submit}
                </button>
              </form>
              {msg && <p className="mt-4 text-center text-xs text-mist">{msg}</p>}
            </>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-mist">
          <Link href="/connexion" className="hover:text-cloud">
            {labels.back}
          </Link>
        </p>
      </div>
    </div>
  );
}
