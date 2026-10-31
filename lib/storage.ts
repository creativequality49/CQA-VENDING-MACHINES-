import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { MAX_MARKETPLACE_ASSET_BYTES, MARKETPLACE_ASSET_EXTENSIONS } from "@/lib/cqa-marketplace-assets";

const signedUrlExpiresIn = 60 * 10;

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing R2 storage configuration");
  }

  return new S3Client({
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey
    },
    region: "auto"
  });
}

export async function createSignedDownloadUrl(assetKey: string) {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error("Missing R2_BUCKET");

  const storage = getR2Client();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: assetKey
  });
  const url = await getSignedUrl(storage, command, {
    expiresIn: signedUrlExpiresIn
  });

  return {
    url,
    expiresIn: signedUrlExpiresIn,
    expiresAt: new Date(Date.now() + signedUrlExpiresIn * 1000).toISOString()
  };
}

/** Private server-side upload. Never use the public machine-media bucket. */
export async function uploadPrivateMarketplaceAsset(key: string, data: Uint8Array, contentType: string) {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error("Missing R2_BUCKET");
  await getR2Client().send(new PutObjectCommand({
    Bucket: bucket, Key: key, Body: data, ContentType: contentType,
    ContentLength: data.byteLength, ContentDisposition: "attachment",
    CacheControl: "private, no-store"
  }));
}

/** Check the attached object before selling it; never creates a public URL. */
export async function verifyPrivateMarketplaceAsset(key: string, expectedSize: number, expectedType: string): Promise<boolean> {
  if (!Number.isSafeInteger(expectedSize) || expectedSize < 1 || expectedSize > MAX_MARKETPLACE_ASSET_BYTES ||
      !Object.hasOwn(MARKETPLACE_ASSET_EXTENSIONS, expectedType)) return false;
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error("Missing private storage configuration");
  const object = await getR2Client().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  return object.ContentLength === expectedSize && object.ContentType?.split(";")[0].trim() === expectedType;
}
