import { generateUuidV4, getOrCreateGuestId } from "./sessionStore";

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const mockGetItem = jest.fn();
const mockSetItem = jest.fn();

jest.mock("expo-secure-store", () => ({
  getItemAsync: (...args: unknown[]) => mockGetItem(...args),
  setItemAsync: (...args: unknown[]) => mockSetItem(...args),
}));

describe("sessionStore guest id", () => {
  beforeEach(() => {
    mockGetItem.mockReset();
    mockSetItem.mockReset();
    mockSetItem.mockResolvedValue(undefined);
  });

  it("generates a valid UUIDv4", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateUuidV4()).toMatch(UUID_V4_RE);
    }
  });

  it("returns a stored valid UUID", async () => {
    mockGetItem.mockResolvedValue("0a2c8e4f-3b1d-4e6a-9f8b-1c2d3e4f5a6b");

    await expect(getOrCreateGuestId()).resolves.toBe(
      "0a2c8e4f-3b1d-4e6a-9f8b-1c2d3e4f5a6b",
    );
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it("replaces an invalid legacy guest id with a UUID", async () => {
    mockGetItem.mockResolvedValue("guest_m0d_ab12cd34");

    const id = await getOrCreateGuestId();

    expect(id).toMatch(UUID_V4_RE);
    expect(mockSetItem).toHaveBeenCalledWith("careeros.guest.id", id);
  });

  it("creates a UUID when no guest id is stored", async () => {
    mockGetItem.mockResolvedValue(null);

    const id = await getOrCreateGuestId();

    expect(id).toMatch(UUID_V4_RE);
    expect(mockSetItem).toHaveBeenCalledWith("careeros.guest.id", id);
  });
});
