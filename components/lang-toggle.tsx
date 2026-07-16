"use client";

import { useRouter } from "next/navigation";
import { LANG_COOKIE, type Lang } from "@/lib/i18n";

/** Bascule FR / Kreyòl — cookie 1 an, puis re-rendu serveur. */
export function LangToggle({ current }: { current: Lang }) {
  const router = useRouter();

  function set(lang: Lang) {
    if (lang === current) return;
    document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  const btn = (lang: Lang, label: string, title: string) => (
    <button
      onClick={() => set(lang)}
      title={title}
      aria-pressed={current === lang}
      className={`rounded-md px-3 py-2 transition ${
        current === lang ? "bg-cloud font-semibold text-ink" : "text-mist hover:text-cloud"
      }`}
    >
      {label}
    </button>
  );

  // BL-124 : zones tactiles élargies (~40 px) — c'était ~22×18 px sur LE
  // bouton de bascule de langue, sur Android bas de gamme.
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-line p-0.5 text-xs">
      {btn("fr", "FR", "Français")}
      {btn("ht", "KR", "Kreyòl ayisyen")}
    </div>
  );
}
