const assert = require("node:assert/strict");
const { execFileSync, spawn } = require("node:child_process");
const {
  cpSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: options.cwd || projectRoot,
    stdio: "inherit",
    env: { ...process.env, ...options.env },
  });
}

function capture(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd || projectRoot,
    encoding: "utf8",
    env: { ...process.env, ...options.env },
  });
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForUrl(url, options = {}) {
  const deadline = Date.now() + (options.timeout || 30000);
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, options.fetchOptions);
      if (response.ok) return;
    } catch {
      // The child server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") child.kill("SIGTERM");
  else {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  }
}

function writeConsumerApp(appRoot, tarballPath) {
  writeFileSync(
    path.join(appRoot, "package.json"),
    JSON.stringify(
      {
        private: true,
        type: "module",
        scripts: { build: "vite build" },
        dependencies: {
          "@vitejs/plugin-react": "5.2.0",
          axios: "1.13.6",
          playwright: "1.57.0",
          react: "19.2.7",
          "react-dom": "19.2.7",
          "react-session.manager.sk": `file:${tarballPath}`,
          vite: "7.3.6",
        },
      },
      null,
      2
    )
  );
  writeFileSync(
    path.join(appRoot, "index.html"),
    '<div id="root"></div><script src="/runtime.js"></script><script type="module" src="/src/main.jsx"></script>\n'
  );
  mkdirSync(path.join(appRoot, "src"));
  writeFileSync(
    path.join(appRoot, "src", "main.jsx"),
    `import React, { useContext, useState } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import { SessionManager, SessionManagerProvider } from "react-session.manager.sk";

const api = axios.create({ baseURL: window.__API_URL__, withCredentials: true });

function App() {
  const session = useContext(SessionManager);
  const [result, setResult] = useState("idle");
  const action = (name, callback) => async () => {
    try {
      const response = await callback();
      setResult(name + ":" + (response?.data?.status || "ok"));
    } catch (error) {
      setResult(name + ":error:" + (error.response?.status || "network"));
    }
  };
  return <main data-testid="ready">
    <div data-testid="loading">{String(session.loadingUser)}</div>
    <div data-testid="logged-in">{String(session.isLoggedIn)}</div>
    <div data-testid="result">{result}</div>
    <button data-testid="login" onClick={action("login", async () => {
      const response = await api.post("/auth/login");
      await session.refreshSession();
      return response;
    })}>login</button>
    <button data-testid="get" onClick={action("get", () => api.get("/protected"))}>get</button>
    <button data-testid="unsafe" onClick={action("unsafe", () => api.post("/unsafe"))}>unsafe</button>
    <button data-testid="prepare" onClick={action("prepare", () => api.post("/auth/prepare-rotation"))}>prepare</button>
    <button data-testid="rotate" onClick={action("rotate", () => api.get("/protected"))}>rotate</button>
    <button data-testid="invalidate" onClick={action("invalidate", () => api.post("/auth/invalidate"))}>invalidate</button>
    <button data-testid="logout" onClick={action("logout", async () => {
      const response = await api.post("/auth/logout");
      await session.setLoggedin(false);
      return response;
    })}>logout</button>
  </main>;
}

createRoot(document.getElementById("root")).render(
  <SessionManagerProvider
    AuthenticatedAxiosObject={api}
    userLoader={() => api.get("/auth/who")}
    refreshToken={() => api.get("/protected")}
    appVersion="compatibility-test"
  ><App /></SessionManagerProvider>
);
`
  );
  writeFileSync(
    path.join(appRoot, "public", "runtime.js"),
    "window.__API_URL__ = window.__COMPAT_API_URL__ || window.location.origin;\n"
  );
}

