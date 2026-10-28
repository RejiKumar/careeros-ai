/**
 * Android manifest transform tests for withAdMobManifest.
 *
 * Guards the cleartext policy: a release build must carry no cleartext opt-in,
 * while a development build must keep one so `adb reverse` against a loopback
 * API still works. The pre-existing attribute is seeded in the fixture so the
 * production case proves removal, not merely absence of a default.
 */

const { applyAdMobAndCleartext, EXTERNAL_APP_ENV } = require("./withAdMobManifest.js");

const AD_MOB_META = "com.google.android.gms.ads.APPLICATION_ID";

function applicationWithCleartext(value) {
  return {
    $: {
      "android:usesCleartextTraffic": value,
      "android:allowBackup": "false",
    },
    "meta-data": [],
  };
}

function admobValue(app) {
  const entry = app["meta-data"].find((m) => m.$["android:name"] === AD_MOB_META);
  return entry ? entry.$["android:value"] : undefined;
}

function metaEntries(app) {
  return app["meta-data"].filter((m) => m.$["android:name"] === AD_MOB_META);
}

describe("cleartext policy", () => {
  it("removes any existing cleartext opt-in for production", () => {
    const app = applicationWithCleartext("true");

    applyAdMobAndCleartext(app, EXTERNAL_APP_ENV);

    expect(app.$).not.toHaveProperty("android:usesCleartextTraffic");
  });

  it("keeps cleartext enabled for dev so adb reverse works", () => {
    const app = applicationWithCleartext("false");

    applyAdMobAndCleartext(app, "dev");

    expect(app.$["android:usesCleartextTraffic"]).toBe("true");
  });

  it("keeps cleartext enabled for qa", () => {
    const app = applicationWithCleartext("false");

    applyAdMobAndCleartext(app, "qa");

    expect(app.$["android:usesCleartextTraffic"]).toBe("true");
  });

  it("does not disturb unrelated application attributes", () => {
    const app = applicationWithCleartext("true");

    applyAdMobAndCleartext(app, EXTERNAL_APP_ENV);

    expect(app.$["android:allowBackup"]).toBe("false");
  });
});

describe("AdMob application id", () => {
  it("uses the production AdMob unit for prod", () => {
    const app = applicationWithCleartext("true");

    applyAdMobAndCleartext(app, EXTERNAL_APP_ENV);

    expect(admobValue(app)).toBe("ca-app-pub-3342123808291001~3690375670");
  });

  it("uses the Google test AdMob unit for dev", () => {
    const app = applicationWithCleartext("true");

    applyAdMobAndCleartext(app, "dev");

    expect(admobValue(app)).toBe("ca-app-pub-3940256099942544~3347511713");
  });

  it("creates the meta-data array when absent", () => {
    const app = { $: { "android:usesCleartextTraffic": "true" } };

    applyAdMobAndCleartext(app, "dev");

    expect(app["meta-data"]).toHaveLength(1);
  });

  it("replaces an existing AdMob entry rather than duplicating it", () => {
    const app = applicationWithCleartext("true");
    app["meta-data"].push({
      $: { "android:name": AD_MOB_META, "android:value": "stale-value" },
    });

    applyAdMobAndCleartext(app, EXTERNAL_APP_ENV);

    const entries = metaEntries(app);
    expect(entries).toHaveLength(1);
    expect(entries[0].$["android:value"]).toBe("ca-app-pub-3342123808291001~3690375670");
  });
});