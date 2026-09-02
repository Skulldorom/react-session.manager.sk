import React, { useContext } from "react";
import { render, act, waitFor } from "@testing-library/react";
import { SessionManager, SessionManagerProvider } from "../src/index.js";
import {
  clearCsrfToken,
  getCsrfToken,
  setCsrfToken,
} from "../src/csrf.js";

jest.mock("react-toastify", () => ({
  ToastContainer: () => null,
  toast: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    success: jest.fn(),
  },
}));

const mockResetMountedDeviceUID = jest.fn();

jest.mock("../src/hooks/useDeviceFingerprint.js", () =>
  jest.fn(() => ({
    deviceUID: "test-device-uid",
    resetDeviceUID: mockResetMountedDeviceUID,
  }))
);

jest.mock("../src/components/VersionProtection.js", () => () => null);

const useDeviceFingerprint = require("../src/hooks/useDeviceFingerprint.js");

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
  userLoader = jest.fn().mockResolvedValue({
    data: { logged_in: false, is_admin: false, Info: {} },
  }),
  appVersion = "1.0.0",
  onSessionChange,
  refreshTimer,
  dataRefresh,
  toastOptions,
} = {}) {
  const mockAxios = axiosInstance ?? createMockAxios();
  let capturedCtx = {};

  const renderResult = render(
    <SessionManagerProvider
      AuthenticatedAxiosObject={mockAxios}
      refreshToken={refreshToken}
      userLoader={userLoader}
      appVersion={appVersion}
      onSessionChange={onSessionChange}
      refreshTimer={refreshTimer}
      dataRefresh={dataRefresh}
      toastOptions={toastOptions}
    >
      <ContextReader
        onValue={(ctx) => {
          capturedCtx = ctx;
        }}
      />
    </SessionManagerProvider>
  );

  return {
    mockAxios,
    getCaptured: () => capturedCtx,
    unmount: renderResult.unmount,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockResetMountedDeviceUID.mockClear();
  clearCsrfToken();
  jest.spyOn(console, "info").mockImplementation(() => {});
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
      await waitFor(() =>
        expect(getCaptured().deviceUID).toBe("test-device-uid")
      );
    });

    it("provides the mounted resetDeviceUID function from the hook", async () => {
      const { getCaptured } = renderProvider();

      await waitFor(() =>
        expect(getCaptured().resetDeviceUID).toBe(mockResetMountedDeviceUID)
      );
    });

    it("provides a non-null hasRole function", async () => {
      const { getCaptured } = renderProvider();
      await waitFor(() =>
        expect(typeof getCaptured().hasRole).toBe("function")
      );
    });
  });

  describe("setLoggedin", () => {
    it("revalidates before updating isLoggedIn to true", async () => {
      const userLoader = jest
        .fn()
        .mockResolvedValueOnce({ data: { logged_in: false } })
        .mockResolvedValue({
          data: { logged_in: true, is_admin: false, Info: { name: "Alice" } },
        });
      const { getCaptured } = renderProvider({ userLoader });

      await waitFor(() =>
        expect(typeof getCaptured().setLoggedin).toBe("function")
      );

      act(() => {
        getCaptured().setLoggedin(true);
      });

      await waitFor(() => expect(getCaptured().isLoggedIn).toBe(true));
      expect(userLoader).toHaveBeenCalledTimes(2);
    });

    it("updates isLoggedIn to false", async () => {
      const { getCaptured } = renderProvider();

      await waitFor(() =>
        expect(typeof getCaptured().setLoggedin).toBe("function")
      );

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

      await waitFor(() =>
        expect(typeof getCaptured().setHeader).toBe("function")
      );

      act(() => {
        getCaptured().setHeader("Bearer test-token");
      });

      await waitFor(() =>
        expect(getCaptured().header).toBe("Bearer test-token")
      );
    });
  });

  describe("hasRole", () => {
    it("returns true when the user has the queried role", async () => {
      const userLoader = jest.fn().mockResolvedValue({
        data: {
          logged_in: true,
          is_admin: false,
          Info: { roles: ["admin", "editor"] },
        },
      });

      const { getCaptured } = renderProvider({ userLoader });

      await waitFor(() =>
        expect(getCaptured().userInfo?.roles).toEqual(["admin", "editor"])
      );

      expect(getCaptured().hasRole(["admin"])).toBe(true);
    });

    it("returns false when the user does not have the queried role", async () => {
      const userLoader = jest.fn().mockResolvedValue({
        data: { logged_in: true, is_admin: false, Info: { roles: ["viewer"] } },
      });

      const { getCaptured } = renderProvider({ userLoader });

      await waitFor(() =>
        expect(getCaptured().userInfo?.roles).toEqual(["viewer"])
      );

      expect(getCaptured().hasRole(["admin"])).toBe(false);
    });

    it("returns false when userInfo has no roles", async () => {
      const { getCaptured } = renderProvider();

      await waitFor(() =>
        expect(typeof getCaptured().hasRole).toBe("function")
      );

      expect(getCaptured().hasRole(["admin"])).toBe(false);
    });

    it.each([undefined, null, "admin"])(
      "returns false for malformed roles input %p",
      async (roles) => {
        const { getCaptured } = renderProvider();
        await waitFor(() => expect(getCaptured().loadingUser).toBe(false));
        expect(getCaptured().hasRole(roles)).toBe(false);
      }
    );
  });

  describe("userLoader integration", () => {
    it("waits for device identity initialization before loading the session", async () => {
      useDeviceFingerprint.mockReturnValueOnce({
        deviceUID: null,
        deviceUIDReady: false,
        resetDeviceUID: mockResetMountedDeviceUID,
      });
      const userLoader = jest.fn();

      const { getCaptured } = renderProvider({ userLoader });

      expect(userLoader).not.toHaveBeenCalled();
      expect(getCaptured().loadingUser).toBe(true);
    });

    it("captures CSRF from the initial bootstrap response", async () => {
      const userLoader = jest.fn().mockResolvedValue({
        data: { logged_in: true, Info: {} },
        headers: { "x-csrf-token": "bootstrap-csrf" },
      });

      renderProvider({ userLoader });

      await waitFor(() => expect(getCsrfToken()).toBe("bootstrap-csrf"));
    });

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
      const error = new Error("network error");
      const errorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const userLoader = jest.fn().mockRejectedValue(error);

      const { getCaptured } = renderProvider({ userLoader });

      await waitFor(() => expect(getCaptured().loadingUser).toBe(false));
      expect(errorSpy).toHaveBeenCalledWith("User data fetch failed:", error);
    });

    it.each([
      [401, undefined],
      [455, { logged_in: false }],
    ])(
      "sets loadingUser to false when initial userLoader rejects with %i",
      async (status, data) => {
        const userLoader = jest.fn().mockRejectedValue({
          response: { status, data },
        });

        const { getCaptured } = renderProvider({ userLoader });

        await waitFor(() => expect(getCaptured().loadingUser).toBe(false));
        expect(getCaptured().isLoggedIn).toBe(false);
        expect(getCaptured().isAdmin).toBe(false);
        expect(getCaptured().userInfo).toEqual({});
      }
    );

    it("does not let a stale userLoader response restore a logged-out session", async () => {
      let resolveUserLoader;
      const userLoader = jest.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveUserLoader = resolve;
        })
      );

      const { getCaptured } = renderProvider({ userLoader });

      await act(async () => {
        jest.advanceTimersByTime(100);
      });
      await waitFor(() => expect(userLoader).toHaveBeenCalledTimes(1));

      act(() => {
        getCaptured().setLoggedin(false);
      });

      await act(async () => {
        resolveUserLoader({
          data: { logged_in: true, is_admin: true, Info: { name: "Stale" } },
        });
      });

      expect(getCaptured().isLoggedIn).toBe(false);
      expect(getCaptured().isAdmin).toBe(false);
      expect(getCaptured().userInfo).toEqual({});
    });
  });

  describe("onSessionChange", () => {
    it("calls onSessionChange with the resolved user session snapshot", async () => {
      const onSessionChange = jest.fn();
      const userLoader = jest.fn().mockResolvedValue({
        data: {
          logged_in: true,
          is_admin: true,
          Info: { email: "alice@example.com", roles: ["admin"] },
        },
      });

      renderProvider({ onSessionChange, userLoader });

      await waitFor(() =>
        expect(onSessionChange).toHaveBeenCalledWith({
          isLoggedIn: true,
          isAdmin: true,
          userInfo: { email: "alice@example.com", roles: ["admin"] },
          loadingUser: false,
          deviceUID: "test-device-uid",
        })
      );
    });

    it("calls onSessionChange after setLoggedin revalidates login state", async () => {
      const onSessionChange = jest.fn();
      const userLoader = jest
        .fn()
        .mockResolvedValueOnce({ data: { logged_in: false } })
        .mockResolvedValue({ data: { logged_in: true, Info: {} } });
      const { getCaptured } = renderProvider({ onSessionChange, userLoader });

      await waitFor(() =>
        expect(typeof getCaptured().setLoggedin).toBe("function")
      );

      act(() => {
        getCaptured().setLoggedin(true);
      });

      await waitFor(() =>
        expect(onSessionChange).toHaveBeenCalledWith(
          expect.objectContaining({ isLoggedIn: true })
        )
      );
    });

    it("does not crash when onSessionChange is omitted", async () => {
      const { getCaptured } = renderProvider();

      await waitFor(() => expect(getCaptured().loadingUser).toBe(false));
      expect(getCaptured().isLoggedIn).toBe(false);
    });
  });

  describe("Axios instance configuration", () => {
    it("sets withCredentials on the Axios instance", () => {
      const { mockAxios } = renderProvider();
      expect(mockAxios.defaults.withCredentials).toBe(true);
    });

    it("configures Axios XSRF defaults for cookie auth", () => {
      const { mockAxios } = renderProvider();

      expect(mockAxios.defaults.withXSRFToken).toBe(true);
      expect(mockAxios.defaults.xsrfCookieName).toBe("csrf_access_token");
      expect(mockAxios.defaults.xsrfHeaderName).toBe("X-CSRF-TOKEN");
    });

    it("does not set an Authorization header when setHeader is called", async () => {
      const { getCaptured, mockAxios } = renderProvider();

      await waitFor(() =>
        expect(typeof getCaptured().setHeader).toBe("function")
      );

      act(() => {
        getCaptured().setHeader("Bearer should-not-be-used");
      });

      await waitFor(() =>
        expect(getCaptured().header).toBe("Bearer should-not-be-used")
      );
      expect(mockAxios.defaults.headers.common).not.toHaveProperty(
        "Authorization"
      );
    });

    it("sets deviceUID and appVersion headers when values are present", () => {
      const { mockAxios } = renderProvider({ appVersion: "2.1.0" });

      expect(mockAxios.defaults.headers.common["deviceUID"]).toBe(
        "test-device-uid"
      );
      expect(mockAxios.defaults.headers.common["appVersion"]).toBe("2.1.0");
    });

    it("removes stale deviceUID and appVersion headers when values are absent", () => {
      useDeviceFingerprint.mockReturnValueOnce({
        deviceUID: null,
        resetDeviceUID: mockResetMountedDeviceUID,
      });
      const axiosInstance = createMockAxios();
      axiosInstance.defaults.headers.common["deviceUID"] = "stale-device";
      axiosInstance.defaults.headers.common["appVersion"] = "stale-version";

      renderProvider({ axiosInstance, appVersion: null });

      expect(axiosInstance.defaults.headers.common).not.toHaveProperty(
        "deviceUID"
      );
      expect(axiosInstance.defaults.headers.common).not.toHaveProperty(
        "appVersion"
      );
    });

    it("registers a response interceptor", () => {
      const { mockAxios } = renderProvider();
      expect(mockAxios.interceptors.response.use).toHaveBeenCalledTimes(1);
    });

    it("passes successful responses through the registered interceptor", () => {
      const { mockAxios } = renderProvider();
      const [onFulfilled] = mockAxios.interceptors.response.use.mock.calls[0];
      const response = { data: { ok: true } };

      expect(onFulfilled(response)).toBe(response);
    });

    it("clears the complete session when the interceptor handles session expiry", async () => {
      const userLoader = jest.fn().mockResolvedValue({
        data: { logged_in: true, is_admin: true, Info: { name: "Alice" } },
      });
      const { getCaptured, mockAxios } = renderProvider({ userLoader });

      await waitFor(() => expect(getCaptured().isLoggedIn).toBe(true));
      expect(getCaptured().isAdmin).toBe(true);
      expect(getCaptured().userInfo).toEqual({ name: "Alice" });

      const [, onRejected] = mockAxios.interceptors.response.use.mock.calls[0];
      const error = { response: { status: 401 } };

      await expect(onRejected(error)).rejects.toBe(error);
      await waitFor(() => expect(getCaptured().isLoggedIn).toBe(false));
      expect(getCaptured().isAdmin).toBe(false);
      expect(getCaptured().userInfo).toEqual({});
      expect(mockAxios.defaults.headers.common).not.toHaveProperty(
        "Authorization"
      );
    });

    it("ejects the response interceptor on unmount", () => {
      const { mockAxios, unmount } = renderProvider();

      unmount();

      expect(mockAxios.interceptors.response.eject).toHaveBeenCalledWith(1);
    });
  });

  describe("cross-site CSRF transport", () => {
    it("captures X-CSRF-TOKEN from a successful response", () => {
      const { mockAxios } = renderProvider();
      const [onFulfilled] = mockAxios.interceptors.response.use.mock.calls[0];

      onFulfilled({ headers: { "x-csrf-token": "csrf-abc" } });

      expect(getCsrfToken()).toBe("csrf-abc");
    });

    it("captures X-CSRF-TOKEN using the uppercase header spelling", () => {
      const { mockAxios } = renderProvider();
      const [onFulfilled] = mockAxios.interceptors.response.use.mock.calls[0];

      onFulfilled({ headers: { "X-CSRF-TOKEN": "csrf-upper" } });

      expect(getCsrfToken()).toBe("csrf-upper");
    });

    it("registers a request interceptor exactly once per instance", () => {
      const { mockAxios } = renderProvider();

      expect(mockAxios.interceptors.request.use).toHaveBeenCalledTimes(1);
    });

    it("attaches the captured CSRF token to unsafe methods", () => {
      const { mockAxios } = renderProvider();
      const [responseOnFulfilled] =
        mockAxios.interceptors.response.use.mock.calls[0];
      const [requestOnFulfilled] =
        mockAxios.interceptors.request.use.mock.calls[0];

      responseOnFulfilled({ headers: { "x-csrf-token": "csrf-post" } });

      for (const method of ["post", "put", "patch", "delete"]) {
        const config = { method, headers: {} };
        expect(requestOnFulfilled(config)).toBe(config);
        expect(config.headers["X-CSRF-TOKEN"]).toBe("csrf-post");
      }
    });

    it("does not attach a CSRF token to safe methods", () => {
      const { mockAxios } = renderProvider();
      const [responseOnFulfilled] =
        mockAxios.interceptors.response.use.mock.calls[0];
      const [requestOnFulfilled] =
        mockAxios.interceptors.request.use.mock.calls[0];

      responseOnFulfilled({ headers: { "x-csrf-token": "csrf-safe" } });

      for (const method of ["get", "head", "options"]) {
        const config = { method, headers: {} };
        requestOnFulfilled(config);
        expect(config.headers["X-CSRF-TOKEN"]).toBeUndefined();
      }
    });

    it("does not attach a CSRF token when none has been captured", () => {
      const { mockAxios } = renderProvider();
      const [requestOnFulfilled] =
        mockAxios.interceptors.request.use.mock.calls[0];

      const config = { method: "post", headers: {} };
      requestOnFulfilled(config);

      expect(config.headers["X-CSRF-TOKEN"]).toBeUndefined();
    });

    it("replaces the previous CSRF token after a refresh response", () => {
      const { mockAxios } = renderProvider();
      const [responseOnFulfilled] =
        mockAxios.interceptors.response.use.mock.calls[0];

      responseOnFulfilled({ headers: { "x-csrf-token": "csrf-old" } });
      expect(getCsrfToken()).toBe("csrf-old");

      responseOnFulfilled({ headers: { "x-csrf-token": "csrf-new" } });
      expect(getCsrfToken()).toBe("csrf-new");
    });

    it("clears the CSRF token on session invalidation (401)", async () => {
      const { mockAxios } = renderProvider();
      const [responseOnFulfilled, responseOnRejected] =
        mockAxios.interceptors.response.use.mock.calls[0];

      responseOnFulfilled({ headers: { "x-csrf-token": "csrf-401" } });
      expect(getCsrfToken()).toBe("csrf-401");

      await expect(
        responseOnRejected({ response: { status: 401 } })
      ).rejects.toBeDefined();
      expect(getCsrfToken()).toBeNull();
    });

    it("does not persist the CSRF token to localStorage or sessionStorage", () => {
      const { mockAxios } = renderProvider();
      const [responseOnFulfilled] =
        mockAxios.interceptors.response.use.mock.calls[0];

      responseOnFulfilled({ headers: { "x-csrf-token": "csrf-nostore" } });

      expect(localStorage.getItem("X-CSRF-TOKEN")).toBeNull();
      expect(sessionStorage.getItem("X-CSRF-TOKEN")).toBeNull();
      expect(localStorage.getItem("csrf_access_token")).toBeNull();
      expect(sessionStorage.getItem("csrf_access_token")).toBeNull();
    });

    it("ejects the request interceptor on unmount", () => {
      const { mockAxios, unmount } = renderProvider();

      unmount();

      expect(mockAxios.interceptors.request.eject).toHaveBeenCalledWith(2);
    });

    it("keeps legacy same-site Axios XSRF defaults configured", () => {
      const { mockAxios } = renderProvider();

      expect(mockAxios.defaults.withXSRFToken).toBe(true);
      expect(mockAxios.defaults.xsrfCookieName).toBe("csrf_access_token");
      expect(mockAxios.defaults.xsrfHeaderName).toBe("X-CSRF-TOKEN");
    });

    it("uses an explicit in-memory token even though Axios may read a cookie", () => {
      setCsrfToken("explicit-in-memory");
      const { mockAxios } = renderProvider();
      const [requestOnFulfilled] =
        mockAxios.interceptors.request.use.mock.calls[0];

      const config = { method: "post", headers: {} };
      requestOnFulfilled(config);

      expect(config.headers["X-CSRF-TOKEN"]).toBe("explicit-in-memory");
    });
  });

  describe("session restoration from storage", () => {
    it("does not call refreshToken when a token is in localStorage", async () => {
      localStorage.setItem("Authorization", "Bearer stored-local-token");

      const refreshToken = jest
        .fn()
        .mockResolvedValue({ access_token: "new-token", refreshed: false });

      renderProvider({ refreshToken });

      await waitFor(() => expect(refreshToken).not.toHaveBeenCalled());
      expect(localStorage.getItem("Authorization")).toBeNull();
    });

    it("does not call refreshToken when a token is in sessionStorage", async () => {
      sessionStorage.setItem("Authorization", "Bearer stored-session-token");

      const refreshToken = jest
        .fn()
        .mockResolvedValue({ access_token: "new-token", refreshed: false });

      renderProvider({ refreshToken });

      await waitFor(() => expect(refreshToken).not.toHaveBeenCalled());
      expect(sessionStorage.getItem("Authorization")).toBeNull();
    });

    it("clears legacy Authorization values from both browser storage areas", async () => {
      localStorage.setItem("Authorization", "Bearer local-token");
      sessionStorage.setItem("Authorization", "Bearer session-token");

      const refreshToken = jest
        .fn()
        .mockResolvedValue({ access_token: "new-token", refreshed: false });

      renderProvider({ refreshToken });

      await waitFor(() => expect(refreshToken).not.toHaveBeenCalled());
      expect(localStorage.getItem("Authorization")).toBeNull();
      expect(sessionStorage.getItem("Authorization")).toBeNull();
    });
  });

  describe("periodic session refresh", () => {
    it("calls refreshToken as an optional session ping while logged in", async () => {
      const refreshToken = jest.fn().mockResolvedValue({
        refreshed: true,
      });
      const userLoader = jest.fn().mockResolvedValue({
        data: { logged_in: true, is_admin: false, Info: {} },
      });
      const { getCaptured } = renderProvider({
        refreshToken,
        userLoader,
        refreshTimer: 0.001,
      });

      await waitFor(() =>
        expect(typeof getCaptured().setLoggedin).toBe("function")
      );
      refreshToken.mockClear();
      act(() => {
        getCaptured().setLoggedin(true);
      });

      await act(async () => {
        jest.advanceTimersByTime(170);
      });

      await waitFor(() => expect(refreshToken).toHaveBeenCalled());
      expect(sessionStorage.getItem("Authorization")).toBeNull();
    });

    it("keeps the current session when refreshToken has a transient failure", async () => {
      const transientError = { response: { status: 503 } };
      const errorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const refreshToken = jest.fn().mockRejectedValue(transientError);
      const userLoader = jest.fn().mockResolvedValue({
        data: { logged_in: true, is_admin: true, Info: { name: "Alice" } },
      });

      const { getCaptured } = renderProvider({
        refreshToken,
        userLoader,
        refreshTimer: 0.001,
      });
      await waitFor(() => expect(getCaptured().isLoggedIn).toBe(true));

      await act(async () => {
        jest.advanceTimersByTime(170);
      });

      await waitFor(() => expect(refreshToken).toHaveBeenCalled());
      expect(getCaptured().isLoggedIn).toBe(true);
      expect(getCaptured().isAdmin).toBe(true);
      expect(getCaptured().userInfo).toEqual({ name: "Alice" });
      expect(errorSpy).toHaveBeenCalledWith(
        "Session refresh failed:",
        transientError
      );
    });

    it("clears the complete session when refreshToken receives an auth failure", async () => {
      const refreshToken = jest.fn().mockRejectedValue({
        response: { status: 401 },
      });
      const userLoader = jest.fn().mockResolvedValue({
        data: { logged_in: true, is_admin: true, Info: { name: "Alice" } },
      });

      const { getCaptured } = renderProvider({
        refreshToken,
        userLoader,
        refreshTimer: 0.001,
      });
      await waitFor(() => expect(getCaptured().isLoggedIn).toBe(true));

      await act(async () => {
        jest.advanceTimersByTime(170);
      });

      await waitFor(() => expect(getCaptured().isLoggedIn).toBe(false));
      expect(getCaptured().isAdmin).toBe(false);
      expect(getCaptured().userInfo).toEqual({});
    });
  });

  describe("manual user data refresh", () => {
    it("refreshes the complete session snapshot when refreshData is set", async () => {
      const userLoader = jest
        .fn()
        .mockResolvedValueOnce({
          data: { logged_in: true, is_admin: false, Info: { name: "Initial" } },
        })
        .mockResolvedValueOnce({
          data: {
            logged_in: true,
            is_admin: true,
            Info: { name: "Refreshed" },
          },
        });

      const { getCaptured } = renderProvider({ userLoader });
      await waitFor(() =>
        expect(getCaptured().userInfo).toEqual({ name: "Initial" })
      );
      expect(getCaptured().isAdmin).toBe(false);

      act(() => {
        getCaptured().setRefreshData(true);
      });

      await waitFor(() =>
        expect(getCaptured().userInfo).toEqual({ name: "Refreshed" })
      );
      expect(getCaptured().isLoggedIn).toBe(true);
      expect(getCaptured().isAdmin).toBe(true);
      await waitFor(() => expect(getCaptured().refreshData).toBe(false));
    });

    it("clears the complete session when refreshData reports logged out", async () => {
      const userLoader = jest
        .fn()
        .mockResolvedValueOnce({
          data: { logged_in: true, is_admin: true, Info: { name: "Initial" } },
        })
        .mockResolvedValueOnce({
          data: { logged_in: false, is_admin: true, Info: { name: "Stale" } },
        });

      const { getCaptured } = renderProvider({ userLoader });
      await waitFor(() => expect(getCaptured().isLoggedIn).toBe(true));

      act(() => {
        getCaptured().setRefreshData(true);
      });

      await waitFor(() => expect(getCaptured().isLoggedIn).toBe(false));
      expect(getCaptured().isAdmin).toBe(false);
      expect(getCaptured().userInfo).toEqual({});
      await waitFor(() => expect(getCaptured().refreshData).toBe(false));
    });

    it("resets refreshData when the refresh response is invalid", async () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const userLoader = jest
        .fn()
        .mockResolvedValueOnce({
          data: { logged_in: true, is_admin: false, Info: { name: "Initial" } },
        })
        .mockResolvedValueOnce(null);

      const { getCaptured } = renderProvider({ userLoader });
      await waitFor(() =>
        expect(getCaptured().userInfo).toEqual({ name: "Initial" })
      );

      act(() => {
        getCaptured().setRefreshData(true);
      });

      await waitFor(() =>
        expect(warnSpy).toHaveBeenCalledWith("Invalid refresh data response")
      );
      await waitFor(() => expect(getCaptured().refreshData).toBe(false));
    });

    it("resets refreshData when user refresh fails", async () => {
      const errorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const refreshError = new Error("refresh user failed");
      const userLoader = jest
        .fn()
        .mockResolvedValueOnce({
          data: { logged_in: true, is_admin: false, Info: { name: "Initial" } },
        })
        .mockRejectedValueOnce(refreshError);

      const { getCaptured } = renderProvider({ userLoader });
      await waitFor(() =>
        expect(getCaptured().userInfo).toEqual({ name: "Initial" })
      );

      act(() => {
        getCaptured().setRefreshData(true);
      });

      await waitFor(() =>
        expect(errorSpy).toHaveBeenCalledWith(
          "Error refreshing user data:",
          refreshError
        )
      );
      await waitFor(() => expect(getCaptured().refreshData).toBe(false));
    });
  });

  describe("cross-tab storage event", () => {
    it("ignores legacy Authorization storage events", async () => {
      const refreshToken = jest.fn().mockResolvedValue({
        refreshed: true,
      });

      renderProvider({ refreshToken });

      act(() => {
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "Authorization",
            newValue: "Bearer cross-tab-token",
          })
        );
      });

      await act(async () => jest.advanceTimersByTime(300));
      expect(refreshToken).not.toHaveBeenCalled();
      expect(localStorage.getItem("Authorization")).toBeNull();
      expect(sessionStorage.getItem("Authorization")).toBeNull();
    });

    it("ignores storage events for other keys", async () => {
      const refreshToken = jest.fn().mockResolvedValue(null);

      renderProvider({ refreshToken });

      act(() => {
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "SomeOtherKey",
            newValue: "value",
          })
        );
      });

      // Flush all async work and confirm refreshToken was never called
      await act(async () => jest.advanceTimersByTime(300));
      expect(refreshToken).not.toHaveBeenCalled();
    });
  });
});
