"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = ["draft", "published", "archived"] as const;

export function AdminProductRow({
  id,
  title,
  seller,
  status,
}: {
  id: string;
  title: string;
  seller: string;
  status: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [saving, setSaving] = useState(false);

  async function change(next: string) {
    const prev = value;
    setValue(next);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/product-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: id, status: next }),
      });
      if (!res.ok) {
        setValue(prev);
      } else {
        router.refresh();
      }
    } catch {
      setValue(prev);
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/60 px-4 py-3 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium">{title}</p>
        <p className="text-xs text-mist">par {seller}</p>
      </div>
      <select
        value={value}
        disabled={saving}
        onChange={(e) => change(e.target.value)}
        className="shrink-0 rounded-lg border border-line bg-ink/40 px-3 py-1.5 text-xs outline-none focus:border-violet disabled:opacity-60"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </li>
  );
}
