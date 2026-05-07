import React from "react";
import { toast } from "react-toastify";
import { GppBad, Update, Logout } from "./Icons";

/**
 * Centralised Axios response error handler.
 *
 * @param {Error} error - The Axios error object.
 * @param {object} [options]
 * @param {Function} [options.onSessionExpired] - Called when the session is
 *   invalidated (HTTP 401 or custom 455) so the caller can clear auth state.
 * @returns {Promise} Always rejects with the original error.
 */
const handleApiError = (error, { onSessionExpired } = {}) => {
  const status = error?.response?.status;

  switch (status) {
    case 401:
      onSessionExpired?.();
      toast.error("Unauthorized – please log in.", {
        toastId: "ERR_UNAUTHORIZED",
        icon: <Logout />,
      });
      break;

    case 403:
      toast.error("You don't have permission to do this.", {
        toastId: "ERR_FORBIDDEN",
        icon: <GppBad />,
      });
      break;

    case 426: {
      sessionStorage.setItem("appVersionOld", true);
      sessionStorage.setItem(
        "requiredVersion",
        error.response.data.minVersion
      );
      const reloads = parseInt(sessionStorage.getItem("appReloads") || 0);
      if (reloads < 2) {
        sessionStorage.setItem("appReloads", reloads + 1);
        setTimeout(() => {
          if ("caches" in window) {
            caches
              .keys()
              .then((cacheNames) =>
                Promise.all(cacheNames.map((name) => caches.delete(name)))
              )
              .catch((err) => console.log("Cache clear error:", err))
              .finally(() => window.location.reload());
          } else {
            window.location.reload();
          }
        }, 1000 * (reloads + 1));
      } else {
        toast.warning(
          "The application needs to be updated please wait for some time then reload the page.",
          { toastId: "appReloadError", icon: <Update /> }
        );
      }
      break;
    }

    case 455: {
      const loggedIn = error.response.data.logged_in || false;
      if (!loggedIn) {
        onSessionExpired?.();
        toast.info("Your session is no longer valid, please login again.", {
          toastId: "Forced_log_out",
          icon: <Logout />,
        });
      }
      break;
    }

    case 500:
      toast.error("Server error, please try again later.", {
        toastId: "ERR_SERVER",
        icon: <GppBad />,
      });
      break;

    case 503:
      toast.error("Service unavailable, please try again later.", {
        toastId: "ERR_SERVICE_UNAVAILABLE",
        icon: <GppBad />,
      });
      break;

    default:
      if (!status) {
        if (
          error?.code !== "ERR_CANCELED" &&
          error?.message !== "canceled"
        ) {
          if (
            error?.code === "ECONNABORTED" ||
            error?.code === "ETIMEDOUT"
          ) {
            toast.error(
              "Request timed out. The server is taking too long to respond.",
              { toastId: "ERR_TIMEOUT", icon: <GppBad /> }
            );
          } else {
            toast.error(
              "The server is not responding, please reload or try again later.",
              { toastId: "ERR_CONNECTION_REFUSED", icon: <GppBad /> }
            );
          }
        }
      }
      break;
  }

  return Promise.reject(error);
};

export default handleApiError;
