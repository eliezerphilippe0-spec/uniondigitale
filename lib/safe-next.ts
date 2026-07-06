/**
 * Validation de la destination post-connexion (?next=…) — anti open redirect.
 * N'accepte QUE des chemins internes relatifs. Rejette :
 *   - les URL absolues (https://…, moitié du phishing post-login) ;
 *   - les protocol-relative (//evil.com) ;
 *   - les backslashes ("/\\evil.com" : certains navigateurs les traitent
 *     comme des slashes) ;
 *   - tout ce qui ne commence pas par "/".
 * Testée dans tests/safe-next.test.ts — c'est une fonction de sécurité.
 */
export function safeNext(raw: string | null | undefined): string {
  if (
    typeof raw === "string" &&
    raw.startsWith("/") &&
    !raw.startsWith("//") &&
    !raw.includes("\\")
  ) {
    return raw;
  }
  return "/";
}
