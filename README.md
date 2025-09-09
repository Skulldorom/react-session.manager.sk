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

## Testing using another project

### Linking react and react-dom

Link react and react-dom to the project you want to test with.

```
cd node_modules/react
npm link
```

```
cd node_modules/react-dom
npm link
```

Run the following in package root directory

```
npm link react react-dom
```

## Development & Release

### Making Releases

This project uses automated releases via GitHub Actions. To create a new release:

```bash
# Patch release
npm run release:patch

# Minor release
npm run release:minor

# Major release
npm run release:major
```

**Option 3: Manual version management**

```bash
# Update version and create git tag
npm version patch  # or minor/major
git push --follow-tags
```

### Release Process

1. The script/command updates `package.json` version
2. Creates a git tag (e.g., `v2.0.8`)
3. Pushes the tag to GitHub
4. GitHub Actions automatically:
   - Builds the project
   - Creates a GitHub release
   - Publishes to npm

### Changelog

All changes are documented in [CHANGELOG.md](./CHANGELOG.md). Please update it before making releases.
