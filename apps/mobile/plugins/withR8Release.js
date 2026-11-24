const { withGradleProperties } = require("expo/config-plugins");

// Play flags apps whose release build is not shrunk or obfuscated (DEX
// optimization below 25%). The Expo template only enables R8 when these two
// Gradle properties are set, so turn them on for release builds.
const PROPERTIES = {
  "android.enableMinifyInReleaseBuilds": "true",
  "android.enableShrinkResourcesInReleaseBuilds": "true",
};

function setGradleProperties(properties) {
  for (const [key, value] of Object.entries(PROPERTIES)) {
    const existing = properties.find((item) => item.type === "property" && item.key === key);
    if (existing) {
      existing.value = value;
    } else {
      properties.push({ type: "property", key, value });
    }
  }
  return properties;
}

module.exports = function withR8Release(config) {
  return withGradleProperties(config, (cfg) => {
    setGradleProperties(cfg.modResults);
    return cfg;
  });
};

module.exports.setGradleProperties = setGradleProperties;
module.exports.PROPERTIES = PROPERTIES;
