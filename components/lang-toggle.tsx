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
      className={`rounded-md px-1.5 py-0.5 transition ${
        current === lang ? "bg-cloud font-semibold text-ink" : "text-mist hover:text-cloud"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-line p-0.5 text-[11px]">
      {btn("fr", "FR", "Français")}
      {btn("ht", "KR", "Kreyòl ayisyen")}
    </div>
  );
}
