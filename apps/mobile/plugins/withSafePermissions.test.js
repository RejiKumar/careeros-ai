/**
 * Permission hygiene tests for withSafePermissions.
 */

const { filterUnusedPermissions, UNUSED_PERMISSIONS } = require("./withSafePermissions.js");

function permission(name) {
  return { $: { "android:name": name } };
}

describe("filterUnusedPermissions", () => {
  it("removes SYSTEM_ALERT_WINDOW", () => {
    const kept = filterUnusedPermissions([
      permission("android.permission.INTERNET"),
      permission("android.permission.SYSTEM_ALERT_WINDOW"),
      permission("android.permission.RECORD_AUDIO"),
    ]);

    expect(kept.map((p) => p.$["android:name"])).toEqual([
      "android.permission.INTERNET",
      "android.permission.RECORD_AUDIO",
    ]);
  });

  it("keeps every permission the app actually uses", () => {
    const used = [
      "android.permission.INTERNET",
      "android.permission.RECORD_AUDIO",
      "android.permission.VIBRATE",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
    ];

    expect(filterUnusedPermissions(used.map(permission))).toHaveLength(used.length);
  });

  it("survives an empty or missing permission list", () => {
    expect(filterUnusedPermissions([])).toEqual([]);
    expect(filterUnusedPermissions(undefined)).toEqual([]);
  });

  it("is deliberately narrow: only the reviewed permission name is dropped", () => {
    expect(UNUSED_PERMISSIONS).toEqual(new Set(["android.permission.SYSTEM_ALERT_WINDOW"]));
  });
});
