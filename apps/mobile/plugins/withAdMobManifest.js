const { withAndroidManifest } = require("expo/config-plugins");

const ADMOB_APP_IDS = {
  dev: "ca-app-pub-3940256099942544~3347511713",
  prod: "ca-app-pub-3342123808291001~3690375670",
};

module.exports = function withAdMobAndCleartext(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const app = manifest.application[0];

    app.$["android:usesCleartextTraffic"] = "true";

    if (!app["meta-data"]) {
      app["meta-data"] = [];
    }

    const env = process.env.EXPO_PUBLIC_APP_ENV || "dev";
    const appId = ADMOB_APP_IDS[env] || ADMOB_APP_IDS.dev;

    const idx = app["meta-data"].findIndex(
      (m) => m.$["android:name"] === "com.google.android.gms.ads.APPLICATION_ID",
    );

    const entry = {
      $: {
        "android:name": "com.google.android.gms.ads.APPLICATION_ID",
        "android:value": appId,
        "tools:node": "replace",
      },
    };

    if (idx >= 0) {
      app["meta-data"][idx] = entry;
    } else {
      app["meta-data"].push(entry);
    }

    return cfg;
  });
};
