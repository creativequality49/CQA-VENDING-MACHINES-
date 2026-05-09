import { NextResponse } from "next/server";
import { getProductById } from "@/lib/catalog";
import { hasEntitlement } from "@/lib/mock-store";
import { createSignedDownloadUrl } from "@/lib/storage";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");
  const userId = searchParams.get("userId") ?? "anonymous";

  if (!productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }

  const product = getProductById(productId);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  if (!hasEntitlement(userId, productId)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { url, expiresIn } = await createSignedDownloadUrl(product.assetKey);
  return NextResponse.json({ url, expiresIn });
}
