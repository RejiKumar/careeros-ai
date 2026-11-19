import { initialiseAds } from "./AdBanner";

function sdk() {
  const initialize = jest.fn().mockResolvedValue(undefined);
  const setRequestConfiguration = jest.fn().mockResolvedValue(undefined);
  return {
    initialize,
    setRequestConfiguration,
    factory: () => ({ initialize, setRequestConfiguration }),
  };
}

describe("initialiseAds", () => {
  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sets a content rating, gathers consent, then initializes", async () => {
    const mobileAds = sdk();
    const gatherConsent = jest.fn().mockResolvedValue({ canRequestAds: true });

    await initialiseAds(mobileAds.factory, { gatherConsent }, { PG: "PG" });

    expect(mobileAds.setRequestConfiguration).toHaveBeenCalledWith({ maxAdContentRating: "PG" });
    expect(gatherConsent).toHaveBeenCalledTimes(1);
    expect(mobileAds.initialize).toHaveBeenCalledTimes(1);
  });

  it("does not initialize when the user's consent does not allow ad requests", async () => {
    const mobileAds = sdk();
    const gatherConsent = jest.fn().mockResolvedValue({ canRequestAds: false });

    await expect(initialiseAds(mobileAds.factory, { gatherConsent }, { PG: "PG" })).rejects.toThrow(
      /consent/i,
    );

    expect(mobileAds.initialize).not.toHaveBeenCalled();
  });

  it("still initializes when no consent form is configured (check throws)", async () => {
    const mobileAds = sdk();
    const gatherConsent = jest.fn().mockRejectedValue(new Error("no form"));

    await initialiseAds(mobileAds.factory, { gatherConsent }, { PG: "PG" });

    expect(mobileAds.initialize).toHaveBeenCalledTimes(1);
  });
});
