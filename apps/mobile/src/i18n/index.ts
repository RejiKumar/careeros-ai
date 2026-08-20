import en from "./en";

export type { Strings } from "./en";

export type TranslationKey = string;

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((acc: unknown, key: string) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const value = getNestedValue(en as unknown as Record<string, unknown>, key);
  if (typeof value !== "string") {
    return key;
  }
  if (!params) return value;
  return Object.entries(params).reduce(
    (result, [k, v]) => result.replace(new RegExp(`\\{${k}\\}`, "g"), String(v)),
    value,
  );
}

export function useStrings() {
  return {
    ...en,
    t,
  };
}

export default en;
