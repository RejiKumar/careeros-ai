import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

WebBrowser.maybeCompleteAuthSession();

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client !== null) {
    return client;
  }
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase is not configured: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are required.",
    );
  }
  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      flowType: "implicit",
      storage: AsyncStorage,
    },
  });
  return client;
}

export function getOAuthRedirectUri(): string {
  const scheme = Constants.expoConfig?.scheme;
  const primaryScheme = Array.isArray(scheme) ? scheme[0] : scheme;
  if (primaryScheme === undefined || primaryScheme === "") {
    throw new Error("No app scheme configured for the OAuth redirect URI.");
  }
  return `${primaryScheme}://auth/callback`;
}

export function isOAuthRedirectUrl(url: string): boolean {
  return url.includes("code=") || url.includes("access_token=") || url.includes("token_hash=");
}

function parseQueryPairs(queryString: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const pair of queryString.split("&")) {
    if (pair.length === 0) {
      continue;
    }
    const eq = pair.indexOf("=");
    if (eq === -1) {
      params[decodeURIComponent(pair)] = "";
    } else {
      params[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(pair.slice(eq + 1));
    }
  }
  return params;
}

function parseRedirectParams(url: string): { query: Record<string, string>; hash: Record<string, string> } {
  const queryIndex = url.indexOf("?");
  const hashIndex = url.indexOf("#");
  const query = queryIndex === -1 ? {} : parseQueryPairs(url.slice(queryIndex + 1, hashIndex === -1 ? undefined : hashIndex));
  const hash = hashIndex === -1 ? {} : parseQueryPairs(url.slice(hashIndex + 1));
  return { query, hash };
}

export async function exchangeOAuthCode(url: string): Promise<Session> {
  const supabase = getSupabaseClient();
  const { query, hash } = parseRedirectParams(url);
  const authCode = query.code;

  if (query.token_hash !== undefined && query.type !== undefined) {
    console.debug("[careeros-oauth] Email confirmation — verifying token_hash");
    const { data, error } = await supabase.auth.verifyOtp({
      type: query.type as
        | "signup"
        | "email"
        | "magiclink"
        | "recovery"
        | "invite"
        | "email_change",
      token_hash: query.token_hash,
    });
    if (error !== null) {
      throw new Error(error.message);
    }
    if (data.session === null) {
      throw new Error(
        "Email confirmation did not return a session. Try signing in.",
      );
    }
    return data.session;
  }

  if (authCode !== undefined) {
    console.debug(
      `[careeros-oauth] PKCE flow — exchanging authorization code (code=${authCode !== undefined}, state=${"state" in query}, sb_flow_id=${"sb_flow_id" in query})`,
    );
    const { data, error } = await supabase.auth.exchangeCodeForSession(url);
    if (error !== null) {
      console.debug(
        `[careeros-oauth] exchange error name=${error.name} status=${error.status} code=${error.code} msg=${error.message}`,
      );
      throw new Error(error.message);
    }
    if (data.session === null) {
      throw new Error("Google sign in did not return a session.");
    }
    return data.session;
  }

  console.debug("[careeros-oauth] Implicit flow — extracting tokens from redirect URL");
  const accessToken = hash.access_token;
  const refreshToken = hash.refresh_token;
  if (accessToken === undefined || refreshToken === undefined) {
    throw new Error("Google sign in did not return valid tokens.");
  }
  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error !== null) {
    throw new Error(error.message);
  }
  if (data.session === null) {
    throw new Error("Google sign in did not return a session.");
  }
  return data.session;
}
