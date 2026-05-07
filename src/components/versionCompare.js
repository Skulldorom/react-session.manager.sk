/**
 * Compare two semver-style version strings.
 * Returns true if v1 >= v2, false if v1 < v2.
 *
 * @param {string} v1
 * @param {string} v2
 * @returns {boolean}
 */
export default function versionCompare(v1, v2) {
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);
  const length = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < length; i++) {
    const a = parts1[i] ?? 0;
    const b = parts2[i] ?? 0;
    if (a > b) return true;
    if (a < b) return false;
  }

  return true;
}
