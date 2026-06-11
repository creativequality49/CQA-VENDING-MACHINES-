import AWS from "aws-sdk";

const signedUrlExpiresIn = 60 * 10;

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing R2 storage configuration");
  }

  return new AWS.S3({
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    accessKeyId,
    secretAccessKey,
    signatureVersion: "v4",
    region: "auto"
  });
}

export async function createSignedDownloadUrl(assetKey: string) {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error("Missing R2_BUCKET");

  const storage = getR2Client();
  const url = await storage.getSignedUrlPromise("getObject", {
    Bucket: bucket,
    Key: assetKey,
    Expires: signedUrlExpiresIn
  });

  return {
    url,
    expiresIn: signedUrlExpiresIn,
    expiresAt: new Date(Date.now() + signedUrlExpiresIn * 1000).toISOString()
  };
}
