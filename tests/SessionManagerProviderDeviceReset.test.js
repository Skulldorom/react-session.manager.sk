import React, { useContext } from "react";
import { render, act, waitFor } from "@testing-library/react";
import { SessionManager, SessionManagerProvider } from "../src/index.js";

jest.mock("react-toastify", () => ({
  ToastContainer: () => null,
  toast: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock("../src/components/VersionProtection.js", () => () => null);

const mockFingerprintGet = jest.fn();

jest.mock("@fingerprintjs/fingerprintjs", () => ({
  __esModule: true,
  default: {
    load: jest.fn(() => Promise.resolve({ get: mockFingerprintGet })),
  },
}));

function createMockAxios() {
  return {
    defaults: {
      withCredentials: false,
      headers: {
        common: {},
      },
    },
    interceptors: {
      request: {
        use: jest.fn().mockReturnValue(2),
        eject: jest.fn(),
      },
      response: {
        use: jest.fn().mockReturnValue(1),
        eject: jest.fn(),
      },
    },
  };
}

function ContextReader({ onValue }) {
  const ctx = useContext(SessionManager);
  onValue(ctx);
  return null;
}

function renderProvider({ axiosInstance = createMockAxios(), onValue }) {
  render(
    <SessionManagerProvider
      AuthenticatedAxiosObject={axiosInstance}
      refreshToken={jest.fn().mockResolvedValue(null)}
      userLoader={jest.fn().mockResolvedValue({
        data: { logged_in: false, is_admin: false, Info: {} },
      })}
      appVersion="1.0.0"
    >
      <ContextReader onValue={onValue} />
    </SessionManagerProvider>
  );

  return axiosInstance;
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe("SessionManagerProvider device UID reset", () => {
  it("resets deviceUID without allowing the mounted provider to keep using the stale header", async () => {
    let resolveFreshFingerprint;
    mockFingerprintGet
      .mockResolvedValueOnce({ visitorId: "old-uid" })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFreshFingerprint = () => resolve({ visitorId: "fresh-uid" });
        })
      );

    let capturedCtx = {};
    const axiosInstance = renderProvider({
      onValue: (ctx) => {
        capturedCtx = ctx;
      },
    });

    await waitFor(() => expect(capturedCtx.deviceUID).toBe("old-uid"));
    expect(localStorage.getItem("deviceUID")).toBe("old-uid");
    expect(axiosInstance.defaults.headers.common["deviceUID"]).toBe("old-uid");

    let resetPromise;
    act(() => {
      resetPromise = capturedCtx.resetDeviceUID();
    });

    expect(localStorage.getItem("deviceUID")).toBeNull();
    expect(localStorage.getItem("deviceFingerprint")).toBeNull();
    expect(capturedCtx.deviceUID).toBeNull();
    expect(axiosInstance.defaults.headers.common).not.toHaveProperty("deviceUID");

    await act(async () => {
      resolveFreshFingerprint();
      await resetPromise;
    });

    await waitFor(() => expect(capturedCtx.deviceUID).toBe("fresh-uid"));
    expect(localStorage.getItem("deviceUID")).toBe("fresh-uid");
    expect(axiosInstance.defaults.headers.common["deviceUID"]).toBe("fresh-uid");
  });
});
