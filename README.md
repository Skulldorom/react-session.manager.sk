# react-session.manager.sk

[![Release](https://img.shields.io/github/v/release/Skulldorom/react-session.manager.sk?label=release&logo=github)](https://github.com/Skulldorom/react-session.manager.sk/releases/latest)

A React context provider for managing token-based user sessions in applications backed by a Flask API. It handles JWT token storage and refresh, device fingerprinting, app version enforcement, cross-tab session synchronisation, and user-facing toast notifications — all from a single wrapper component.

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
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

- **Automatic token refresh** on a configurable interval
- **Persistent sessions** via `localStorage` (remember me) or `sessionStorage`
- **Cross-tab synchronisation** — a login in one tab is picked up by all open tabs
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
| `AuthenticatedAxiosObject` | `AxiosInstance` | ✅ | An axios instance. The provider attaches `Authorization`, `deviceUID`, and `appVersion` headers to it automatically. |
| `userLoader` | `() => Promise` | ✅ | Async function that fetches the current user. Must resolve to `{ data: { logged_in, is_admin, Info } }`. |
| `refreshToken` | `() => Promise` | ✅ | Async function that refreshes the JWT. Must resolve to `{ access_token, refreshed? }`. |
| `refreshTimer` | `number` | | Minutes between automatic token refresh attempts. Defaults to `60`. |
| `dataRefresh` | `number` | | Minutes between automatic user-data refresh calls. Defaults to `60`. |
| `appVersion` | `string` | | Semver string of the current client build (e.g. `"1.2.3"`). Used for version comparison against server requirements. |
| `toastOptions` | `object` | | Any valid [react-toastify `ToastContainer` props](https://fkhadra.github.io/react-toastify/api/toast-container) to customise notification behaviour. |
| `children` | `ReactNode` | ✅ | Your application tree. |

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
| `header` | `string` | The current `Authorization` header value (e.g. `"Bearer <token>"`). |
| `deviceUID` | `string` | The stable device fingerprint stored in `localStorage`. |
| `refreshData` | `boolean` | Flag that is set to `true` when a periodic data refresh is due. |
| `setHeader` | `(token: string) => void` | Manually set the `Authorization` header (e.g. after a successful login). |
| `setLoggedin` | `(status: boolean) => void` | Manually update the logged-in state (e.g. after logout). |
| `setRefreshData` | `(status: boolean) => void` | Manually trigger or clear a data refresh cycle. |
| `hasRole` | `(roles: string[]) => boolean` | Returns `true` if `userInfo.roles` contains any of the provided role strings. |

---

## How It Works

### Token Management

On mount the provider checks `localStorage` and `sessionStorage` for a stored `Authorization` token. If found it immediately calls `refreshToken` to validate/rotate it, then re-stores the result. A `setInterval` continues to call `refreshToken` every `refreshTimer` minutes while the user is logged in.

Storing a token in `localStorage` means the session persists across browser restarts ("remember me"). `sessionStorage` tokens expire when the tab is closed.

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
