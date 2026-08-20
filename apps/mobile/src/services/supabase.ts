import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

WebBrowser.maybeCompleteAuthSession();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client !== null) {
    return client;
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase is not configured: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are required.",
    );
  }
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return client;
}

export function getOAuthRedirectUri(): string {
  return AuthSession.makeRedirectUri();
}

export async function exchangeOAuthCode(url: string): Promise<Session> {
  const { data, error } = await getSupabaseClient().auth.exchangeCodeForSession(url);
  if (error !== null) {
    throw new Error(error.message);
  }
  if (data.session === null) {
    throw new Error("Google sign in did not return a session.");
  }
  return data.session;
}
