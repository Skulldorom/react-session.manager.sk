import handleApiError from "../src/components/handleApiError.js";

jest.mock("react-toastify", () => ({
  toast: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  },
}));

// Icons render fine after Babel JSX transform – no extra mock needed.

const { toast } = require("react-toastify");

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  // Reset window.location.reload mock
  Object.defineProperty(window, "location", {
    value: { reload: jest.fn() },
    writable: true,
  });
});

describe("handleApiError", () => {
  describe("401 Unauthorized", () => {
    it("calls onSessionExpired and shows an error toast", async () => {
      const onSessionExpired = jest.fn();
      const error = { response: { status: 401 } };

      await expect(
        handleApiError(error, { onSessionExpired })
      ).rejects.toEqual(error);

      expect(onSessionExpired).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Unauthorized"),
        expect.objectContaining({ toastId: "ERR_UNAUTHORIZED" })
      );
    });

    it("works without onSessionExpired option", async () => {
      const error = { response: { status: 401 } };
      await expect(handleApiError(error)).rejects.toEqual(error);
      expect(toast.error).toHaveBeenCalledTimes(1);
    });
  });

  describe("403 Forbidden", () => {
    it("shows a forbidden error toast", async () => {
      const error = { response: { status: 403 } };

      await expect(handleApiError(error)).rejects.toEqual(error);

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("permission"),
        expect.objectContaining({ toastId: "ERR_FORBIDDEN" })
      );
    });
  });

  describe("426 Upgrade Required", () => {
    it("auto-reloads on first attempt and updates sessionStorage", async () => {
      jest.useFakeTimers();
      const minVersion = "2.0.0";
      const error = {
        response: {
          status: 426,
          data: { minVersion },
        },
      };

      await expect(handleApiError(error)).rejects.toEqual(error);

      expect(sessionStorage.getItem("appVersionOld")).toBe("true");
      expect(sessionStorage.getItem("requiredVersion")).toBe(minVersion);
      expect(sessionStorage.getItem("appReloads")).toBe("1");

      // The reload is triggered inside a setTimeout – advance the timer.
      jest.runAllTimers();
      expect(window.location.reload).toHaveBeenCalledTimes(1);
      jest.useRealTimers();
    });

    it("shows an update warning after two reload attempts", async () => {
      jest.useFakeTimers();
      sessionStorage.setItem("appReloads", "2");
      const error = {
        response: {
          status: 426,
          data: { minVersion: "2.0.0" },
        },
      };

      await expect(handleApiError(error)).rejects.toEqual(error);

      jest.runAllTimers();
      expect(window.location.reload).not.toHaveBeenCalled();
      expect(toast.warning).toHaveBeenCalledWith(
        expect.stringContaining("updated"),
        expect.objectContaining({ toastId: "appReloadError" })
      );
      jest.useRealTimers();
    });
  });

  describe("455 Custom Session Error", () => {
    it("calls onSessionExpired and shows info toast when logged_in is false", async () => {
      const onSessionExpired = jest.fn();
      const error = {
        response: {
          status: 455,
          data: { logged_in: false },
        },
      };

      await expect(
        handleApiError(error, { onSessionExpired })
      ).rejects.toEqual(error);

      expect(onSessionExpired).toHaveBeenCalledTimes(1);
      expect(toast.info).toHaveBeenCalledWith(
        expect.stringContaining("session"),
        expect.objectContaining({ toastId: "Forced_log_out" })
      );
    });

    it("does nothing extra when logged_in is true", async () => {
      const onSessionExpired = jest.fn();
      const error = {
        response: {
          status: 455,
          data: { logged_in: true },
        },
      };

      await expect(
        handleApiError(error, { onSessionExpired })
      ).rejects.toEqual(error);

      expect(onSessionExpired).not.toHaveBeenCalled();
      expect(toast.info).not.toHaveBeenCalled();
    });
  });

  describe("500 Internal Server Error", () => {
    it("shows a server error toast", async () => {
      const error = { response: { status: 500 } };

      await expect(handleApiError(error)).rejects.toEqual(error);

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Server error"),
        expect.objectContaining({ toastId: "ERR_SERVER" })
      );
    });
  });

  describe("503 Service Unavailable", () => {
    it("shows a service unavailable toast", async () => {
      const error = { response: { status: 503 } };

      await expect(handleApiError(error)).rejects.toEqual(error);

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("unavailable"),
        expect.objectContaining({ toastId: "ERR_SERVICE_UNAVAILABLE" })
      );
    });
  });

  describe("No response (network / timeout errors)", () => {
    it("does nothing for a canceled request (ERR_CANCELED)", async () => {
      const error = { code: "ERR_CANCELED" };

      await expect(handleApiError(error)).rejects.toEqual(error);

      expect(toast.error).not.toHaveBeenCalled();
      expect(toast.warn).not.toHaveBeenCalled();
    });

    it("does nothing for a request canceled via message", async () => {
      const error = { message: "canceled" };

      await expect(handleApiError(error)).rejects.toEqual(error);

      expect(toast.error).not.toHaveBeenCalled();
    });

    it("shows a timeout toast for ECONNABORTED", async () => {
      const error = { code: "ECONNABORTED" };

      await expect(handleApiError(error)).rejects.toEqual(error);

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("timed out"),
        expect.objectContaining({ toastId: "ERR_TIMEOUT" })
      );
    });

    it("shows a timeout toast for ETIMEDOUT", async () => {
      const error = { code: "ETIMEDOUT" };

      await expect(handleApiError(error)).rejects.toEqual(error);

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("timed out"),
        expect.objectContaining({ toastId: "ERR_TIMEOUT" })
      );
    });

    it("shows a connection refused toast for unrecognised network error", async () => {
      const error = { code: "ECONNREFUSED" };

      await expect(handleApiError(error)).rejects.toEqual(error);

      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("not responding"),
        expect.objectContaining({ toastId: "ERR_CONNECTION_REFUSED" })
      );
    });
  });

  describe("always returns a rejected promise", () => {
    it("rejects for known status codes", async () => {
      const error = { response: { status: 401 } };
      await expect(handleApiError(error)).rejects.toBe(error);
    });

    it("rejects for unknown status codes", async () => {
      const error = { response: { status: 418 } };
      await expect(handleApiError(error)).rejects.toBe(error);
    });
  });
});
