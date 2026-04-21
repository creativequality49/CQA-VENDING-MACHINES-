import { getEnv } from "./env";

type Method = "GET" | "POST" | "PATCH";

function getRestBaseUrl() {
  return `${getEnv().NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
}

async function supabaseRequest<T>(path: string, method: Method, body?: unknown): Promise<T> {
  const env = getEnv();
  const response = await fetch(`${getRestBaseUrl()}${path}`, {
    method,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Supabase REST error (${response.status}): ${await response.text()}`);
  }

  if (response.status === 204) {
    return [] as T;
  }

  return response.json() as Promise<T>;
}


export async function upsertProfile(params: { userId: string; email: string }) {
  return supabaseRequest(`/profiles?on_conflict=id`, "POST", {
    id: params.userId,
    email: params.email,
  });
}

export async function upsertOrder(params: {
  userId: string;
  productId: number;
  stripeSessionId: string;
  status: string;
}) {
  return supabaseRequest(`/orders?on_conflict=stripe_session_id`, "POST", {
    user_id: params.userId,
    product_id: params.productId,
    stripe_session_id: params.stripeSessionId,
    status: params.status,
  });
}

export async function createDownloadToken(params: {
  userId: string;
  productId: number;
  token: string;
  expiresAt: string;
}) {
  return supabaseRequest("/downloads", "POST", {
    user_id: params.userId,
    product_id: params.productId,
    download_token: params.token,
    expires_at: params.expiresAt,
  });
}

export async function getDownloadsForUser(userId: string) {
  return supabaseRequest<Array<{ id: number; product_id: number; expires_at: string; download_token: string }>>(
    `/downloads?user_id=eq.${userId}&select=id,product_id,expires_at,download_token&order=id.desc`,
    "GET",
  );
}

export async function getDownloadByToken(token: string) {
  return supabaseRequest<Array<{ id: number; user_id: string; product_id: number; expires_at: string }>>(
    `/downloads?download_token=eq.${token}&select=id,user_id,product_id,expires_at&limit=1`,
    "GET",
  );
}
