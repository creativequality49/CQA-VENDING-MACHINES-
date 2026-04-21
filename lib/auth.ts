import { cookies } from "next/headers";
import { getEnv } from "./env";

type AuthUser = {
  id: string;
  email?: string;
};

export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const accessToken =
    cookieStore.get("sb-access-token")?.value ||
    cookieStore
      .getAll()
      .find((item) => item.name.endsWith("-auth-token"))
      ?.value
      ?.split(",")[0]
      ?.replace(/^[\[]?\"?/, "")
      ?.replace(/\"?.*$/, "");

  if (!accessToken) {
    return null;
  }

  const response = await fetch(`${getEnv().NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: getEnv().NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const user = (await response.json()) as AuthUser;
  return user;
}
