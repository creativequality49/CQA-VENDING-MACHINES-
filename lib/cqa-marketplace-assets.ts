// Leave room for multipart fields below Vercel's 4.5 MB request-body limit.
export const MAX_MARKETPLACE_ASSET_BYTES = 4 * 1024 * 1024;
export const MAX_MARKETPLACE_UPLOAD_BODY_BYTES = MAX_MARKETPLACE_ASSET_BYTES + 64 * 1024;
export const MARKETPLACE_ASSET_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf", "application/zip": "zip", "image/png": "png",
  "image/jpeg": "jpg", "text/plain": "txt"
};

export class MarketplaceUploadError extends Error {
  constructor(public status: 400 | 413, message: string) { super(message); }
}

export function validateMarketplaceAsset(bytes: Uint8Array, contentType: string): boolean {
  if (!bytes.length || bytes.length > MAX_MARKETPLACE_ASSET_BYTES) return false;
  const starts = (signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  if (contentType === "application/pdf") return starts([0x25, 0x50, 0x44, 0x46, 0x2d]);
  if (contentType === "application/zip") return starts([0x50, 0x4b, 0x03, 0x04]) || starts([0x50, 0x4b, 0x05, 0x06]) || starts([0x50, 0x4b, 0x07, 0x08]);
  if (contentType === "image/png") return starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (contentType === "image/jpeg") return starts([0xff, 0xd8, 0xff]);
  if (contentType === "text/plain") {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text);
    } catch { return false; }
  }
  return false;
}

/** Bound both declared and chunked bodies before multipart parsing allocates file buffers. */
export async function readMarketplaceUploadForm(req: Request): Promise<FormData> {
  const contentType = req.headers.get("content-type") || "";
  if (!/^multipart\/form-data\s*;/i.test(contentType) || !req.body)
    throw new MarketplaceUploadError(400, "Choose a product file to upload.");
  const length = req.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length))))
    throw new MarketplaceUploadError(400, "Invalid upload length.");
  if (length && Number(length) > MAX_MARKETPLACE_UPLOAD_BODY_BYTES)
    throw new MarketplaceUploadError(413, "The file must be 4 MB or smaller.");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_MARKETPLACE_UPLOAD_BODY_BYTES) {
        await reader.cancel();
        throw new MarketplaceUploadError(413, "The file must be 4 MB or smaller.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  try { return await new Response(body, { headers: { "content-type": contentType } }).formData(); }
  catch { throw new MarketplaceUploadError(400, "The upload could not be read. Choose the file again."); }
}
