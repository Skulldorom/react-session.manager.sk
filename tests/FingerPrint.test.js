import getDeviceFingerprint, {
  DEVICE_UID_STORAGE_KEY,
  LEGACY_DEVICE_FINGERPRINT_STORAGE_KEY,
  resetDeviceUID,
} from "../src/components/FingerPrint.js";

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
  it("returns the canonical deviceUID when one already exists", async () => {
    localStorage.setItem(DEVICE_UID_STORAGE_KEY, "cached-uid");
    localStorage.setItem(LEGACY_DEVICE_FINGERPRINT_STORAGE_KEY, "legacy-fp");

    const result = await getDeviceFingerprint();

    expect(result).toBe("cached-uid");
    expect(localStorage.getItem(DEVICE_UID_STORAGE_KEY)).toBe("cached-uid");
    expect(localStorage.getItem(LEGACY_DEVICE_FINGERPRINT_STORAGE_KEY)).toBeNull();
  });

  it("migrates a legacy deviceFingerprint value to deviceUID", async () => {
    localStorage.setItem(LEGACY_DEVICE_FINGERPRINT_STORAGE_KEY, "legacy-fp");

    const result = await getDeviceFingerprint();

    expect(result).toBe("legacy-fp");
    expect(localStorage.getItem(DEVICE_UID_STORAGE_KEY)).toBe("legacy-fp");
    expect(localStorage.getItem(LEGACY_DEVICE_FINGERPRINT_STORAGE_KEY)).toBeNull();
  });

  it("generates a new fingerprint via FingerprintJS when none is stored", async () => {
    const result = await getDeviceFingerprint();

    expect(result).toBe("fp-visitorId-123");
  });

  it("returns a string fingerprint value", async () => {
    const result = await getDeviceFingerprint();

    expect(typeof result).toBe("string");
  });

  it("persists the newly generated fingerprint only to the canonical key", async () => {
    await getDeviceFingerprint();

    expect(localStorage.getItem(DEVICE_UID_STORAGE_KEY)).toBe("fp-visitorId-123");
    expect(localStorage.getItem(LEGACY_DEVICE_FINGERPRINT_STORAGE_KEY)).toBeNull();
  });

  it("does not call FingerprintJS when a canonical fingerprint is already cached", async () => {
    const FingerprintJS = require("@fingerprintjs/fingerprintjs").default;
    localStorage.setItem(DEVICE_UID_STORAGE_KEY, "already-cached");

    await getDeviceFingerprint();

    expect(FingerprintJS.load).not.toHaveBeenCalled();
  });

  it("removes both supported device identity keys when resetDeviceUID is called", () => {
    localStorage.setItem(DEVICE_UID_STORAGE_KEY, "cached-uid");
    localStorage.setItem(LEGACY_DEVICE_FINGERPRINT_STORAGE_KEY, "legacy-fp");

    resetDeviceUID();

    expect(localStorage.getItem(DEVICE_UID_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_DEVICE_FINGERPRINT_STORAGE_KEY)).toBeNull();
  });
});
