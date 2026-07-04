import { cookies } from "next/headers";
import { LANG_COOKIE, isLang, type Lang } from "@/lib/i18n";

/** Langue courante côté serveur (cookie), FR par défaut. */
export async function getLang(): Promise<Lang> {
  const store = await cookies();
  const v = store.get(LANG_COOKIE)?.value;
  return isLang(v) ? v : "fr";
}
