import versionCompare from "../src/components/versionCompare.js";

describe("versionCompare", () => {
  test("returns true for equal versions", () => {
    expect(versionCompare("1.2.3", "1.2.3")).toBe(true);
  });

  test("returns true when left version is greater (major)", () => {
    expect(versionCompare("2.0.0", "1.9.9")).toBe(true);
  });

  test("returns true when left version is greater (minor)", () => {
    expect(versionCompare("1.3.0", "1.2.9")).toBe(true);
  });

  test("returns true when left version is greater (patch)", () => {
    expect(versionCompare("1.2.4", "1.2.3")).toBe(true);
  });

  test("returns false when left version is lower", () => {
    expect(versionCompare("1.2.3", "1.3.0")).toBe(false);
  });

  test("returns false when left major is lower", () => {
    expect(versionCompare("0.9.9", "1.0.0")).toBe(false);
  });

  test("treats missing parts as zero – equal", () => {
    expect(versionCompare("1.2", "1.2.0")).toBe(true);
  });

  test("treats missing parts as zero – right is greater", () => {
    expect(versionCompare("1.2", "1.2.1")).toBe(false);
  });

  test("single-part version comparison", () => {
    expect(versionCompare("2", "1")).toBe(true);
    expect(versionCompare("1", "2")).toBe(false);
    expect(versionCompare("1", "1")).toBe(true);
  });
});
