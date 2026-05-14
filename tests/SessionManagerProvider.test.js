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

jest.mock("../src/hooks/useDeviceFingerprint.js", () =>
  jest.fn().mockReturnValue("test-device-uid")
);

jest.mock("../src/components/VersionProtection.js", () => () => null);

// Helper: creates a minimal fake Axios instance
function createMockAxios() {
  return {
    defaults: {
      withCredentials: false,
      headers: {
        common: {},
      },
    },
    interceptors: {
      response: {
        use: jest.fn().mockReturnValue(1),
        eject: jest.fn(),
      },
    },
  };
}

// Helper: consumer component that reads the context and stores it for assertions
function ContextReader({ onValue }) {
  const ctx = useContext(SessionManager);
  onValue(ctx);
  return null;
}

// Helper: renders the provider and returns captured context values
function renderProvider({
  axiosInstance,
  refreshToken = jest.fn().mockResolvedValue(null),
  userLoader = jest.fn().mockResolvedValue({ data: { logged_in: false, is_admin: false, Info: {} } }),
  appVersion = "1.0.0",
  refreshTimer,
  dataRefresh,
  toastOptions,
} = {}) {
  const mockAxios = axiosInstance ?? createMockAxios();
  let capturedCtx = {};

  render(
    <SessionManagerProvider
      AuthenticatedAxiosObject={mockAxios}
      refreshToken={refreshToken}
      userLoader={userLoader}
      appVersion={appVersion}
      refreshTimer={refreshTimer}
      dataRefresh={dataRefresh}
      toastOptions={toastOptions}
    >
      <ContextReader onValue={(ctx) => { capturedCtx = ctx; }} />
    </SessionManagerProvider>
  );

  return { mockAxios, getCaptured: () => capturedCtx };
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe("SessionManagerProvider", () => {
  describe("default context values", () => {
    it("provides isLoggedIn as false initially", async () => {
      const { getCaptured } = renderProvider();
      await waitFor(() => expect(getCaptured().isLoggedIn).toBe(false));
    });

    it("provides isAdmin as false initially", async () => {
      const { getCaptured } = renderProvider();
      await waitFor(() => expect(getCaptured().isAdmin).toBe(false));
    });

    it("provides deviceUID from the hook", async () => {
      const { getCaptured } = renderProvider();
      await waitFor(() => expect(getCaptured().deviceUID).toBe("test-device-uid"));
    });

    it("provides a non-null hasRole function", async () => {
      const { getCaptured } = renderProvider();
      await waitFor(() => expect(typeof getCaptured().hasRole).toBe("function"));
    });
  });

  describe("setLoggedin", () => {
    it("updates isLoggedIn to true", async () => {
      const { getCaptured } = renderProvider();

      await waitFor(() => expect(typeof getCaptured().setLoggedin).toBe("function"));

      act(() => {
        getCaptured().setLoggedin(true);
      });

      await waitFor(() => expect(getCaptured().isLoggedIn).toBe(true));
    });

    it("updates isLoggedIn to false", async () => {
      const { getCaptured } = renderProvider();

      await waitFor(() => expect(typeof getCaptured().setLoggedin).toBe("function"));

      act(() => {
        getCaptured().setLoggedin(true);
      });
      act(() => {
        getCaptured().setLoggedin(false);
      });

      await waitFor(() => expect(getCaptured().isLoggedIn).toBe(false));
    });
  });

  describe("setHeader", () => {
    it("updates the header value", async () => {
      const { getCaptured } = renderProvider();

      await waitFor(() => expect(typeof getCaptured().setHeader).toBe("function"));

      act(() => {
        getCaptured().setHeader("Bearer test-token");
      });

      await waitFor(() => expect(getCaptured().header).toBe("Bearer test-token"));
    });
  });

  describe("hasRole", () => {
    it("returns true when the user has the queried role", async () => {
      const userLoader = jest
        .fn()
        .mockResolvedValue({
          data: { logged_in: true, is_admin: false, Info: { roles: ["admin", "editor"] } },
        });

      const { getCaptured } = renderProvider({ userLoader });

      await waitFor(() => expect(getCaptured().userInfo?.roles).toEqual(["admin", "editor"]));

      expect(getCaptured().hasRole(["admin"])).toBe(true);
    });

    it("returns false when the user does not have the queried role", async () => {
      const userLoader = jest
        .fn()
        .mockResolvedValue({
          data: { logged_in: true, is_admin: false, Info: { roles: ["viewer"] } },
        });

      const { getCaptured } = renderProvider({ userLoader });

      await waitFor(() => expect(getCaptured().userInfo?.roles).toEqual(["viewer"]));

      expect(getCaptured().hasRole(["admin"])).toBe(false);
    });

    it("returns false when userInfo has no roles", async () => {
      const { getCaptured } = renderProvider();

      await waitFor(() => expect(typeof getCaptured().hasRole).toBe("function"));

      expect(getCaptured().hasRole(["admin"])).toBe(false);
    });
  });

  describe("userLoader integration", () => {
    it("sets isLoggedIn and isAdmin from userLoader response", async () => {
      const userLoader = jest.fn().mockResolvedValue({
        data: { logged_in: true, is_admin: true, Info: { name: "Alice" } },
      });

      const { getCaptured } = renderProvider({ userLoader });

      await waitFor(() => expect(getCaptured().isLoggedIn).toBe(true));
      expect(getCaptured().isAdmin).toBe(true);
      expect(getCaptured().userInfo).toEqual({ name: "Alice" });
    });

    it("sets loadingUser to false after userLoader resolves", async () => {
      const userLoader = jest.fn().mockResolvedValue({
        data: { logged_in: false, is_admin: false, Info: {} },
      });

      const { getCaptured } = renderProvider({ userLoader });

      await waitFor(() => expect(getCaptured().loadingUser).toBe(false));
    });

    it("sets loadingUser to false even when userLoader rejects", async () => {
      const userLoader = jest.fn().mockRejectedValue(new Error("network error"));

      const { getCaptured } = renderProvider({ userLoader });

      await waitFor(() => expect(getCaptured().loadingUser).toBe(false));
    });
  });

  describe("Axios instance configuration", () => {
    it("sets withCredentials on the Axios instance", () => {
      const { mockAxios } = renderProvider();
      expect(mockAxios.defaults.withCredentials).toBe(true);
    });

    it("registers a response interceptor", () => {
      const { mockAxios } = renderProvider();
      expect(mockAxios.interceptors.response.use).toHaveBeenCalledTimes(1);
    });
  });

  describe("session restoration from storage", () => {
    it("calls refreshToken when a token is in localStorage", async () => {
      localStorage.setItem("Authorization", "Bearer stored-local-token");

      const refreshToken = jest
        .fn()
        .mockResolvedValue({ access_token: "new-token", refreshed: false });

      renderProvider({ refreshToken });

      await waitFor(() => expect(refreshToken).toHaveBeenCalledTimes(1));
    });

    it("calls refreshToken when a token is in sessionStorage", async () => {
      sessionStorage.setItem("Authorization", "Bearer stored-session-token");

      const refreshToken = jest
        .fn()
        .mockResolvedValue({ access_token: "new-token", refreshed: false });

      renderProvider({ refreshToken });

      await waitFor(() => expect(refreshToken).toHaveBeenCalledTimes(1));
    });

    it("prefers localStorage over sessionStorage", async () => {
      localStorage.setItem("Authorization", "Bearer local-token");
      sessionStorage.setItem("Authorization", "Bearer session-token");

      const refreshToken = jest
        .fn()
        .mockResolvedValue({ access_token: "new-token", refreshed: false });

      renderProvider({ refreshToken });

      await waitFor(() => expect(refreshToken).toHaveBeenCalledTimes(1));
      // restoreSession is called once (for localAuth), not twice
      expect(refreshToken).toHaveBeenCalledTimes(1);
    });

    it("shows a warning toast when refreshToken returns no token", async () => {
      localStorage.setItem("Authorization", "Bearer old-token");
      const { toast } = require("react-toastify");
      const refreshToken = jest.fn().mockResolvedValue(null);

      renderProvider({ refreshToken });

      await waitFor(() =>
        expect(toast.warn).toHaveBeenCalledWith(
          expect.stringContaining("session could not be restored"),
          expect.objectContaining({ toastId: "TOKEN_REFRESH_FAILED" })
        )
      );
    });

    it("shows a warning toast when refreshToken rejects", async () => {
      localStorage.setItem("Authorization", "Bearer old-token");
      const { toast } = require("react-toastify");
      const refreshToken = jest.fn().mockRejectedValue(new Error("refresh failed"));

      renderProvider({ refreshToken });

      await waitFor(() =>
        expect(toast.warn).toHaveBeenCalledWith(
          expect.stringContaining("session could not be restored"),
          expect.objectContaining({ toastId: "TOKEN_REFRESH_FAILED" })
        )
      );
    });
  });

  describe("cross-tab storage event", () => {
    it("calls refreshToken when a storage event updates Authorization", async () => {
      const refreshToken = jest
        .fn()
        .mockResolvedValue({ access_token: "cross-tab-token", refreshed: true });

      renderProvider({ refreshToken });

      act(() => {
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "Authorization",
            newValue: "Bearer cross-tab-token",
          })
        );
      });

      await waitFor(() => expect(refreshToken).toHaveBeenCalledTimes(1));
    });

    it("ignores storage events for other keys", async () => {
      const refreshToken = jest.fn().mockResolvedValue(null);

      renderProvider({ refreshToken });

      act(() => {
        window.dispatchEvent(
          new StorageEvent("storage", { key: "SomeOtherKey", newValue: "value" })
        );
      });

      // Flush all async work and confirm refreshToken was never called
      await act(async () => jest.advanceTimersByTime(300));
      expect(refreshToken).not.toHaveBeenCalled();
    });
  });
});
