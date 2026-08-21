# react-session.manager.sk

[![Tests](https://github.com/Skulldorom/react-session.manager.sk/actions/workflows/tests.yml/badge.svg)](https://github.com/Skulldorom/react-session.manager.sk/actions/workflows/tests.yml)
[![Release](https://github.com/Skulldorom/react-session.manager.sk/actions/workflows/release.yml/badge.svg)](https://github.com/Skulldorom/react-session.manager.sk/actions/workflows/npm-publish.yml)
[![GitHub release](https://img.shields.io/github/v/release/Skulldorom/react-session.manager.sk)](https://github.com/Skulldorom/react-session.manager.sk/releases)

<p align="center">
  <a href="https://ko-fi.com/skulldorom"><img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Support me on Ko-fi" /></a>
</p>

A React context provider for managing cookie-based user sessions in applications backed by a Flask API. It configures credentialed Axios requests, CSRF headers, device fingerprinting, app version enforcement, and user-facing toast notifications — all from a single wrapper component.

Designed to pair with the backend companion
[flask-session.manager.sk](https://github.com/Skulldorom/flask-session.manager.sk).

---

## Flask Companion Contract

This package and [flask-session.manager.sk](https://github.com/Skulldorom/flask-session.manager.sk) implement a cookie-driven session architecture:

| Concern | Implementation |
|---|---|
| **Transport** | HttpOnly JWT cookies — no bearer tokens in browser storage |
| **CSRF** | Double-submit cookie pattern (`csrf_access_token` → `X-CSRF-TOKEN`) |
| **Cookie names** | Flask-JWT-Extended defaults (`access_token_cookie`, `csrf_access_token`) |
| **Headers** | `deviceUID` and `appVersion` sent on every request |
| **API contract** | `userLoader` expects `{ data: { logged_in, is_admin, Info } }` |

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Flask Companion Contract](#flask-companion-contract)
- [Props](#props)
- [Context API](#context-api)
- [How It Works](#how-it-works)
  - [Token Management](#token-management)
  - [Device Fingerprinting](#device-fingerprinting)
  - [Version Protection](#version-protection)
  - [Axios Interceptors](#axios-interceptors)
  - [Toast Notifications](#toast-notifications)
- [Development](#development)
- [Dependencies](#dependencies)
- [License](#license)

---

## Features

- **Credentialed cookie requests** for APIs that issue HttpOnly auth cookies
- **CSRF header support** using Axios XSRF defaults (`csrf_access_token` → `X-CSRF-TOKEN`)
- **Optional session ping/refresh** on a configurable interval
- **Legacy bearer cleanup** — removes old `Authorization` values from `localStorage` and `sessionStorage`
- **Device fingerprinting** — generates a stable `deviceUID` and attaches it to every request header
- **App version enforcement** — detects when the server requires a newer client version and prompts the user to update
- **Axios interceptor** — centrally handles `401`, `403`, `426`, `455`, `500`, `503`, and network/timeout errors
- **Toast notifications** via [react-toastify](https://fkhadra.github.io/react-toastify/) for session, connection, and version events
- **Role-based access** helper via the `hasRole` context function

---

## Installation

```bash
npm install react-session.manager.sk
```

---

## Quick Start

Wrap your application with `SessionManagerProvider` and pass the required props:

```jsx
import SessionManagerProvider from "react-session.manager.sk";
import axiosAuth from "./axiosAuth"; // your pre-configured axios instance
import { whoAmI, refreshToken } from "./api";

function Root() {
  return (
    <SessionManagerProvider
      userLoader={whoAmI}
      refreshToken={refreshToken}
      AuthenticatedAxiosObject={axiosAuth}
      refreshTimer={15}
      dataRefresh={30}
      appVersion="1.0.0"
      toastOptions={{ position: "top-right" }}
      onSessionChange={({ isLoggedIn, userInfo }) => {
        if (isLoggedIn && userInfo?.email) {
          updateTelemetryUser(userInfo);
        } else {
          clearTelemetryUser();
        }
      }}
    >
      <App />
    </SessionManagerProvider>
  );
}
```

Consume the session context anywhere inside your app:

```jsx
import { useContext } from "react";
import { SessionManager } from "react-session.manager.sk";

function Profile() {
  const { isLoggedIn, userInfo, isAdmin, hasRole, setLoggedin } =
    useContext(SessionManager);

  if (!isLoggedIn) return <p>Please log in.</p>;

  return (
    <div>
      <p>Welcome, {userInfo?.name}</p>
      {isAdmin && <p>You are an administrator.</p>}
      {hasRole(["editor"]) && <p>You have editor access.</p>}
      <button onClick={() => setLoggedin(false)}>Log out</button>
    </div>
  );
}
```

---

## Props

| Prop | Type | Required | Description |
|---|---|---|---|
| `AuthenticatedAxiosObject` | `AxiosInstance` | ✅ | An axios instance. The provider enables credentialed cookie requests, configures Axios XSRF defaults, and attaches `deviceUID` and `appVersion` headers. It does not set `Authorization` for browser auth. |
| `userLoader` | `() => Promise` | ✅ | Async function that fetches the current user. Must resolve to `{ data: { logged_in, is_admin, Info } }`. |
| `refreshToken` | `() => Promise` | | Optional async function used as a server-side cookie session ping/refresh while logged in. It should not return or persist browser bearer tokens. |
| `refreshTimer` | `number` | | Minutes between automatic token refresh attempts. Defaults to `60`. |
| `dataRefresh` | `number` | | Minutes between automatic user-data refresh calls. Defaults to `60`. |
| `appVersion` | `string` | | Semver string of the current client build (e.g. `"1.2.3"`). Used for version comparison against server requirements. |
| `onSessionChange` | `(snapshot: object) => void` | | Optional callback invoked whenever `isLoggedIn`, `isAdmin`, `userInfo`, `loadingUser`, or `deviceUID` changes. Use this for app-specific side effects such as telemetry user context without coupling this package to an analytics provider. |
| `toastOptions` | `object` | | Any valid [react-toastify `ToastContainer` props](https://fkhadra.github.io/react-toastify/api/toast-container) to customise notification behaviour. |
| `children` | `ReactNode` | ✅ | Your application tree. |

The `onSessionChange` callback receives a snapshot shaped like:

```js
{
  isLoggedIn,
  isAdmin,
  userInfo,
  loadingUser,
  deviceUID,
}
```

If the callback runs expensive work or is declared inline in a component that re-renders often, wrap it in `useCallback` so its function identity stays stable.

---

## Context API

Import the `SessionManager` context object and read it with `useContext`:

```js
import { SessionManager } from "react-session.manager.sk";
const session = useContext(SessionManager);
```

| Property | Type | Description |
|---|---|---|
| `isLoggedIn` | `boolean` | Whether the current user is authenticated. |
| `loadingUser` | `boolean` | `true` while the initial `userLoader` call is in flight. |
| `userInfo` | `object` | The `Info` object returned by `userLoader`. Shape is determined by your API. |
| `isAdmin` | `boolean` | Mirrors `is_admin` from the `userLoader` response. |
| `header` | `string` | Deprecated compatibility value. Browser auth is cookie-based; this package does not apply it to Axios `Authorization` headers. |
| `deviceUID` | `string` | The stable device fingerprint stored in `localStorage`. |
| `refreshData` | `boolean` | Flag that is set to `true` when a periodic data refresh is due. |
| `setHeader` | `(token: string) => void` | Deprecated compatibility setter. Updates context only and does not set Axios `Authorization`. |
| `setLoggedin` | `(status: boolean) => void` | Manually update the logged-in state (e.g. after logout). |
| `setRefreshData` | `(status: boolean) => void` | Manually trigger or clear a data refresh cycle. |
| `hasRole` | `(roles: string[]) => boolean` | Returns `true` if `userInfo.roles` contains any of the provided role strings. |

---

## How It Works

### Cookie Session Management

The provider assumes the backend issues browser JWT/session state through HttpOnly cookies. It sets these Axios defaults on the supplied instance:

```js
axios.defaults.withCredentials = true;
axios.defaults.withXSRFToken = true;
axios.defaults.xsrfCookieName = "csrf_access_token";
axios.defaults.xsrfHeaderName = "X-CSRF-TOKEN";
```

The backend must issue the HttpOnly auth cookie and expose the CSRF value through the deployment's chosen CSRF mechanism. For readable-cookie CSRF, the browser must be able to read `csrf_access_token` from the frontend origin; cross-site deployments may need a same-site API hostname or a response/header CSRF endpoint instead.

The provider does not read, write, or refresh bearer access tokens in `localStorage` or `sessionStorage`. On mount, and when old tabs write `Authorization` storage values, it removes those legacy values as migration cleanup.

If `refreshToken` is provided, it is treated as a session ping/refresh endpoint for server-side cookie renewal. It should not return bearer access tokens to JavaScript.

### Device Fingerprinting

On first load the provider uses [FingerprintJS](https://github.com/fingerprintjs/fingerprintjs) to generate a browser fingerprint. This value is persisted to `localStorage` as `deviceUID` and is automatically added to every outgoing request as a custom `deviceUID` header. Subsequent loads reuse the cached value.

You can also use the fingerprint helper directly in your own code:

```js
import { getDeviceFingerprint } from "react-session.manager.sk";

async function sendRequest() {
  const deviceUID = await getDeviceFingerprint();
  // use deviceUID in your request payload/headers
}
```

### Version Protection

Every request includes the current `appVersion` header. If the server responds with HTTP `426 Upgrade Required` the provider:

1. Stores the minimum required version in `sessionStorage`.
2. Reloads the page up to twice to pick up the latest build from the cache.
3. If reloading does not satisfy the version requirement, shows a warning toast asking the user to wait and reload manually.

After a successful reload, if the new client version satisfies the server's requirement a success toast is shown confirming the update.

### Axios Interceptors

The provider registers a response interceptor on `AuthenticatedAxiosObject`:

| Status | Behaviour |
|---|---|
| `401` | Unauthorized — clears auth state via `onSessionExpired` and shows an error toast. |
| `403` | Forbidden — shows an error toast. Auth state is not cleared. |
| `426` | App version too old — triggers the version protection flow described above. |
| `455` | Session no longer valid — clears auth state and shows an info toast prompting re-login. |
| `500` | Internal server error — shows an error toast. |
| `503` | Service unavailable — shows an error toast. |
| Timeout (`ECONNABORTED` / `ETIMEDOUT`) | Shows an error toast telling the user the server is taking too long to respond. |
| No response (other network error) | Shows an error toast telling the user the server is not responding. |
| `ERR_CANCELED` / `canceled` | Silently ignored (e.g. aborted requests). |

### Toast Notifications

All notifications are rendered via a `<ToastContainer>` mounted inside the provider. You can customise its behaviour with the `toastOptions` prop — it accepts any props that `<ToastContainer>` accepts, including `toastClassName` for custom CSS classes.

---

## Development

```bash
# Install dependencies
npm ci

# Run the test suite (Node ≥ 22 required)
npm test

# Build the distributable bundle
npm run build
```

Tests live in the `tests/` directory and use Jest. The CI workflow runs tests in a dedicated **test** job before **build-and-publish**, so a failing test blocks the release.

---

## Dependencies

| Package | Role |
|---|---|
| [react-toastify](https://www.npmjs.com/package/react-toastify) | In-app toast notifications |
| [@fingerprintjs/fingerprintjs](https://github.com/fingerprintjs/fingerprintjs) | Browser fingerprinting for `deviceUID` |

---

## License

ISC © [Skulldorom](https://github.com/Skulldorom)
