import * as WebBrowser from "expo-web-browser";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { Session } from "@supabase/supabase-js";

import {
  clearGuestId,
  clearSession,
  getOrCreateGuestId,
  loadSession,
  saveSession,
} from "@/services/sessionStore";
import { setTokenRefresher } from "@/services/api";
import {
  exchangeOAuthCode,
  getOAuthRedirectUri,
  getSupabaseClient,
} from "@/services/supabase";

export type AuthStatus = "restoring" | "signedOut" | "guest" | "signedIn";

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  guestId: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  googleSignIn: () => Promise<void>;
  signInAsGuest: () => Promise<void>;
  migrateGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  handleUnauthorized: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

let refreshInFlight: Promise<string | null> | null = null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("restoring");
  const [session, setSession] = useState<Session | null>(null);
  const [guestId, setGuestId] = useState<string | null>(null);

  const refreshToken = useCallback(async (): Promise<string | null> => {
    if (refreshInFlight !== null) {
      return refreshInFlight;
    }
    refreshInFlight = (async (): Promise<string | null> => {
      const stored = await loadSession();
      if (stored === null || stored.refresh_token === undefined) {
        return null;
      }
      const { data, error } = await getSupabaseClient().auth.refreshSession({
        refresh_token: stored.refresh_token,
      });
      if (error !== null || data.session === null) {
        await clearSession();
        return null;
      }
      await saveSession(data.session);
      setSession(data.session);
      setStatus("signedIn");
      return data.session.access_token;
    })();
    try {
      return await refreshInFlight;
    } finally {
      refreshInFlight = null;
    }
  }, []);

  useEffect(() => {
    setTokenRefresher(refreshToken);
    return () => setTokenRefresher(null);
  }, [refreshToken]);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      try {
        const stored = await loadSession();
        if (stored !== null) {
          let sess = stored;
          const isExpired =
            stored.expires_at === undefined || stored.expires_at === null || stored.expires_at * 1000 <= Date.now();
          if (isExpired) {
            const refreshed = await refreshToken();
            if (refreshed === null) {
              if (!cancelled) {
                setSession(null);
                setStatus("signedOut");
              }
              return;
            }
            const reloaded = await loadSession();
            if (reloaded !== null) {
              sess = reloaded;
            }
          }
          if (!cancelled) {
            setSession(sess);
            setStatus("signedIn");
          }
          return;
        }
        // No session — restore (or repair) the guest identity
        const existingGuest = await getOrCreateGuestId();
        if (!cancelled) {
          setGuestId(existingGuest);
          setStatus("guest");
          return;
        }
        if (!cancelled) {
          setStatus("signedOut");
        }
      } catch {
        if (!cancelled) {
          setSession(null);
          setStatus("signedOut");
        }
      }
    }

    void restore();

    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await getSupabaseClient().auth.signInWithPassword({
      email,
      password,
    });
    if (error !== null) {
      throw new Error(error.message);
    }
    if (data.session === null) {
      throw new Error("Sign in did not return a session.");
    }
    await saveSession(data.session);
    setSession(data.session);
    setStatus("signedIn");
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await getSupabaseClient().auth.signUp({ email, password });
    if (error !== null) {
      throw new Error(error.message);
    }
    if (data.session === null) {
      throw new Error(
        "Account created — check your inbox to confirm your email before signing in.",
      );
    }
    await saveSession(data.session);
    setSession(data.session);
    setStatus("signedIn");
  }, []);

  const googleSignIn = useCallback(async () => {
    const redirectTo = getOAuthRedirectUri();
    const { data, error } = await getSupabaseClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });
    if (error !== null) {
      throw new Error(error.message);
    }
    if (data.url === null) {
      throw new Error("Could not start Google sign in.");
    }
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== "success") {
      return;
    }
    const oauthSession = await exchangeOAuthCode(result.url);
    await saveSession(oauthSession);
    setSession(oauthSession);
    setStatus("signedIn");
  }, []);

  const signInAsGuest = useCallback(async () => {
    const id = await getOrCreateGuestId();
    setGuestId(id);
    setStatus("guest");
  }, []);

  const migrateGuest = useCallback(async () => {
    // No-op if not a guest
    if (guestId === null) {
      return;
    }
    // After successful sign-in/up, the migration is called by the screen
    // that triggered the auth action. Clear guest state once migration succeeds.
    await clearGuestId();
    setGuestId(null);
  }, [guestId]);

  const signOut = useCallback(async () => {
    await getSupabaseClient().auth.signOut();
    await clearSession();
    await clearGuestId();
    setSession(null);
    setGuestId(null);
    setStatus("signedOut");
  }, []);

  const handleUnauthorized = useCallback(async () => {
    await clearSession();
    setSession(null);
    setStatus("signedOut");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      guestId,
      signIn,
      signUp,
      googleSignIn,
      signInAsGuest,
      migrateGuest,
      signOut,
      handleUnauthorized,
    }),
    [status, session, guestId, signIn, signUp, googleSignIn, signInAsGuest, migrateGuest, signOut, handleUnauthorized],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
