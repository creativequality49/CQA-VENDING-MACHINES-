import { getServerSession, type NextAuthOptions, type Session } from "next-auth";

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

export async function requireUserSession(): Promise<Session> {
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
