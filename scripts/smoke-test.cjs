const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");

async function run() {
  const manifest = JSON.parse(
    readFileSync(path.join(projectRoot, "package.json"), "utf8")
  );
  const entryPoint = path.resolve(projectRoot, manifest.main);
  const bundle = readFileSync(entryPoint, "utf8");

  assert.ok(
    !bundle.includes("jsxDEV"),
    "production bundle must not contain React's development-only jsxDEV runtime"
  );
  assert.ok(
    !bundle.includes("react/jsx-dev-runtime"),
    "production bundle must not import react/jsx-dev-runtime"
  );

  const packageModule = await import(pathToFileURL(entryPoint).href);

  assert.equal(typeof packageModule.default, "function");
  assert.equal(typeof packageModule.SessionManagerProvider, "function");
  assert.equal(typeof packageModule.getDeviceFingerprint, "function");
  assert.ok(packageModule.SessionManager, "SessionManager must be exported");

  const packOutput = execFileSync(
    "npm",
    ["pack", "--dry-run", "--json", "--ignore-scripts"],
    { cwd: projectRoot, encoding: "utf8" }
  );
  const [packageDetails] = JSON.parse(packOutput);
  const packedFiles = new Set(
    packageDetails.files.map(({ path: file }) => file)
  );

  assert.ok(
    packedFiles.has("dist/index.js"),
    "package must contain dist/index.js"
  );
  assert.ok(packedFiles.has("README.md"), "package must contain README.md");
  assert.ok(packageDetails.size > 0, "package tarball must not be empty");

  console.log("Package smoke tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
