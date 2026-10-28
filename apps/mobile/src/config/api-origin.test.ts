import { ApiOriginError, isExternallyDistributed, resolveApiOrigin } from "./api-origin";

const EXTERNAL = { EXPO_PUBLIC_APP_ENV: "prod" } as const;

describe("isExternallyDistributed", () => {
  it("treats prod as externally distributed", () => {
    expect(isExternallyDistributed("prod")).toBe(true);
    expect(isExternallyDistributed("PROD")).toBe(true);
    expect(isExternallyDistributed(" prod ")).toBe(true);
  });

  it("treats dev, qa and unset as not externally distributed", () => {
    expect(isExternallyDistributed("dev")).toBe(false);
    expect(isExternallyDistributed("qa")).toBe(false);
    expect(isExternallyDistributed(undefined)).toBe(false);
    expect(isExternallyDistributed("")).toBe(false);
  });
});

describe("resolveApiOrigin for external distribution", () => {
  it("accepts a valid https origin", () => {
    expect(
      resolveApiOrigin({
        ...EXTERNAL,
        EXPO_PUBLIC_API_URL: "https://careeros-api-abc-uc.a.run.app",
      }),
    ).toBe("https://careeros-api-abc-uc.a.run.app");
  });

  it("rejects an empty origin", () => {
    expect(() => resolveApiOrigin(EXTERNAL)).toThrow(ApiOriginError);
    expect(() => resolveApiOrigin(EXTERNAL)).toThrow(/not set/);
  });

  it("rejects a whitespace-only origin as empty", () => {
    expect(() => resolveApiOrigin({ ...EXTERNAL, EXPO_PUBLIC_API_URL: "   " })).toThrow(/not set/);
  });

  it("rejects a relative origin", () => {
    expect(() => resolveApiOrigin({ ...EXTERNAL, EXPO_PUBLIC_API_URL: "/api" })).toThrow(
      /absolute/,
    );
    expect(() => resolveApiOrigin({ ...EXTERNAL, EXPO_PUBLIC_API_URL: "api.example.com" })).toThrow(
      /absolute/,
    );
    expect(() =>
      resolveApiOrigin({ ...EXTERNAL, EXPO_PUBLIC_API_URL: "//api.example.com" }),
    ).toThrow(/absolute/);
  });

  it("rejects loopback hosts", () => {
    // IPv6 literals must be bracketed per RFC 3986; an unbracketed "::1" is
    // malformed syntax and is rejected earlier as a missing host.
    for (const host of ["localhost", "127.0.0.1", "127.1.2.3", "[::1]", "0.0.0.0"]) {
      expect(() =>
        resolveApiOrigin({ ...EXTERNAL, EXPO_PUBLIC_API_URL: `http://${host}:8000` }),
      ).toThrow(/loopback/);
    }
  });

  it("rejects an unbracketed IPv6 literal as malformed", () => {
    expect(() => resolveApiOrigin({ ...EXTERNAL, EXPO_PUBLIC_API_URL: "http://::1:8000" })).toThrow(
      /no host/,
    );
  });

  it("rejects plain http even when the host is not loopback", () => {
    expect(() =>
      resolveApiOrigin({ ...EXTERNAL, EXPO_PUBLIC_API_URL: "http://api.example.com" }),
    ).toThrow(/https/);
  });

  it("rejects embedded credentials", () => {
    expect(() =>
      resolveApiOrigin({
        ...EXTERNAL,
        EXPO_PUBLIC_API_URL: "https://user:pass@api.example.com",
      }),
    ).toThrow(/credentials/);
  });

  it("rejects a query string or fragment", () => {
    expect(() =>
      resolveApiOrigin({
        ...EXTERNAL,
        EXPO_PUBLIC_API_URL: "https://api.example.com?x=1",
      }),
    ).toThrow(/absolute/);
  });
});

describe("resolveApiOrigin for local profiles", () => {
  it("permits a loopback http origin for adb reverse", () => {
    expect(
      resolveApiOrigin({
        EXPO_PUBLIC_APP_ENV: "dev",
        EXPO_PUBLIC_API_URL: "http://localhost:8000",
      }),
    ).toBe("http://localhost:8000");
  });

  it("permits 127.0.0.1 for adb reverse", () => {
    expect(
      resolveApiOrigin({
        EXPO_PUBLIC_APP_ENV: "dev",
        EXPO_PUBLIC_API_URL: "http://127.0.0.1:8000",
      }),
    ).toBe("http://127.0.0.1:8000");
  });

  it("returns an empty string when unset, matching the previous default", () => {
    expect(resolveApiOrigin({ EXPO_PUBLIC_APP_ENV: "dev" })).toBe("");
    expect(resolveApiOrigin({})).toBe("");
  });
});

describe("resolveApiOrigin normalisation", () => {
  it("strips trailing slashes", () => {
    expect(
      resolveApiOrigin({
        EXPO_PUBLIC_APP_ENV: "dev",
        EXPO_PUBLIC_API_URL: "https://api.example.com/",
      }),
    ).toBe("https://api.example.com");
    expect(
      resolveApiOrigin({
        EXPO_PUBLIC_APP_ENV: "dev",
        EXPO_PUBLIC_API_URL: "https://api.example.com///",
      }),
    ).toBe("https://api.example.com");
  });

  it("keeps a base path", () => {
    expect(
      resolveApiOrigin({
        EXPO_PUBLIC_APP_ENV: "dev",
        EXPO_PUBLIC_API_URL: "https://api.example.com/backend",
      }),
    ).toBe("https://api.example.com/backend");
  });

  it("lowercases scheme and host but preserves the port", () => {
    expect(
      resolveApiOrigin({
        EXPO_PUBLIC_APP_ENV: "dev",
        EXPO_PUBLIC_API_URL: "HTTPS://API.Example.COM:8443",
      }),
    ).toBe("https://api.example.com:8443");
  });

  it("trims surrounding whitespace", () => {
    expect(
      resolveApiOrigin({
        EXPO_PUBLIC_APP_ENV: "dev",
        EXPO_PUBLIC_API_URL: "  https://api.example.com  ",
      }),
    ).toBe("https://api.example.com");
  });

  it("rejects a bare port with no host", () => {
    expect(() =>
      resolveApiOrigin({
        EXPO_PUBLIC_APP_ENV: "dev",
        EXPO_PUBLIC_API_URL: "https://:8000",
      }),
    ).toThrow(/no host/);
  });
});

describe("the dead production host is rejected for external distribution", () => {
  it("still parses, which is why a reachability gate is required", () => {
    // Shape validation cannot detect a host that resolves but serves 404s. This
    // documents that boundary: the resolver catches misconfiguration, and the
    // release verification gate catches an unreachable deployment.
    expect(
      resolveApiOrigin({
        ...EXTERNAL,
        EXPO_PUBLIC_API_URL: "https://careeros-ai-production.up.railway.app",
      }),
    ).toBe("https://careeros-ai-production.up.railway.app");
  });
});
