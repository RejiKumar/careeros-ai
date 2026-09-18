import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import type { Session } from "@supabase/supabase-js";

import {
  clearGuestId,
  clearSession,
  getOrCreateGuestId,
  loadSession,
  saveSession,
} from "@/services/sessionStore";
import { removeFCMTokenOnSignOut } from "@/lib/notifications";
import { setTokenRefresher } from "@/services/api";
import {
  exchangeOAuthCode,
  getOAuthRedirectUri,
  getSupabaseClient,
  isOAuthRedirectUrl,
} from "@/services/supabase";

export type AuthStatus = "restoring" | "signedOut" | "guest" | "signedIn";

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  guestId: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  googleSignIn: () => Promise<boolean>;
  signInAsGuest: () => Promise<void>;
  migrateGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  handleUnauthorized: () => Promise<void>;
  handleOAuthRedirect: (url: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

let refreshInFlight: Promise<string | null> | null = null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("restoring");
  const [session, setSession] = useState<Session | null>(null);
  const [guestId, setGuestId] = useState<string | null>(null);
  const oauthInFlightUrl = useRef<{ url: string; promise: Promise<void> } | null>(null);
  const oauthHandledUrl = useRef<string | null>(null);
  const oauthSessionActive = useRef(false);
  const authStatusRef = useRef<AuthStatus>("restoring");

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
            stored.expires_at === undefined ||
            stored.expires_at === null ||
            stored.expires_at * 1000 <= Date.now();
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
        // No session — restore (or repair) the guest identity, but land on
        // the login screen so a fresh launch asks the user to sign in or
        // continue as guest.
        const existingGuest = await getOrCreateGuestId();
        if (!cancelled) {
          setGuestId(existingGuest);
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
    const { data, error } = await getSupabaseClient().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getOAuthRedirectUri(),
      },
    });
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

  const handleOAuthRedirect = useCallback(async (url: string) => {
    if (!isOAuthRedirectUrl(url)) {
      return;
    }
    if (oauthHandledUrl.current === url) {
      return;
    }
    if (oauthInFlightUrl.current !== null && oauthInFlightUrl.current.url === url) {
      return oauthInFlightUrl.current.promise;
    }
    const promise = (async () => {
      const oauthSession = await exchangeOAuthCode(url);
      await saveSession(oauthSession);
      oauthHandledUrl.current = url;
      setSession(oauthSession);
      setStatus("signedIn");
    })();
    oauthInFlightUrl.current = { url, promise };
    try {
      await promise;
    } catch (err) {
      console.debug(
        `[careeros-oauth] exchange failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    } finally {
      if (oauthInFlightUrl.current?.url === url) {
        oauthInFlightUrl.current = null;
      }
    }
  }, []);

  const googleSignIn = useCallback(async (): Promise<boolean> => {
    if (oauthSessionActive.current) {
      return false;
    }
    oauthSessionActive.current = true;
    try {
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
      await WebBrowser.openBrowserAsync(data.url);
      return authStatusRef.current === "signedIn";
    } finally {
      oauthSessionActive.current = false;
    }
  }, []);

  useEffect(() => {
    authStatusRef.current = status;
  }, [status]);

  useEffect(() => {
    const subscription = Linking.addEventListener("url", (event) => {
      void handleOAuthRedirect(event.url).catch(() => {
        // Deep links without a valid OAuth payload are ignored.
      });
    });
    void Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl !== null) {
        void handleOAuthRedirect(initialUrl).catch(() => {
          // Deep links without a valid OAuth payload are ignored.
        });
      }
    });
    return () => subscription.remove();
  }, [handleOAuthRedirect]);

  useEffect(() => {
    const { data } = getSupabaseClient().auth.onAuthStateChange(
      (event, newSession) => {
        console.debug(`[careeros-oauth] auth event=${event}`);
        if (event === "INITIAL_SESSION") {
          return;
        }
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          if (newSession !== null) {
            void saveSession(newSession);
            setSession(newSession);
            setStatus("signedIn");
          }
        } else if (event === "SIGNED_OUT") {
          void clearSession();
          setSession(null);
          setStatus("signedOut");
        }
      },
    );
    return () => {
      data.subscription.unsubscribe();
    };
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
    await removeFCMTokenOnSignOut(session?.access_token ?? undefined, guestId);
    await getSupabaseClient().auth.signOut();
    await clearSession();
    await clearGuestId();
    setSession(null);
    setGuestId(null);
    setStatus("signedOut");
  }, [session, guestId]);

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
      handleOAuthRedirect,
    }),
    [
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
      handleOAuthRedirect,
    ],
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
