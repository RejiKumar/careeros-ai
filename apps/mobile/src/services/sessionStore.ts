import * as SecureStore from "expo-secure-store";

import type { Session } from "@supabase/supabase-js";

const SESSION_KEY = "careeros.auth.session";
const GUEST_ID_KEY = "careeros.guest.id";

export async function saveSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (raw === null) {
    return null;
  }
  try {
    return JSON.parse(raw) as Session;
  } catch {
    await clearSession();
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function getOrCreateGuestId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(GUEST_ID_KEY);
  if (existing !== null) {
    return existing;
  }
  // React Native / Expo Go may not have crypto.randomUUID; use a simple fallback
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  const id = `guest_${timestamp}_${random}`;
  await SecureStore.setItemAsync(GUEST_ID_KEY, id);
  return id;
}

export async function loadGuestId(): Promise<string | null> {
  return SecureStore.getItemAsync(GUEST_ID_KEY);
}

export async function clearGuestId(): Promise<void> {
  await SecureStore.deleteItemAsync(GUEST_ID_KEY);
}
