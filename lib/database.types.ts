// Types du schéma Zabelie Talent (Vague 1).
// Reflètent supabase/migrations/0001_schema.sql.
// À terme, générables via `supabase gen types typescript`.

export type UserRole = "buyer" | "creator" | "admin";
export type ProductKind = "fichier" | "service";
export type ProductStatus = "draft" | "published" | "archived";
export type OrderStatus =
  | "pending"
  | "paid"
  | "delivered"
  | "cancelled"
  | "refunded"
  | "disputed";
export type PaymentRail = "moncash"; // 'natcash' en Vague 2 (bloqué)
export type PaymentStatus = "pending" | "confirmed" | "failed";
export type WalletTxnType = "credit" | "debit" | "payout";
export type PayoutStatus = "requested" | "processing" | "paid" | "rejected";

export type Profile = {
  id: string;
  role: UserRole;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  zabelie1_user_id: string | null;
  created_at: string;
};

export type Product = {
  id: string;
  seller_id: string;
  slug: string;
  title: string;
  description: string | null;
  kind: ProductKind;
  category: string | null;
  price_htg: number;
  cover_url: string | null;
  status: ProductStatus;
  sales_count: number;
  created_at: string;
};

export type ProductAsset = {
  id: string;
  product_id: string;
  storage_path: string;
  file_name: string;
  size_bytes: number | null;
  created_at: string;
};

export type Order = {
  id: string;
  buyer_id: string;
  product_id: string;
  amount_htg: number;
  status: OrderStatus;
  created_at: string;
};

export type Payment = {
  id: string;
  order_id: string;
  rail: PaymentRail;
  idempotency_key: string;
  provider_ref: string | null;
  status: PaymentStatus;
  raw: Record<string, unknown> | null;
  confirmed_at: string | null;
  created_at: string;
};

export type Wallet = {
  id: string;
  owner_id: string;
  balance_htg: number;
  created_at: string;
};

export type WalletTransaction = {
  id: string;
  wallet_id: string;
  type: WalletTxnType;
  amount_htg: number;
  order_id: string | null;
  idempotency_key: string | null;
  reference: string | null;
  created_at: string;
};

export type Payout = {
  id: string;
  wallet_id: string;
  amount_htg: number;
  status: PayoutStatus;
  created_at: string;
};
