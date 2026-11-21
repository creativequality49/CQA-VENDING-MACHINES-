"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/cqa-marketplace";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

type Identity = {
  status: "loading" | "ready" | "unavailable" | "signed_out";
  key: string;
  email: string;
  error: string;
};
export class CustomerRequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export function useCustomerSession(nextPath: string) {
  const router = useRouter();
  const [identity, setIdentity] = useState<Identity>({
    status: "loading",
    key: "",
    email: "",
    error: "",
  });
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const session = useRef<Session | null>(null);
  const generation = useRef(0);
  const requests = useRef(new Set<AbortController>());
  const client = useRef<SupabaseClient | null>(null);
  const alive = useRef(false);
  const clearRequests = useCallback(() => {
    generation.current++;
    requests.current.forEach((request) => request.abort());
    requests.current.clear();
  }, []);
  const signIn = useCallback(() => {
    clearRequests();
    session.current = null;
    if (alive.current)
      setIdentity({ status: "signed_out", key: "", email: "", error: "" });
    router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
  }, [clearRequests, nextPath, router]);
  useEffect(() => {
    alive.current = true;
    let active = true;
    let eventVersion = 0;
    let unsubscribe: (() => void) | undefined;
    function apply(value: Session | null) {
      if (!active || !alive.current) return;
      // Supabase may repeat SIGNED_IN when a tab regains focus. An unchanged
      // account/token must not remount a project brief and discard unsaved text.
      if (value && session.current?.user.id === value.user.id &&
          session.current.access_token === value.access_token) {
        session.current = value;
        setIdentity((current) => ({ ...current, email: value.user.email || "Your account" }));
        return;
      }
      clearRequests();
      session.current = value;
      if (!value) {
        signIn();
        return;
      }
      setIdentity({
        status: "ready",
        key: `${value.user.id}:${generation.current}`,
        email: value.user.email || "Your account",
        error: "",
      });
    }
    try {
      const supabase = getBrowserSupabaseClient();
      client.current = supabase;
      const { data } = supabase.auth.onAuthStateChange((_event, value) => {
        eventVersion++;
        apply(value);
      });
      unsubscribe = () => data.subscription.unsubscribe();
      const version = eventVersion;
      void supabase.auth
        .getSession()
        .then(({ data: result, error }) => {
          if (!active || !alive.current || version !== eventVersion) return;
          if (error) throw error;
          apply(result.session);
        })
        .catch(() => {
          if (active && alive.current && version === eventVersion) {
            clearRequests();
            session.current = null;
            setIdentity({
              status: "unavailable",
              key: "",
              email: "",
              error:
                "Your account session could not be checked. Reload to try again.",
            });
          }
        });
    } catch {
      setIdentity({
        status: "unavailable",
        key: "",
        email: "",
        error:
          "Account access is currently unavailable. Please contact support or try again later.",
      });
    }
    return () => {
      active = false;
      alive.current = false;
      clearRequests();
      session.current = null;
      unsubscribe?.();
    };
  }, [clearRequests, signIn]);
  const request = useCallback(
    async <T>(path: string, options: RequestInit = {}): Promise<T> => {
      const currentSession = session.current;
      if (!currentSession) {
        signIn();
        throw new DOMException("Session changed", "AbortError");
      }
      const currentGeneration = generation.current;
      const controller = new AbortController();
      requests.current.add(controller);
      const externalAbort = () => controller.abort();
      options.signal?.addEventListener("abort", externalAbort, { once: true });
      if (options.signal?.aborted) controller.abort();
      try {
        const response = await fetch(path, {
          ...options,
          headers: {
            ...Object.fromEntries(new Headers(options.headers).entries()),
            Authorization: `Bearer ${currentSession.access_token}`,
          },
          cache: "no-store",
          signal: controller.signal,
        });
        if (!alive.current || currentGeneration !== generation.current)
          throw new DOMException("Session changed", "AbortError");
        if (response.status === 401) {
          signIn();
          throw new DOMException("Session expired", "AbortError");
        }
        const payload = await response.json().catch(() => null);
        if (!alive.current || currentGeneration !== generation.current)
          throw new DOMException("Session changed", "AbortError");
        if (!response.ok)
          throw new CustomerRequestError(
            typeof payload?.error === "string"
              ? payload.error
              : "This request could not be completed. Please try again.",
            response.status,
          );
        if (!payload)
          throw new CustomerRequestError(
            "An unexpected response was received. Please try again.",
            response.status,
          );
        return payload as T;
      } finally {
        requests.current.delete(controller);
        options.signal?.removeEventListener("abort", externalAbort);
      }
    },
    [signIn],
  );
  const logout = useCallback(async () => {
    setLoggingOut(true);
    setLogoutError("");
    clearRequests();
    session.current = null;
    setIdentity({ status: "signed_out", key: "", email: "", error: "" });
    try {
      const result = await client.current?.auth.signOut();
      if (result?.error) throw result.error;
      router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
    } catch {
      if (alive.current)
        setLogoutError("Sign out could not be completed. Please try again.");
    } finally {
      if (alive.current) setLoggingOut(false);
    }
  }, [clearRequests, nextPath, router]);
  return { ...identity, request, logout, loggingOut, logoutError };
}
