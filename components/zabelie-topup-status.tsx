"use client";

import { useEffect, useState } from "react";

/**
 * Statut temps réel d'une recharge — polling léger (JSON minuscule, toutes
 * les 5 s, 3G-friendly), arrêt sur état terminal. La vérité vient du serveur.
 */
export function ZabelieTopupStatus({
  orderId,
  initialStatus,
  labels,
}: {
  orderId: string;
  initialStatus: string;
  labels: Record<string, string>;
}) {
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    const terminal = ["delivered", "refunded"];
    if (terminal.includes(status)) return;
    let polls = 0;
    const timer = setInterval(async () => {
      polls += 1;
      if (polls > 120) return clearInterval(timer); // ~10 min max
      try {
        const res = await fetch(`/api/zabelie/topup/orders/${orderId}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.status && data.status !== status) setStatus(data.status);
        if (terminal.includes(data.status)) clearInterval(timer);
      } catch {
        /* réseau instable : on retentera au tick suivant */
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [orderId, status]);

  const tone =
    status === "delivered"
      ? "border-success/50 text-success-text"
      : status === "failed" || status === "refund_pending"
        ? "border-danger/50 text-danger-text"
        : status === "refunded"
          ? "border-warning/50 text-warning-text"
          : "border-line text-cloud";

  return (
    <div className={`rounded-2xl border bg-surface/60 p-5 text-sm ${tone}`}>
      <p className="font-semibold">
        {labels[status] ?? status}
        {!["delivered", "refunded", "failed", "refund_pending"].includes(status) && (
          <span className="ml-2 inline-block animate-pulse">●</span>
        )}
      </p>
    </div>
  );
}
