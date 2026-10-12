import { getServerSession, type NextAuthOptions, type Session } from "next-auth";
import { getPublicSupabaseClient } from "@/lib/cqa-marketplace";

export type AppUserRole = "customer" | "owner" | "admin" | "content_admin";

export const authOptions: NextAuthOptions = {
  providers: [],
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/"
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: AppUserRole }).role ?? "customer";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = (token.role as AppUserRole | undefined) ?? "customer";
      }
      return session;
    }
  }
};

export async function getAuthSession() {
  return getServerSession(authOptions);
}

export function isAdminRole(role?: string | null) {
  return role === "owner" || role === "admin" || role === "content_admin";
}

export async function requireUserSession(req?: Request): Promise<Session> {
  const authorization = req?.headers.get("authorization");
  if (authorization) {
    const match = /^Bearer\s+(\S+)$/i.exec(authorization);
    if (!match) throw new Error("Authentication required");
    const { data, error } = await getPublicSupabaseClient().auth.getUser(match[1]);
    if (error || !data.user) throw new Error("Authentication required");
    // User metadata can be edited by the account holder; never trust it for roles.
    const role = data.user.app_metadata?.role;
    return {
      user: { id: data.user.id, email: data.user.email, role: isAdminRole(role) ? role : "customer" },
      expires: new Date(Date.now() + 60_000).toISOString()
    };
  }
  const session = await getAuthSession();
  if (!session?.user?.id) {
    throw new Error("Authentication required");
  }
  return session;
}

export async function requireAdminSession(): Promise<Session> {
  const session = await requireUserSession();
  if (!isAdminRole(session.user.role)) {
    throw new Error("Admin access required");
  }
  return session;
}
