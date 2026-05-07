import test from "node:test";
import assert from "node:assert/strict";
import versionCompare from "../src/components/versionCompare.js";

test("returns true for equal versions", () => {
  assert.equal(versionCompare("1.2.3", "1.2.3"), true);
});

test("returns true when left version is greater", () => {
  assert.equal(versionCompare("2.0.0", "1.9.9"), true);
});

test("returns false when left version is lower", () => {
  assert.equal(versionCompare("1.2.3", "1.3.0"), false);
});

test("treats missing parts as zero", () => {
  assert.equal(versionCompare("1.2", "1.2.0"), true);
  assert.equal(versionCompare("1.2", "1.2.1"), false);
});
