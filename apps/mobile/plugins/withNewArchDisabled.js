const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = function withNewArchDisabled(config) {
  return withDangerousMod(config, [
    "android",
    (cfg) => {
      const propsPath = path.join(
        cfg.modRequest.platformProjectRoot,
        "gradle.properties",
      );
      let content = fs.readFileSync(propsPath, "utf-8");
      content = content.replace(
        /newArchEnabled\s*=\s*true/,
        "newArchEnabled=false",
      );
      fs.writeFileSync(propsPath, content);
      return cfg;
    },
  ]);
};
