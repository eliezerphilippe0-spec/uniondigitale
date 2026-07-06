"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({ className = "" }: { className?: string }) {
  const router = useRouter();

  async function signOut() {
    try {
      await createClient().auth.signOut();
    } catch {
      // Supabase non configuré : on renvoie quand même à l'accueil.
    }
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      className={className || "text-sm text-mist transition hover:text-cloud"}
    >
      Déconnexion
    </button>
  );
}