async function exerciseLifecycle(browser, pageUrl, topology) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.addInitScript((apiUrl) => {
    window.__COMPAT_API_URL__ = apiUrl;
  }, topology.apiUrl);
  await page.goto(pageUrl, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=ready]");
  await page.waitForFunction(
    () => document.querySelector("[data-testid=loading]")?.textContent === "false"
  );
  assert.equal(await page.getByTestId("logged-in").textContent(), "false");

  await page.getByTestId("login").click();
  await page.waitForFunction(
    () => document.querySelector("[data-testid=logged-in]")?.textContent === "true"
  );

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(
    () => document.querySelector("[data-testid=logged-in]")?.textContent === "true"
  );

  await page.getByTestId("get").click();
  await page.getByTestId("result").filter({ hasText: "get:protected-ok" }).waitFor();
  await page.getByTestId("unsafe").click();
  await page.getByTestId("result").filter({ hasText: "unsafe:unsafe-ok" }).waitFor();

  await page.getByTestId("prepare").click();
  await page.getByTestId("result").filter({ hasText: "prepare:rotation-prepared" }).waitFor();
  await page.waitForTimeout(1250);
  await page.getByTestId("rotate").click();
  await page.getByTestId("result").filter({ hasText: "rotate:ok" }).waitFor();
  await page.getByTestId("unsafe").click();
  await page.getByTestId("result").filter({ hasText: "unsafe:unsafe-ok" }).waitFor();

  await page.getByTestId("invalidate").click();
  await page.getByTestId("result").filter({ hasText: "invalidate:invalidated" }).waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(
    () => document.querySelector("[data-testid=loading]")?.textContent === "false"
  );
  assert.equal(await page.getByTestId("logged-in").textContent(), "false");

  await page.getByTestId("login").evaluate((button) => button.click());
  await page.waitForFunction(
    () => document.querySelector("[data-testid=logged-in]")?.textContent === "true"
  );
  await page.getByTestId("logout").evaluate((button) => button.click());
  await page.waitForFunction(
    () => document.querySelector("[data-testid=logged-in]")?.textContent === "false"
  );

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(
    () => document.querySelector("[data-testid=loading]")?.textContent === "false"
  );
  assert.equal(await page.getByTestId("logged-in").textContent(), "false");

  await context.close();
  console.log(`${topology.name} lifecycle passed.`);
}

async function main() {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), "session-companion-"));
  const appRoot = path.join(tempRoot, "app");
  const packageRoot = path.join(tempRoot, "package");
  mkdirSync(appRoot);
  mkdirSync(packageRoot);
  mkdirSync(path.join(appRoot, "public"));
  const children = [];

  try {
    const [details] = JSON.parse(
      capture("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", packageRoot])
    );
    const tarballPath = path.join(packageRoot, details.filename);
    writeConsumerApp(appRoot, tarballPath);
    run("npm", ["install", "--no-audit", "--fund", "false"], { cwd: appRoot });
    run("npm", ["run", "build"], { cwd: appRoot });
    cpSync(path.join(appRoot, "public", "runtime.js"), path.join(appRoot, "dist", "runtime.js"));
    const backendPort = await availablePort();
    const frontendPort = await availablePort();
    const crossOrigin = `http://localhost:${frontendPort}`;
    const apiUrl = `https://127.0.0.1:${backendPort}`;
    const certPath = path.join(tempRoot, "compat-cert.pem");
    const keyPath = path.join(tempRoot, "compat-key.pem");
    run("openssl", [
      "req", "-x509", "-newkey", "rsa:2048", "-nodes",
      "-keyout", keyPath, "-out", certPath, "-days", "1",
      "-subj", "/CN=127.0.0.1",
      "-addext", "subjectAltName=IP:127.0.0.1,DNS:localhost",
    ]);
    const backend = spawn(
      process.env.PYTHON || "python",
      [
        path.join(projectRoot, "tests", "compatibility", "backend.py"),
        "--port", String(backendPort),
        "--frontend-origin", crossOrigin,
        "--api-origin", apiUrl,
        "--static-dir", path.join(appRoot, "dist"),
        "--cert", certPath,
        "--key", keyPath,
      ],
      { detached: process.platform !== "win32", stdio: "inherit" }
    );
    children.push(backend);
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    await waitForUrl(`${apiUrl}/health`);

    const frontend = spawn(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["vite", "preview", "--host", "localhost", "--port", String(frontendPort), "--strictPort"],
      { cwd: appRoot, detached: process.platform !== "win32", stdio: "inherit" }
    );
    children.push(frontend);
    await waitForUrl(crossOrigin);

    const { chromium } = require(path.join(appRoot, "node_modules", "playwright"));
    const browser = await chromium.launch({ headless: true });
    try {
      await exerciseLifecycle(browser, apiUrl, { name: "same-origin", apiUrl });
      await exerciseLifecycle(browser, crossOrigin, { name: "cross-site", apiUrl });
    } finally {
      await browser.close();
    }
  } finally {
    children.reverse().forEach(stopChild);
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
