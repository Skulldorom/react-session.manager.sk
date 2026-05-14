import getDeviceFingerprint from "../src/components/FingerPrint.js";

jest.mock("clientjs", () => ({
  ClientJS: jest.fn().mockImplementation(() => ({
    getFingerprint: jest.fn().mockReturnValue(987654),
  })),
}));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

describe("getDeviceFingerprint", () => {
  it("returns the stored fingerprint when one already exists in localStorage", () => {
    localStorage.setItem("deviceFingerprint", "cached-fp");

    const result = getDeviceFingerprint();

    expect(result).toBe("cached-fp");
  });

  it("generates a new fingerprint via ClientJS when none is stored", () => {
    const result = getDeviceFingerprint();

    expect(result).toBe(987654);
  });

  it("persists the newly generated fingerprint to localStorage", () => {
    getDeviceFingerprint();

    expect(localStorage.getItem("deviceFingerprint")).toBe("987654");
  });

  it("does not call ClientJS when a fingerprint is already cached", () => {
    const { ClientJS } = require("clientjs");
    localStorage.setItem("deviceFingerprint", "already-cached");

    getDeviceFingerprint();

    expect(ClientJS).not.toHaveBeenCalled();
  });
});
