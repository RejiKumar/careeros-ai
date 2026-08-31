import { formatDate, toISODate } from "./dates";

describe("toISODate", () => {
  it("converts MM/DD/YYYY to ISO", () => {
    expect(toISODate("08/29/2026")).toBe("2026-08-29");
    expect(toISODate("3/7/2025")).toBe("2025-03-07");
  });

  it("accepts dashed input", () => {
    expect(toISODate("08-29-2026")).toBe("2026-08-29");
  });

  it("accepts already-ISO input", () => {
    expect(toISODate("2026-08-29")).toBe("2026-08-29");
  });

  it("returns null for an empty string", () => {
    expect(toISODate("")).toBeNull();
    expect(toISODate("   ")).toBeNull();
  });

  it("rejects invalid dates", () => {
    expect(toISODate("02/30/2026")).toBeNull();
    expect(toISODate("13/01/2026")).toBeNull();
    expect(toISODate("00/05/2026")).toBeNull();
    expect(toISODate("03/07/99")).toBeNull();
    expect(toISODate("not-a-date")).toBeNull();
  });
});

describe("formatDate", () => {
  it("formats ISO dates as MM/DD/YYYY", () => {
    expect(formatDate("2026-08-29")).toBe("08/29/2026");
    expect(formatDate("2026-08-29T21:54:35.084358+00:00")).toBe("08/29/2026");
  });

  it("returns empty string for null/undefined/empty", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
    expect(formatDate("")).toBe("");
  });

  it("passes through non-ISO input unchanged", () => {
    expect(formatDate("TBD")).toBe("TBD");
  });
});