import { NextResponse } from "next/server";
import { requireUserSession } from "@/lib/auth";
import { getProductById } from "@/lib/catalog";
import { hasEntitlement, logDownload } from "@/lib/entitlements";
import { createSignedDownloadUrl } from "@/lib/storage";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");
  const userAgent = req.headers.get("user-agent");

  if (!productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }

  let session;
  try {
    session = await requireUserSession();
  } catch {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const product = getProductById(productId);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  if (!(await hasEntitlement(session.user.id, productId))) {
    await logDownload({
      userId: session.user.id,
      productId,
      assetKey: product.assetKey,
      status: "denied",
      userAgent
    });
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const { url, expiresIn, expiresAt } = await createSignedDownloadUrl(product.assetKey);
  await logDownload({
    userId: session.user.id,
    productId,
    assetKey: product.assetKey,
    status: "signed",
    expiresAt,
    userAgent
  });

  return NextResponse.json({ url, expiresIn });
}
