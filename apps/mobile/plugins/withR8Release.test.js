const { setGradleProperties, PROPERTIES } = require("./withR8Release");

const asMap = (properties) =>
  Object.fromEntries(properties.filter((p) => p.type === "property").map((p) => [p.key, p.value]));

describe("withR8Release", () => {
  it("enables minify and resource shrinking", () => {
    const map = asMap(setGradleProperties([]));

    expect(map).toEqual(PROPERTIES);
    expect(map["android.enableMinifyInReleaseBuilds"]).toBe("true");
    expect(map["android.enableShrinkResourcesInReleaseBuilds"]).toBe("true");
  });

  it("overrides an existing false value instead of duplicating the key", () => {
    const properties = [
      { type: "property", key: "android.enableMinifyInReleaseBuilds", value: "false" },
      { type: "property", key: "org.gradle.jvmargs", value: "-Xmx2048m" },
    ];

    setGradleProperties(properties);

    expect(properties.filter((p) => p.key === "android.enableMinifyInReleaseBuilds")).toHaveLength(
      1,
    );
    expect(asMap(properties)["android.enableMinifyInReleaseBuilds"]).toBe("true");
    // Unrelated properties are untouched.
    expect(asMap(properties)["org.gradle.jvmargs"]).toBe("-Xmx2048m");
  });

  it("is idempotent", () => {
    const once = setGradleProperties([]);
    const twice = setGradleProperties([...once]);

    expect(twice).toHaveLength(Object.keys(PROPERTIES).length);
  });
});
