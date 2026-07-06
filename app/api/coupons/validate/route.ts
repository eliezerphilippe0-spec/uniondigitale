import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizeCouponCode,
  couponApplies,
  discountedPriceHtg,
  type CouponRow,
} from "@/lib/zabelie-coupons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/coupons/validate  { productId, code }
 * Prévisualisation UI du prix remisé — ne CONSOMME PAS d'utilisation
 * (la consommation atomique a lieu au checkout). Réponse volontairement
 * binaire (valid + prix) : n'expose ni plafond, ni compteur, ni expiration.
 */
export async function POST(req: Request) {
  let body: { productId?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!body.productId || !body.code) {
    return NextResponse.json({ valid: false });
  }
  const code = normalizeCouponCode(body.code);
  if (!code) return NextResponse.json({ valid: false });

  const admin = createAdminClient();
  const { data: product } = await admin
    .from("products")
    .select("id, price_htg, seller_id")
    .eq("id", body.productId)
    .eq("status", "published")
    .maybeSingle();
  if (!product) return NextResponse.json({ valid: false });

  const { data: coupon } = await admin
    .from("zabelie_coupons")
    .select("id, seller_id, product_id, percent, max_uses, uses, expires_at, active")
    .eq("seller_id", product.seller_id)
    .eq("code", code)
    .maybeSingle();
  if (!coupon || !couponApplies(coupon as CouponRow, product.id, product.seller_id)) {
    return NextResponse.json({ valid: false });
  }

  const discounted = discountedPriceHtg(product.price_htg, coupon.percent);
  return NextResponse.json({
    valid: true,
    percent: coupon.percent,
    priceHtg: discounted,
    originalHtg: product.price_htg,
  });
}
