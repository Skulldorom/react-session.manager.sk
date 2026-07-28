const assert = require("node:assert/strict");
const { execFileSync, spawn } = require("node:child_process");
const { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const tempRoot = mkdtempSync(path.join(os.tmpdir(), "react-session-manager-consumer-"));
const appRoot = path.join(tempRoot, "app");
const packageRoot = path.join(tempRoot, "package");

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: options.cwd || projectRoot,
    stdio: "inherit",
    env: { ...process.env, ...options.env },
  });
}

function runCapture(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd || projectRoot,
    encoding: "utf8",
    env: { ...process.env, ...options.env },
  });
}

function waitForUrl(url, timeoutMs = 30000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = async () => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          resolve();
          return;
        }
      } catch {
        // Server is still starting. Naturally it expresses this with silence.
      }

      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }

      setTimeout(attempt, 500);
    };

    attempt();
  });
}

function readBuiltJavaScriptFiles(distRoot) {
  const assetsRoot = path.join(distRoot, "assets");
  return readdirSync(assetsRoot)
    .filter((file) => file.endsWith(".js"))
    .map((file) => ({
      file,
      content: readFileSync(path.join(assetsRoot, file), "utf8"),
    }));
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function runBrowserSmoke() {
  const previewPort = await getAvailablePort();
  const previewUrl = `http://127.0.0.1:${previewPort}/`;
  const preview = spawn(
    process.platform === "win32" ? "npx.cmd" : "npx",
    [
      "vite",
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      String(previewPort),
      "--strictPort",
    ],
    {
      cwd: appRoot,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  let previewOutput = "";
  preview.stdout.on("data", (chunk) => {
    previewOutput += chunk.toString();
  });
  preview.stderr.on("data", (chunk) => {
    previewOutput += chunk.toString();
  });

  let browser;

  try {
    await waitForUrl(previewUrl);

    const { chromium } = require(path.join(appRoot, "node_modules", "playwright"));
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const pageErrors = [];
    const consoleErrors = [];

    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    await page.goto(previewUrl, { waitUntil: "networkidle" });
    await page.waitForSelector("[data-testid='consumer-smoke-ready']", {
      timeout: 10000,
    });

    const renderedText = await page.locator("#root").innerText();
    assert.match(renderedText, /Consumer smoke ready/);
    assert.deepEqual(pageErrors, [], "consumer app must not throw browser page errors");
    assert.deepEqual(consoleErrors, [], "consumer app must not log browser console errors");
  } catch (error) {
    error.message = `${error.message}\n\nVite preview output:\n${previewOutput}`;
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }

    if (preview.pid) {
      if (process.platform === "win32") {
        preview.kill("SIGTERM");
      } else {
        try {
          process.kill(-preview.pid, "SIGTERM");
        } catch {
          preview.kill("SIGTERM");
        }
      }
    }

    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 5000);
      preview.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }
}

async function main() {
  mkdirSync(packageRoot, { recursive: true });
  mkdirSync(appRoot, { recursive: true });

  const packOutput = runCapture("npm", [
    "pack",
    "--json",
    "--ignore-scripts",
    "--pack-destination",
    packageRoot,
  ]);
  const [packageDetails] = JSON.parse(packOutput);
  const tarballPath = path.join(packageRoot, packageDetails.filename);

  writeFileSync(
    path.join(appRoot, "package.json"),
    JSON.stringify(
      {
        private: true,
        type: "module",
        scripts: {
          build: "vite build",
        },
        dependencies: {
          "@vitejs/plugin-react": "5.2.0",
          vite: "7.3.6",
          react: "19.2.7",
          "react-dom": "19.2.7",
          playwright: "1.57.0",
          "react-session.manager.sk": `file:${tarballPath}`,
        },
        devDependencies: {},
      },
      null,
      2
    )
  );

  mkdirSync(path.join(appRoot, "src"), { recursive: true });
  writeFileSync(
    path.join(appRoot, "index.html"),
    '<!doctype html><html><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>\n'
  );
  writeFileSync(
    path.join(appRoot, "src", "main.jsx"),
    `import React, { useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { SessionManager, SessionManagerProvider } from 'react-session.manager.sk';

const axiosLike = {
  defaults: { headers: { common: {} } },
  interceptors: {
    response: {
      use: () => 1,
      eject: () => {},
    },
  },
};

function Status() {
  const session = useContext(SessionManager);
  return (
    <main data-testid="consumer-smoke-ready">
      Consumer smoke ready: {String(session.loadingUser)} / {String(session.isLoggedIn)}
    </main>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SessionManagerProvider
      AuthenticatedAxiosObject={axiosLike}
      refreshTimer={1}
      dataRefresh={1}
      userLoader={() => Promise.resolve({ data: { logged_in: false, is_admin: false, Info: { roles: [] } } })}
      refreshToken={() => Promise.resolve({ access_token: 'consumer-smoke-token', refreshed: false })}
      appVersion="0.0.0-consumer-smoke"
    >
      <Status />
    </SessionManagerProvider>
  </React.StrictMode>
);
`
  );

  run("npm", ["install", "--no-audit", "--fund", "false"], { cwd: appRoot });
  run("npx", ["playwright", "install", "chromium"], { cwd: appRoot });
  run("npm", ["run", "build"], { cwd: appRoot });

  const builtJavaScript = readBuiltJavaScriptFiles(path.join(appRoot, "dist"));
  assert.ok(builtJavaScript.length > 0, "consumer build must emit JavaScript assets");
  for (const { file, content } of builtJavaScript) {
    assert.ok(!content.includes("jsxDEV"), `${file} must not contain jsxDEV`);
    assert.ok(
      !content.includes("react/jsx-dev-runtime"),
      `${file} must not import react/jsx-dev-runtime`
    );
  }

  await runBrowserSmoke();

  console.log("Consumer smoke test passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    if (!process.env.KEEP_CONSUMER_SMOKE_TEST_DIR) {
      rmSync(tempRoot, { recursive: true, force: true });
    } else {
      console.log(`Consumer smoke test directory kept at ${tempRoot}`);
    }
  });
