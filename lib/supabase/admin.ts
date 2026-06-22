import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase "service role" — réservé au CÔTÉ SERVEUR (route handlers,
 * webhook, réconciliateur). Contourne la RLS : ne JAMAIS l'exposer au navigateur.
 *
 * Instancié par appel (et non au chargement du module) pour ne pas exiger les
 * variables d'env au build.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase admin: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant."
    );
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
