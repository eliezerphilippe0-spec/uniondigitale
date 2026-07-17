"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * BL-132 (FRONT-4) : pilote silencieusement la page « en attente » — dès que
 * confirm_payment (S2S) a tranché, redirige vers succès/échec. Ne fait
 * confiance qu'à la ligne `orders` (jamais écrite côté client, RLS lecture
 * seule) — jamais au polling lui-même comme preuve de paiement.
 */
export function OrderStatusPoll({ orderId }: { orderId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let polls = 0;
    const timer = setInterval(async () => {
      polls += 1;
      if (polls > 24) return clearInterval(timer); // ~4 min à 10 s (data chère, 3G)
      try {
        const { data } = await supabase
          .from("orders")
          .select("status, products(slug)")
          .eq("id", orderId)
          .maybeSingle();
        if (!data) return;
        if (data.status === "paid" || data.status === "delivered") {
          clearInterval(timer);
          router.push(`/paiement/succes?commande=${orderId}`);
        } else if (data.status === "cancelled" || data.status === "refunded") {
          clearInterval(timer);
          const prod = data.products as unknown as
            | { slug?: string }
            | { slug?: string }[]
            | null;
          const slug = Array.isArray(prod) ? prod[0]?.slug : prod?.slug;
          router.push(
            `/paiement/echec?raison=non_confirme${slug ? `&produit=${encodeURIComponent(slug)}` : ""}`
          );
        }
      } catch {
        /* réseau instable : on retentera au tick suivant */
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [orderId, router]);

  return null;
}
