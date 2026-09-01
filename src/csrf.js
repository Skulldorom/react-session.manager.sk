/**
 * Cross-site CSRF token transport for the session manager.
 *
 * Same-site deployments rely on Axios reading the `csrf_access_token` cookie
 * via its XSRF defaults (`withXSRFToken` + `xsrfCookieName`/`xsrfHeaderName`).
 * That does not work when the SPA and API live on different registrable
 * domains: the browser cannot read an API-scoped cookie from the SPA's origin.
 *
 * For those deployments the Flask companion (`flask-session.manager.sk` v1.3+)
 * returns the current CSRF value in an `X-CSRF-TOKEN` response header and
 * exposes it via `Access-Control-Expose-Headers`. This module captures that
 * value in memory only and attaches it to unsafe requests.
 *
 * The CSRF value is intentionally never persisted to `localStorage` or
 * `sessionStorage`. It is a short-lived, session-bound value that is cleared on
 * logout, session expiry, or invalidation.
 */

export const CSRF_HEADER_NAME = "X-CSRF-TOKEN";

const UNSAFE_METHODS = new Set(["post", "put", "patch", "delete"]);

let inMemoryCsrfToken = null;

/**
 * Store the current CSRF token in memory (replaces any previous value).
 * Non-string or empty values clear the token.
 *
 * @param {string|null|undefined} token
 */
export function setCsrfToken(token) {
  if (typeof token === "string" && token.length > 0) {
    inMemoryCsrfToken = token;
  } else {
    inMemoryCsrfToken = null;
  }
}

/**
 * Return the current in-memory CSRF token, or null when none is set.
 *
 * @returns {string|null}
 */
export function getCsrfToken() {
  return inMemoryCsrfToken;
}

/**
 * Clear the in-memory CSRF token.
 */
export function clearCsrfToken() {
  inMemoryCsrfToken = null;
}

/**
 * Whether an HTTP method is unsafe (state-changing) and therefore requires a
 * CSRF token when using cookie auth.
 *
 * @param {string|undefined} method
 * @returns {boolean}
 */
export function isUnsafeMethod(method) {
  return UNSAFE_METHODS.has(String(method || "").toLowerCase());
}

/**
 * Capture a CSRF token from an Axios response object's headers, if present.
 * Axios lower-cases response header keys, so we check both spellings.
 *
 * @param {object} response - an Axios response
 * @returns {string|null} the captured token, or null
 */
export function captureCsrfFromResponse(response) {
  const headers = response && response.headers;
  if (!headers) return null;

  const token = headers["x-csrf-token"] || headers["X-CSRF-TOKEN"];
  if (typeof token === "string" && token.length > 0) {
    setCsrfToken(token);
    return token;
  }
  return null;
}
