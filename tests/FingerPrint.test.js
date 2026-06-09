import getDeviceFingerprint from "../src/components/FingerPrint.js";

jest.mock("@fingerprintjs/fingerprintjs", () => ({
  __esModule: true,
  default: {
    load: jest.fn().mockResolvedValue({
      get: jest.fn().mockResolvedValue({ visitorId: "fp-visitorId-123" }),
    }),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

describe("getDeviceFingerprint", () => {
  it("returns the stored fingerprint when one already exists in localStorage", async () => {
    localStorage.setItem("deviceFingerprint", "cached-fp");

    const result = await getDeviceFingerprint();

    expect(result).toBe("cached-fp");
  });

  it("generates a new fingerprint via FingerprintJS when none is stored", async () => {
    const result = await getDeviceFingerprint();

    expect(result).toBe("fp-visitorId-123");
  });

  it("persists the newly generated fingerprint to localStorage", async () => {
    await getDeviceFingerprint();

    expect(localStorage.getItem("deviceFingerprint")).toBe("fp-visitorId-123");
  });

  it("does not call FingerprintJS when a fingerprint is already cached", async () => {
    const FingerprintJS = require("@fingerprintjs/fingerprintjs").default;
    localStorage.setItem("deviceFingerprint", "already-cached");

    await getDeviceFingerprint();

    expect(FingerprintJS.load).not.toHaveBeenCalled();
  });
});
