import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Limitation de débit (audit sécurité §6) — compteur à fenêtre fixe en
 * Postgres (zabelie_rate_limit, migration 0019), fiable en serverless.
 *
 * FAIL-OPEN assumé : si l'appel échoue (base injoignable), on laisse passer.
 * Dans ce scénario la requête échouera de toute façon deux lignes plus loin
 * sur son premier accès base — et une panne d'infra ne doit jamais bloquer
 * les ventes en silence.
 */
export async function rateLimit(
  admin: SupabaseClient,
  key: string,
  limit: number,
  windowSeconds = 60
): Promise<boolean> {
  try {
    const { data, error } = await admin.rpc("zabelie_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}

/**
 * Première IP de x-forwarded-for (posée par Vercel/le proxy) — clé de débit
 * pour les routes publiques sans utilisateur authentifié.
 */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "unknown";
}
