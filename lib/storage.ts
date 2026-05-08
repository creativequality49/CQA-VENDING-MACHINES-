export async function createSignedDownloadUrl(assetKey: string) {
  const expiresIn = 60 * 10;
  const nonce = Math.random().toString(36).slice(2);
  return {
    url: `https://download.cqa.company/signed/${encodeURIComponent(assetKey)}?token=${nonce}`,
    expiresIn,
  };
}
