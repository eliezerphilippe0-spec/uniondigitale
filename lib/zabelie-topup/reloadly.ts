/**
 * Adapter Reloadly (P1) — sandbox d'abord. https://developers.reloadly.com
 *
 * Idempotence : chaque topup est envoyé avec customIdentifier = order.id.
 * Reloadly REFUSE un customIdentifier déjà utilisé : un rejeu (timeout, retry)
 * ne peut donc jamais produire une double recharge — on retrouve alors la
 * transaction existante par son customIdentifier et on renvoie son état.
 */

import type {
  TopupOperator,
  TopupProduct,
  TopupProvider,
  TopupFulfillmentRequest,
  TopupFulfillmentResult,
  TopupStatus,
  ReconciliationReport,
} from "./provider";

const AUTH_URL = "https://auth.reloadly.com/oauth/token";

function bases(mode: "sandbox" | "production") {
  return mode === "production"
    ? "https://topups.reloadly.com"
    : "https://topups-sandbox.reloadly.com";
}

export function isReloadlyEnabled(): boolean {
  return Boolean(
    process.env.RELOADLY_CLIENT_ID && process.env.RELOADLY_CLIENT_SECRET
  );
}

function config() {
  const clientId = process.env.RELOADLY_CLIENT_ID;
  const clientSecret = process.env.RELOADLY_CLIENT_SECRET;
  const mode =
    (process.env.RELOADLY_MODE as "sandbox" | "production") ?? "sandbox";
  if (!clientId || !clientSecret) {
    throw new Error("Reloadly: RELOADLY_CLIENT_ID / RELOADLY_CLIENT_SECRET manquant.");
  }
  return { clientId, clientSecret, mode, base: bases(mode) };
}

async function getAccessToken(): Promise<string> {
  const { clientId, clientSecret, base } = config();
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
      audience: base,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Reloadly oauth: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Reloadly oauth: access_token absent.");
  return data.access_token;
}

async function api(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  const { base } = config();
  return fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/com.reloadly.topups-v1+json",
      ...init?.headers,
    },
    cache: "no-store",
  });
}

/** Mapping statut Reloadly → statut interne. */
export function mapReloadlyStatus(s: string | undefined | null): TopupStatus {
  const v = String(s ?? "").toUpperCase();
  if (v === "SUCCESSFUL") return "delivered";
  if (v === "PROCESSING" || v === "PENDING") return "pending";
  if (v === "FAILED" || v === "REFUNDED") return "failed";
  return "unknown";
}

type ReloadlyOperator = {
  operatorId: number;
  name: string;
  denominationType: "FIXED" | "RANGE";
  localFixedAmounts?: number[];
  supportsLocalAmounts?: boolean;
};

function matchesOperator(name: string, operator: TopupOperator): boolean {
  const n = name.toLowerCase();
  return operator === "digicel" ? n.includes("digicel") : n.includes("natcom");
}

async function findTransactionByOrderId(
  orderId: string
): Promise<{ providerRef: string; status: TopupStatus } | null> {
  const res = await api(
    `/topups/reports/transactions?customIdentifier=${encodeURIComponent(orderId)}&size=1`
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    content?: { transactionId?: number; status?: string }[];
  };
  const tx = data.content?.[0];
  if (!tx?.transactionId) return null;
  return { providerRef: String(tx.transactionId), status: mapReloadlyStatus(tx.status) };
}

export const reloadlyProvider: TopupProvider = {
  name: "reloadly",

  async getProducts(operator: TopupOperator): Promise<TopupProduct[]> {
    const res = await api(`/operators/countries/HT?includeData=true`);
    if (!res.ok) throw new Error(`Reloadly operators: ${res.status} ${await res.text()}`);
    const ops = (await res.json()) as ReloadlyOperator[];
    const products: TopupProduct[] = [];
    for (const op of ops) {
      if (!matchesOperator(op.name, operator)) continue;
      for (const amount of op.localFixedAmounts ?? []) {
        products.push({
          operator,
          providerProductId: String(op.operatorId),
          label: `${op.name} ${amount} HTG`,
          faceValueHtg: Math.round(amount),
          // Coûtant réel = montant local converti au taux + frais Reloadly ;
          // à affiner via le rapport de commissions (OPS_TODO).
          costHtg: Math.round(amount),
        });
      }
    }
    return products;
  },

  async fulfillTopup(
    order: TopupFulfillmentRequest
  ): Promise<TopupFulfillmentResult> {
    if (!order.providerProductId) {
      return {
        ok: false,
        retryable: false,
        error: "provider_product_id absent — synchroniser le catalogue Reloadly",
      };
    }
    const res = await api(`/topups`, {
      method: "POST",
      body: JSON.stringify({
        operatorId: Number(order.providerProductId),
        amount: order.faceValueHtg,
        useLocalAmount: true,
        customIdentifier: order.orderId, // idempotence côté fournisseur
        recipientPhone: {
          countryCode: "HT",
          number: order.beneficiaryPhone.slice(3), // 8 chiffres locaux
        },
      }),
    });

    const body = (await res.json().catch(() => null)) as {
      transactionId?: number;
      status?: string;
      message?: string;
    } | null;

    if (res.ok && body?.transactionId) {
      const status = mapReloadlyStatus(body.status);
      if (status === "failed") {
        return { ok: false, retryable: false, error: body.message ?? "FAILED", raw: body };
      }
      return { ok: true, providerRef: String(body.transactionId), raw: body };
    }

    // customIdentifier déjà utilisé = la recharge existe déjà (rejeu sûr).
    const message = body?.message ?? `HTTP ${res.status}`;
    if (/custom.?identifier/i.test(message)) {
      const existing = await findTransactionByOrderId(order.orderId);
      if (existing && existing.status !== "failed") {
        return { ok: true, providerRef: existing.providerRef, raw: body };
      }
      return { ok: false, retryable: false, error: message, raw: body };
    }

    // 5xx / réseau → retryable (même clé d'idempotence) ; 4xx métier → non.
    return { ok: false, retryable: res.status >= 500, error: message, raw: body };
  },

  async checkStatus(orderId: string): Promise<TopupStatus> {
    const found = await findTransactionByOrderId(orderId);
    return found?.status ?? "unknown";
  },

  async reconcile(since: Date): Promise<ReconciliationReport> {
    const start = since.toISOString().slice(0, 19).replace("T", " ");
    const res = await api(
      `/topups/reports/transactions?startDate=${encodeURIComponent(start)}&size=200`
    );
    if (!res.ok) throw new Error(`Reloadly reconcile: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as {
      content?: { transactionId?: number; customIdentifier?: string; status?: string }[];
    };
    return {
      since: since.toISOString(),
      entries: (data.content ?? [])
        .filter((t) => t.customIdentifier && t.transactionId)
        .map((t) => ({
          orderId: String(t.customIdentifier),
          providerRef: String(t.transactionId),
          status: mapReloadlyStatus(t.status),
        })),
    };
  },
};
