import * as SecureStore from "expo-secure-store";

import type { Session } from "@supabase/supabase-js";

const SESSION_KEY = "careeros.auth.session";
const GUEST_ID_KEY = "careeros.guest.id";

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function generateUuidV4(): string {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

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
  if (existing !== null && UUID_V4_RE.test(existing)) {
    return existing;
  }
  const id = generateUuidV4();
  await SecureStore.setItemAsync(GUEST_ID_KEY, id);
  return id;
}

export async function loadGuestId(): Promise<string | null> {
  return SecureStore.getItemAsync(GUEST_ID_KEY);
}

export async function clearGuestId(): Promise<void> {
  await SecureStore.deleteItemAsync(GUEST_ID_KEY);
}
