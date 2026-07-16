-- ============================================================================
-- 0024 — Durcissements P0 (revue Team Agents 2026-07-15, BL-101 + BL-102)
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- BL-102 / C-5 — Intégrité de la preuve sociale.
-- La policy « products_seller_write_own » (0002) autorisait le vendeur à écrire
-- TOUTES les colonnes de sa ligne via PostgREST — y compris sales_count,
-- rating_sum, rating_count (censés n'être écrits que par confirm_payment et le
-- trigger reviews). Or AUCUNE écriture produit ne passe par le client : la
-- création (app/api/products) et la modération (product-status) utilisent le
-- service role. On retire donc toute écriture directe client (policy + grants,
-- ceinture et bretelles). La lecture (policies select de 0002) est inchangée.
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "products_seller_write_own" on products;
revoke insert, update, delete on products from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- BL-101 / C-1 — État terminal pour les paiements abandonnés.
-- Un checkout abandonné (l'acheteur ferme l'onglet avant de payer) laissait le
-- paiement 'pending' pour toujours : la fenêtre du réconciliateur (ASC limit 50)
-- finissait saturée de cadavres et un paiement réellement encaissé au-delà de
-- la fenêtre n'était plus jamais réconcilié (invariant n°3 violé à terme).
-- Pattern : expiration des sessions façon Stripe (checkout.session.expired).
--
-- Le réconciliateur appelle cette fonction quand MonCash ne connaît pas (404)
-- ou ne confirme pas le paiement ET que celui-ci a plus de 48 h. Garde-fous EN
-- BASE (pas seulement dans l'appelant) :
--   • no-op si le paiement n'est plus 'pending' (jamais toucher un confirmé) ;
--   • no-op si le paiement a moins de 48 h (une confirmation tardive reste
--     possible — confirm_payment demeure la seule vérité) ;
--   • la commande n'est annulée que si elle est encore 'pending'.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function zabelie_expire_stale_payment(
  p_idempotency_key text,
  p_reason          text default 'abandoned'
) returns payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment payments;
begin
  select * into v_payment
    from payments
   where idempotency_key = p_idempotency_key
   for update;

  if not found then
    raise exception 'zabelie_expire_stale_payment: aucun paiement pour %',
      p_idempotency_key;
  end if;

  -- Jamais toucher un paiement déjà terminal (confirmé/échoué) : no-op rejouable.
  if v_payment.status <> 'pending' then
    return v_payment;
  end if;

  -- Trop récent : une confirmation tardive reste possible → no-op.
  if v_payment.created_at > now() - interval '48 hours' then
    return v_payment;
  end if;

  update payments
     set status = 'failed',
         raw = coalesce(raw, '{}'::jsonb)
               || jsonb_build_object('expired_reason', p_reason,
                                     'expired_at', now())
   where id = v_payment.id
   returning * into v_payment;

  -- La commande est libérée uniquement si rien ne l'a fait avancer entre-temps.
  update orders
     set status = 'cancelled'
   where id = v_payment.order_id
     and status = 'pending';

  return v_payment;
end;
$$;
revoke all on function zabelie_expire_stale_payment(text, text)
  from public, anon, authenticated;
