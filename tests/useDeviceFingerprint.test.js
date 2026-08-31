import { renderHook, waitFor } from "@testing-library/react";
import useDeviceFingerprint from "../src/hooks/useDeviceFingerprint.js";

jest.mock("../src/components/FingerPrint.js", () =>
  jest.fn().mockResolvedValue("generated-uid")
);

let mockAxios;

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  mockAxios = {
    defaults: {
      headers: {
        common: {},
      },
    },
  };
});

describe("useDeviceFingerprint", () => {
  it("returns the deviceUID stored in localStorage", () => {
    localStorage.setItem("deviceUID", "stored-uid");

    const { result } = renderHook(() => useDeviceFingerprint(mockAxios));

    expect(result.current).toBe("stored-uid");
  });

  it("generates and stores a new deviceUID when none is cached", async () => {
    const { result } = renderHook(() => useDeviceFingerprint(mockAxios));

    await waitFor(() => expect(result.current).toBe("generated-uid"));
    expect(localStorage.getItem("deviceUID")).toBe("generated-uid");
  });

  it("does not call getDeviceFingerprint when deviceUID is already in localStorage", () => {
    const getDeviceFingerprint = require("../src/components/FingerPrint.js");
    localStorage.setItem("deviceUID", "cached-uid");

    renderHook(() => useDeviceFingerprint(mockAxios));

    expect(getDeviceFingerprint).not.toHaveBeenCalled();
  });

  it("logs an error and leaves storage/header unchanged when generation fails", async () => {
    const getDeviceFingerprint = require("../src/components/FingerPrint.js");
    const error = new Error("fingerprint failed");
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    getDeviceFingerprint.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useDeviceFingerprint(mockAxios));

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(
        "Failed to generate device fingerprint:",
        error
      )
    );
    expect(result.current).toBeNull();
    expect(localStorage.getItem("deviceUID")).toBeNull();
    expect(mockAxios.defaults.headers.common).not.toHaveProperty("deviceUID");
  });

  it("sets the deviceUID on the axios instance header", async () => {
    localStorage.setItem("deviceUID", "header-uid");

    renderHook(() => useDeviceFingerprint(mockAxios));

    await waitFor(() =>
      expect(mockAxios.defaults.headers.common["deviceUID"]).toBe("header-uid")
    );
  });
});
