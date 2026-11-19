const { addOptionalFeatures, OPTIONAL_FEATURES } = require("./withOptionalHardware");

const featureMap = (manifest) =>
  Object.fromEntries(
    (manifest["uses-feature"] ?? []).map((f) => [f.$["android:name"], f.$["android:required"]]),
  );

describe("withOptionalHardware", () => {
  it("declares portrait and microphone as optional on a manifest with no features", () => {
    const features = featureMap(addOptionalFeatures({}));

    expect(features["android.hardware.screen.portrait"]).toBe("false");
    expect(features["android.hardware.microphone"]).toBe("false");
  });

  it("flips an existing required declaration to optional instead of duplicating it", () => {
    const manifest = {
      "uses-feature": [
        { $: { "android:name": "android.hardware.microphone", "android:required": "true" } },
        { $: { "android:name": "android.hardware.camera", "android:required": "true" } },
      ],
    };

    addOptionalFeatures(manifest);

    const entries = manifest["uses-feature"].filter(
      (f) => f.$["android:name"] === "android.hardware.microphone",
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].$["android:required"]).toBe("false");
    // Unrelated features are left exactly as they were.
    expect(featureMap(manifest)["android.hardware.camera"]).toBe("true");
  });

  it("is idempotent", () => {
    const manifest = addOptionalFeatures(addOptionalFeatures({}));

    expect(manifest["uses-feature"]).toHaveLength(OPTIONAL_FEATURES.length);
  });
});
