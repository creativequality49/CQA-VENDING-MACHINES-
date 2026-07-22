import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
