import type { DefaultSession } from "next-auth";
import type { AppUserRole } from "@/lib/auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: AppUserRole;
    };
  }

  interface User {
    role?: AppUserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: AppUserRole;
  }
}
