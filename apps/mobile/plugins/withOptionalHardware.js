const { withAndroidManifest } = require("expo/config-plugins");

// Play treats a locked screen orientation and the RECORD_AUDIO permission as
// hard hardware requirements, which hides the app from tablets, desktops and
// phones without a microphone. Neither is essential (voice input is optional,
// and portrait is only a layout preference), so declare them as optional.
const OPTIONAL_FEATURES = ["android.hardware.screen.portrait", "android.hardware.microphone"];

function addOptionalFeatures(manifest) {
  const features = manifest["uses-feature"] ?? [];
  for (const name of OPTIONAL_FEATURES) {
    const existing = features.find((feature) => feature.$["android:name"] === name);
    if (existing) {
      existing.$["android:required"] = "false";
    } else {
      features.push({ $: { "android:name": name, "android:required": "false" } });
    }
  }
  manifest["uses-feature"] = features;
  return manifest;
}

module.exports = function withOptionalHardware(config) {
  return withAndroidManifest(config, (cfg) => {
    addOptionalFeatures(cfg.modResults.manifest);
    return cfg;
  });
};

module.exports.addOptionalFeatures = addOptionalFeatures;
module.exports.OPTIONAL_FEATURES = OPTIONAL_FEATURES;
