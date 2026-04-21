import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { findProductById } from "@/lib/products";
import { getDownloadByToken } from "@/lib/supabase-rest";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ token: string }>;
  },
) {
  const { token } = await context.params;
  const record = (await getDownloadByToken(token))[0];

  if (!record) {
    return NextResponse.json({ error: "Invalid download token." }, { status: 404 });
  }

  if (new Date(record.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "Download token expired." }, { status: 410 });
  }

  const product = findProductById(record.product_id);
  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const signedUrlResponse = await fetch(
    `${getEnv().NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/sign/digital-products/${product.filePath}`,
    {
      method: "POST",
      headers: {
        apikey: getEnv().SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${getEnv().SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: 60 }),
    },
  );

  if (!signedUrlResponse.ok) {
    return NextResponse.json({ error: `Failed to sign file URL: ${await signedUrlResponse.text()}` }, { status: 500 });
  }

  const payload = (await signedUrlResponse.json()) as { signedURL: string };

  return NextResponse.redirect(`${getEnv().NEXT_PUBLIC_SUPABASE_URL}/storage/v1${payload.signedURL}`, 302);
}
