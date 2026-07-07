/**
 * Client MonCash (Digicel Haïti) — rail de paiement du MVP (docs/03-PAIEMENTS.md).
 *
 * Flux :
 *   1. getAccessToken()         — OAuth client_credentials.
 *   2. createPayment()          — crée une session, renvoie l'URL de redirection.
 *   3. retrieveOrderPayment()   — vérification SERVEUR-À-SERVEUR (INVARIANT 2).
 *
 * On ne fait JAMAIS confiance au seul retour navigateur : la vérité vient de
 * retrieveOrderPayment(), appelée au retour ET par le réconciliateur.
 */

type MonCashMode = "sandbox" | "production";

function bases(mode: MonCashMode) {
  return mode === "production"
    ? {
        rest: "https://moncashbutton.digicel.com/Api",
        gateway: "https://moncashbutton.digicel.com/Moncash-middleware",
      }
    : {
        rest: "https://sandbox.moncashbutton.digicel.com/Api",
        gateway: "https://sandbox.moncashbutton.digicel.com/Moncash-middleware",
      };
}

function config() {
  const clientId = process.env.MONCASH_CLIENT_ID;
  const clientSecret = process.env.MONCASH_CLIENT_SECRET;
  const mode = (process.env.MONCASH_MODE as MonCashMode) ?? "sandbox";

  if (!clientId || !clientSecret) {
    throw new Error(
      "MonCash: MONCASH_CLIENT_ID / MONCASH_CLIENT_SECRET manquant."
    );
  }
  return { clientId, clientSecret, mode, ...bases(mode) };
}

export async function getAccessToken(): Promise<string> {
  const { clientId, clientSecret, rest } = config();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(`${rest}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "scope=read,write&grant_type=client_credentials",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`MonCash oauth: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("MonCash oauth: access_token absent.");
  return data.access_token;
}

export type CreatePaymentResult = {
  paymentToken: string;
  redirectUrl: string;
};

/**
 * Crée une session de paiement. `orderId` doit être unique côté MonCash et
 * sert de clé de rapprochement (on y stocke notre order.id).
 */
export async function createPayment(
  orderId: string,
  amountHTG: number
): Promise<CreatePaymentResult> {
  const token = await getAccessToken();
  const { rest, gateway } = config();

  const res = await fetch(`${rest}/v1/CreatePayment`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ amount: amountHTG, orderId }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`MonCash CreatePayment: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    payment_token?: { token?: string };
  };
  const paymentToken = data.payment_token?.token;
  if (!paymentToken) throw new Error("MonCash CreatePayment: token absent.");

  return {
    paymentToken,
    redirectUrl: `${gateway}/Payment/Redirect?token=${paymentToken}`,
  };
}

export type MonCashPayment = {
  reference: string; // notre orderId
  transactionId: string;
  cost: number;
  message: string;
  payer: string;
  status: "successful" | "failed" | "pending" | string;
};

/**
 * Vérifie l'état réel d'un paiement côté MonCash, par notre orderId.
 * C'est l'appel de vérité (INVARIANT 2) utilisé au retour et par le réconciliateur.
 * Renvoie null si MonCash ne connaît pas encore de paiement pour cet orderId.
 */
export async function retrieveOrderPayment(
  orderId: string
): Promise<MonCashPayment | null> {
  const token = await getAccessToken();
  const { rest } = config();

  const res = await fetch(`${rest}/v1/RetrieveOrderPayment`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ orderId }),
    cache: "no-store",
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(
      `MonCash RetrieveOrderPayment: ${res.status} ${await res.text()}`
    );
  }
  const data = (await res.json()) as { payment?: MonCashPayment };
  return data.payment ?? null;
}

/**
 * Vérifie un paiement par son transactionId MonCash (ce que le retour navigateur
 * fournit). `reference` du résultat = notre orderId.
 */
export async function retrieveTransactionPayment(
  transactionId: string
): Promise<MonCashPayment | null> {
  const token = await getAccessToken();
  const { rest } = config();

  const res = await fetch(`${rest}/v1/RetrieveTransactionPayment`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ transactionId }),
    cache: "no-store",
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(
      `MonCash RetrieveTransactionPayment: ${res.status} ${await res.text()}`
    );
  }
  const data = (await res.json()) as { payment?: MonCashPayment };
  return data.payment ?? null;
}

/** Statut MonCash → décision applicative. */
export function isSuccessful(p: MonCashPayment | null): boolean {
  return p?.status === "successful";
}

/**
 * Minimisation RGPD avant stockage dans payments.raw : on conserve ce qui sert à
 * la réconciliation/l'audit (référence, transaction, montant, statut, message)
 * mais on RETIRE l'identifiant du payeur (téléphone/compte), donnée personnelle
 * inutile à la vérité du paiement. On garde juste un booléen de présence.
 */
export function redactPayment(p: MonCashPayment): Record<string, unknown> {
  const { payer: _payer, ...rest } = p;
  return { ...rest, payer_present: Boolean(_payer) };
}
