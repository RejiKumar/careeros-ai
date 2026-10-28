/**
 * Declares only the permissions the app actually uses.
 *
 * The Expo Android template ships a few template permissions we never exercise
 * (notably `android.permission.SYSTEM_ALERT_WINDOW`, a high-review/permission
 * that Play flags). Gestures and audio share need none of them, and the app's
 * own speech feature is covered by `RECORD_AUDIO`. Leaving the template default
 * in place would re-enter the release manifest on every regeneration, so it is
 * stripped here — this module is the permission gate, and the manifest is the
 * result.
 */

const { withAndroidManifest } = require("expo/config-plugins");

/** The only permission deliberately dropped from every manifest generated here. */
const UNUSED_PERMISSIONS = new Set(["android.permission.SYSTEM_ALERT_WINDOW"]);

/**
 * @param {Record<string, any>} permissions the manifest's `uses-permission` array
 * @returns {Record<string, any>[]} filtered array with the unused permissions removed
 */
function filterUnusedPermissions(permissions) {
  if (!Array.isArray(permissions)) {
    return [];
  }
  return permissions.filter(
    (permission) =>
      !permission || !permission.$ || !UNUSED_PERMISSIONS.has(permission.$["android:name"]),
  );
}

module.exports = function withSafePermissions(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest["uses-permission"] = filterUnusedPermissions(manifest["uses-permission"]);
    return cfg;
  });
};

module.exports.filterUnusedPermissions = filterUnusedPermissions;
module.exports.UNUSED_PERMISSIONS = UNUSED_PERMISSIONS;
