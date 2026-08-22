import { ApiClient, setTokenRefresher } from "./api";

describe("ApiClient auth refresh", () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    (globalThis as { fetch: unknown }).fetch = mockFetch as unknown as typeof fetch;
    setTokenRefresher(null);
  });

  afterEach(() => {
    setTokenRefresher(null);
    jest.restoreAllMocks();
  });

  function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  it("retries the request with a refreshed token after a 401", async () => {
    const refresher = jest.fn().mockResolvedValue("refreshed-token");
    setTokenRefresher(refresher);

    mockFetch
      .mockResolvedValueOnce(
        jsonResponse(401, { error: { code: "token_expired", message: "Token expired." } }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { id: "user-1" }));

    const client = new ApiClient("http://test");
    const result = await client.getMe("expired-token");

    expect(result).toEqual({ id: "user-1" });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe("Bearer expired-token");
    expect(mockFetch.mock.calls[1][1].headers.Authorization).toBe("Bearer refreshed-token");
  });

  it("throws the original 401 when the refresh fails", async () => {
    const refresher = jest.fn().mockResolvedValue(null);
    setTokenRefresher(refresher);

    mockFetch.mockResolvedValueOnce(
      jsonResponse(401, { error: { code: "token_expired", message: "Token expired." } }),
    );

    const client = new ApiClient("http://test");
    await expect(client.getMe("expired-token")).rejects.toMatchObject({
      status: 401,
      code: "token_expired",
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("does not refresh when no refresher is registered", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(401, { detail: "Missing bearer token." }));

    const client = new ApiClient("http://test");
    await expect(client.getMe("expired-token")).rejects.toMatchObject({
      status: 401,
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("does not refresh on non-401 errors", async () => {
    const refresher = jest.fn();
    setTokenRefresher(refresher);

    mockFetch.mockResolvedValueOnce(jsonResponse(500, { detail: "Server error." }));

    const client = new ApiClient("http://test");
    await expect(client.getMe("valid-token")).rejects.toMatchObject({ status: 500 });
    expect(refresher).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
