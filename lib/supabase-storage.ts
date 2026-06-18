import { isSupabaseConfigured } from "./env";

export async function createSupabaseSignedUrl(filePath: string, expiresIn = 900) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase storage is not configured");
  }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET!;
  const token = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");

  const response = await fetch(`${baseUrl}/storage/v1/object/sign/${bucket}/${encodedPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn }),
  });

  if (!response.ok) {
    throw new Error(`Unable to create signed URL: ${response.status}`);
  }

  const data = (await response.json()) as { signedURL?: string; signedUrl?: string };
  const signedPath = data.signedURL ?? data.signedUrl;
  if (!signedPath) throw new Error("Supabase did not return a signed URL");

  return signedPath.startsWith("http") ? signedPath : `${baseUrl}/storage/v1${signedPath}`;
}

export async function uploadPrivateSupabaseObject(filePath: string, file: File) {
  if (!isSupabaseConfigured()) throw new Error("Supabase storage is not configured");
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET!;
  const token = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${baseUrl}/storage/v1/object/${bucket}/${encodedPath}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, apikey: token, "Content-Type": file.type || "application/octet-stream", "x-upsert": "true" },
    body: file,
  });
  if (!response.ok) throw new Error(`Unable to upload private object: ${response.status}`);
  return filePath;
}
