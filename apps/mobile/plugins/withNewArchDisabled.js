const { withProjectBuildGradle } = require("expo/config-plugins");

module.exports = function withNewArchDisabled(config) {
  return withProjectBuildGradle(config, (cfg) => {
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /newArchEnabled\s*=\s*true/,
      "newArchEnabled = false",
    );
    return cfg;
  });
};
