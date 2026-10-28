const { withAndroidManifest } = require("expo/config-plugins");

const ADMOB_APP_IDS = {
  dev: "ca-app-pub-3940256099942544~3347511713",
  prod: "ca-app-pub-3342123808291001~3690375670",
};

const AD_MOB_META_NAME = "com.google.android.gms.ads.APPLICATION_ID";

const EXTERNAL_APP_ENV = "prod";

/**
 * Apply the AdMob application id and the cleartext HTTP policy to an Android
 * `<application>` element.
 *
 * Cleartext HTTP is permitted only outside production. Release builds talk to
 * the API over https, and opting them into cleartext would let a network
 * attacker intercept or rewrite every request on a hostile network. Dev builds
 * keep it because `adb reverse tcp:8000 tcp:8000` serves the API over plain
 * http on localhost.
 *
 * The attribute is *deleted* for production rather than set to "false": an
 * absent attribute falls back to the platform default (secure-only), so a
 * release manifest carries no cleartext opt-in at all.
 *
 * @param {Record<string, any>} application the `<application>` element
 * @param {string} appEnv the resolved `EXPO_PUBLIC_APP_ENV`
 * @returns {Record<string, any>} the same element, mutated
 */
function applyAdMobAndCleartext(application, appEnv) {
  const isProduction = appEnv === EXTERNAL_APP_ENV;

  if (isProduction) {
    delete application.$["android:usesCleartextTraffic"];
  } else {
    application.$["android:usesCleartextTraffic"] = "true";
  }

  if (!application["meta-data"]) {
    application["meta-data"] = [];
  }

  const appId = ADMOB_APP_IDS[appEnv] || ADMOB_APP_IDS.dev;
  const entry = {
    $: {
      "android:name": AD_MOB_META_NAME,
      "android:value": appId,
      "tools:node": "replace",
    },
  };

  const idx = application["meta-data"].findIndex(
    (m) => m.$["android:name"] === AD_MOB_META_NAME,
  );

  if (idx >= 0) {
    application["meta-data"][idx] = entry;
  } else {
    application["meta-data"].push(entry);
  }

  return application;
}

module.exports = function withAdMobAndCleartext(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const app = manifest.application[0];
    const env = process.env.EXPO_PUBLIC_APP_ENV || "dev";

    applyAdMobAndCleartext(app, env);

    return cfg;
  });
};

module.exports.applyAdMobAndCleartext = applyAdMobAndCleartext;
module.exports.EXTERNAL_APP_ENV = EXTERNAL_APP_ENV;