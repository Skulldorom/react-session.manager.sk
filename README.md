# react-session.manager.sk

This is used in conjunction with a custom flask app in order to manage user sessions.

## Installation

```
npm install react-session.manager.sk
```

## Usage

```
<SessionManagerProvider
    userLoader={who} // function to get user data
    refreshToken={refresh} // function to refresh token
    AuthenticatedAxiosObject={axiosAuth} // axios object with token
    refreshTimer={config.server.tokenRefreshTimer} // time to refresh token
    dataRefresh={config.server.dataRefreshTimer} // time to refresh data
    appVersion={config.appVersion} // app version
    toastOptions={{
    icon: true,
    toastClassName: config.theme.Notification.ThemeNotifications
        ? config.theme.Notification.MaterialNotifications
        ? "custToast materialToast"
        : "custToast"
        : "",
    }}
    >
        <App />
</SessionManagerProvider>
```
