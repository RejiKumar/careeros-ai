import { describe, expect, it } from "vitest";
import { apiContractVersion } from "./index";
import type { paths } from "./index";

describe("api-contract", () => {
  it("exposes a versioned contract", () => {
    expect(apiContractVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("type-checks against the health and auth endpoints", () => {
    // Compile-time assertion: a literal that is not a path key fails tsc/vitest.
    const expectPath = (path: keyof paths) => path;
    expectPath("/health");
    expectPath("/api/v1/health");
    expectPath("/api/v1/auth/me");
  });
});
