import { renderHook, act, waitFor } from "@testing-library/react";
import useDeviceFingerprint from "../src/hooks/useDeviceFingerprint.js";

jest.mock("../src/components/FingerPrint.js", () => {
  const mockGetDeviceFingerprint = jest.fn().mockResolvedValue("generated-uid");
  mockGetDeviceFingerprint.resetDeviceUID = jest.fn();
  return mockGetDeviceFingerprint;
});

const getDeviceFingerprint = require("../src/components/FingerPrint.js");
const resetStoredDeviceUID = getDeviceFingerprint.resetDeviceUID;

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
  it("returns the canonical deviceUID from the shared helper", async () => {
    getDeviceFingerprint.mockResolvedValueOnce("stored-uid");

    const { result } = renderHook(() => useDeviceFingerprint(mockAxios));

    await waitFor(() => expect(result.current.deviceUID).toBe("stored-uid"));
  });

  it("generates and stores a new deviceUID through the shared helper", async () => {
    const { result } = renderHook(() => useDeviceFingerprint(mockAxios));

    await waitFor(() => expect(result.current.deviceUID).toBe("generated-uid"));
    expect(localStorage.getItem("deviceUID")).toBeNull();
  });

  it("delegates storage ownership to getDeviceFingerprint", async () => {
    renderHook(() => useDeviceFingerprint(mockAxios));

    await waitFor(() => expect(getDeviceFingerprint).toHaveBeenCalledTimes(1));
  });

  it("logs an error and leaves storage/header unchanged when generation fails", async () => {
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
    expect(result.current.deviceUID).toBeNull();
    expect(localStorage.getItem("deviceUID")).toBeNull();
    expect(mockAxios.defaults.headers.common).not.toHaveProperty("deviceUID");
  });

  it("sets the deviceUID on the axios instance header", async () => {
    renderHook(() => useDeviceFingerprint(mockAxios));

    await waitFor(() =>
      expect(mockAxios.defaults.headers.common["deviceUID"]).toBe(
        "generated-uid"
      )
    );
  });

  it("clears the mounted state and axios header before generating a fresh UID", async () => {
    let resolveFreshUID;
    getDeviceFingerprint
      .mockResolvedValueOnce("old-uid")
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFreshUID = resolve;
        })
      );

    const { result } = renderHook(() => useDeviceFingerprint(mockAxios));

    await waitFor(() => expect(result.current.deviceUID).toBe("old-uid"));
    expect(mockAxios.defaults.headers.common["deviceUID"]).toBe("old-uid");

    let resetPromise;
    act(() => {
      resetPromise = result.current.resetDeviceUID();
    });

    expect(resetStoredDeviceUID).toHaveBeenCalledTimes(1);
    expect(result.current.deviceUID).toBeNull();
    expect(mockAxios.defaults.headers.common).not.toHaveProperty("deviceUID");

    await act(async () => {
      resolveFreshUID("fresh-uid");
      await resetPromise;
    });

    await waitFor(() => expect(result.current.deviceUID).toBe("fresh-uid"));
    expect(mockAxios.defaults.headers.common["deviceUID"]).toBe("fresh-uid");
  });

  it("ignores stale in-flight UID loads after a reset", async () => {
    let resolveInitialUID;
    let resolveFreshUID;
    getDeviceFingerprint
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveInitialUID = resolve;
        })
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFreshUID = resolve;
        })
      );

    const { result } = renderHook(() => useDeviceFingerprint(mockAxios));

    let resetPromise;
    act(() => {
      resetPromise = result.current.resetDeviceUID();
    });

    await act(async () => {
      resolveInitialUID("stale-uid");
    });

    expect(result.current.deviceUID).toBeNull();
    expect(mockAxios.defaults.headers.common).not.toHaveProperty("deviceUID");

    await act(async () => {
      resolveFreshUID("fresh-uid");
      await resetPromise;
    });

    await waitFor(() => expect(result.current.deviceUID).toBe("fresh-uid"));
    expect(mockAxios.defaults.headers.common["deviceUID"]).toBe("fresh-uid");
  });
});
