"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type ResetPasswordLabels = {
  title: string;
  subtitle: string;
  passwordPh: string;
  confirmPh: string;
  mismatch: string;
  submit: string;
  submitting: string;
  success: string;
  invalid: string;
  signinCta: string;
  errorGeneric: string;
};

type Status = "checking" | "ready" | "invalid" | "done";

export function ResetPasswordForm({ labels }: { labels: ResetPasswordLabels }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    // /auth/callback a déjà échangé le code contre une session (recovery) —
    // ici on vérifie juste qu'elle existe avant d'exposer le formulaire.
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setStatus(data.user ? "ready" : "invalid");
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setMsg(labels.mismatch);
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setStatus("done");
      setTimeout(() => router.push("/connexion"), 2000);
    } catch {
      setMsg(labels.errorGeneric);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-grain flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="glass rounded-3xl p-7">
          <h1 className="text-lg font-semibold">{labels.title}</h1>

          {status === "checking" && <p className="mt-4 text-sm text-mist">…</p>}

          {status === "invalid" && (
            <>
              <p className="mt-4 text-sm text-mist">{labels.invalid}</p>
              <Link
                href="/connexion"
                className="mt-4 inline-block rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-ink"
              >
                {labels.signinCta}
              </Link>
            </>
          )}

          {status === "done" && <p className="mt-4 text-sm text-mist">{labels.success}</p>}

          {status === "ready" && (
            <>
              <p className="mt-2 text-sm text-mist">{labels.subtitle}</p>
              <form onSubmit={submit} className="mt-4 space-y-3">
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder={labels.passwordPh}
                  aria-label={labels.passwordPh}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-line bg-ink/40 px-4 py-3 text-sm outline-none focus:border-violet"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder={labels.confirmPh}
                  aria-label={labels.confirmPh}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-xl border border-line bg-ink/40 px-4 py-3 text-sm outline-none focus:border-violet"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-ink transition hover:opacity-90 disabled:opacity-60"
                >
                  {loading ? labels.submitting : labels.submit}
                </button>
              </form>
              {msg && <p className="mt-4 text-center text-xs text-mist">{msg}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
