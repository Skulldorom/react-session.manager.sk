import { createContext, useState, useEffect, useCallback, useRef } from "react";
import handleApiError from "./components/handleApiError";
import VersionProtection from "./components/VersionProtection";
import getDeviceFingerprint, { resetDeviceUID } from "./components/FingerPrint";
import useDeviceFingerprint from "./hooks/useDeviceFingerprint";
import {
  CSRF_HEADER_NAME,
  captureCsrfFromResponse,
  clearCsrfToken,
  getCsrfToken,
  isUnsafeMethod,
} from "./csrf";

// Notifications
import { ToastContainer } from "react-toastify";
// Styling for react-toastify
import "react-toastify/dist/ReactToastify.css";
import "./styling/toast.css";

const SessionManagerContext = createContext({
  isLoggedIn: null,
  header: null,
  isAdmin: null,
  userInfo: null,
  refreshData: null,
  setHeader: null,
  setLoggedin: null,
  setRefreshData: null,
  hasRole: null,
  deviceUID: null,
  resetDeviceUID: null,
  loadingUser: null,
});

const isAuthFailure = (err) => {
  const status = err?.response?.status;
  if (status === 401) return true;
  if (status === 455) return err?.response?.data?.logged_in !== true;
  return false;
};

const SessionManagerProvider = ({
  AuthenticatedAxiosObject,
  refreshTimer,
  dataRefresh,
  userLoader,
  refreshToken,
  appVersion,
  onSessionChange,
  toastOptions,
  children,
}) => {
  const { deviceUID, resetDeviceUID: resetMountedDeviceUID } =
    useDeviceFingerprint(AuthenticatedAxiosObject);
  const sessionGenerationRef = useRef(0);

  // Deprecated compatibility state. Browser auth is cookie-based; this value is
  // exposed only so older consumers that still destructure `header` do not crash.
  const [current, setCurrent] = useState("");

  // Set up axios defaults when instance / device info changes
  useEffect(() => {
    AuthenticatedAxiosObject.defaults.withCredentials = true;
    AuthenticatedAxiosObject.defaults.withXSRFToken = true;
    AuthenticatedAxiosObject.defaults.xsrfCookieName = "csrf_access_token";
    AuthenticatedAxiosObject.defaults.xsrfHeaderName = "X-CSRF-TOKEN";

    if (deviceUID) {
      AuthenticatedAxiosObject.defaults.headers.common["deviceUID"] = deviceUID;
    } else {
      delete AuthenticatedAxiosObject.defaults.headers.common["deviceUID"];
    }

    if (appVersion) {
      AuthenticatedAxiosObject.defaults.headers.common["appVersion"] =
        appVersion;
    } else {
      delete AuthenticatedAxiosObject.defaults.headers.common["appVersion"];
    }
  }, [AuthenticatedAxiosObject, deviceUID, appVersion]);

  // Browser auth is transported by HttpOnly cookies. Never let this provider set
  // a bearer Authorization header from JavaScript-accessible state.
  useEffect(() => {
    delete AuthenticatedAxiosObject.defaults.headers.common["Authorization"];
  }, [AuthenticatedAxiosObject, current]);

  const clearLegacyAuthorizationStorage = useCallback(() => {
    localStorage.removeItem("Authorization");
    sessionStorage.removeItem("Authorization");
  }, []);

  // Remove old bearer tokens left by previous package/frontend versions. The
  // backend owns HttpOnly cookie lifetime and cleanup.
  useEffect(() => {
    clearLegacyAuthorizationStorage();
  }, [clearLegacyAuthorizationStorage]);

  // Keep clearing legacy bearer storage if another old tab writes it.
  useEffect(() => {
    const handleStorageChange = (event) => {
      if (event.key === "Authorization") {
        clearLegacyAuthorizationStorage();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [clearLegacyAuthorizationStorage]);

  const setHeader = (header) => setCurrent(header);

  const [currentLoggedIn, setCurrentLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userInfo, setUserInfo] = useState({});
  const [loadingUser, setLoadingUser] = useState(true);

  const applySessionSnapshot = useCallback((data, generation) => {
    if (generation !== sessionGenerationRef.current) return false;

    const loggedIn = Boolean(data?.logged_in);
    setCurrentLoggedIn(loggedIn);
    setIsAdmin(loggedIn ? Boolean(data?.is_admin) : false);
    setUserInfo(loggedIn ? (data?.Info ?? {}) : {});
    return true;
  }, []);

  const invalidateSession = useCallback(() => {
    sessionGenerationRef.current += 1;
    setCurrentLoggedIn(false);
    setIsAdmin(false);
    setUserInfo({});
    // Session invalidation can race the initial userLoader request. End the
    // initial loading state here because that request's generation becomes
    // stale and its finally handler must not update state afterward.
    setLoadingUser(false);
    delete AuthenticatedAxiosObject.defaults.headers.common["Authorization"];
    clearCsrfToken();
  }, [AuthenticatedAxiosObject]);

  const loadUserSnapshot = useCallback(
    ({ markLoaded = false, warnMessage = "Invalid user data response" } = {}) => {
      const generation = sessionGenerationRef.current;

      return userLoader()
        .then((res) => {
          if (res && res.data) {
            applySessionSnapshot(res.data, generation);
          } else {
            console.warn(warnMessage);
          }
        })
        .catch((err) => {
          if (isAuthFailure(err)) {
            invalidateSession();
          } else if (warnMessage === "Invalid refresh data response") {
            console.error("Error refreshing user data:", err);
          } else {
            console.error("User data fetch failed:", err);
          }
        })
        .finally(() => {
          if (markLoaded && generation === sessionGenerationRef.current) {
            setLoadingUser(false);
          }
        });
    },
    [applySessionSnapshot, invalidateSession, userLoader]
  );

  useEffect(() => {
    const userLoaderTimer = setTimeout(() => {
      loadUserSnapshot({ markLoaded: true });
    }, 100);

    return () => clearTimeout(userLoaderTimer);
  }, [loadUserSnapshot]);

  const setLoggedin = useCallback(
    (status) => {
      if (status) {
        setCurrentLoggedIn(true);
        return;
      }
      invalidateSession();
    },
    [invalidateSession]
  );

  useEffect(() => {
    onSessionChange?.({
      isLoggedIn: currentLoggedIn,
      isAdmin,
      userInfo,
      loadingUser,
      deviceUID,
    });
  }, [onSessionChange, currentLoggedIn, isAdmin, userInfo, loadingUser, deviceUID]);

  // Optionally ping/refresh the server-side cookie session while logged in. This
  // no longer reads, writes, or rotates bearer tokens in browser storage.
  useEffect(() => {
    const intervalMs = (refreshTimer || 60) * 60 * 1000;

    if (!currentLoggedIn || typeof refreshToken !== "function") return;

    const interval = setInterval(() => {
      refreshToken()
        .then(() => loadUserSnapshot())
        .catch((err) => {
          if (isAuthFailure(err)) {
            invalidateSession();
          } else {
            console.error("Session refresh failed:", err);
          }
        });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [currentLoggedIn, refreshTimer, refreshToken, loadUserSnapshot, invalidateSession]);

  // Eject/re-register the Axios response interceptor when the instance changes
  useEffect(() => {
    const interceptorId = AuthenticatedAxiosObject.interceptors.response.use(
      (response) => {
        // Cross-site CSRF: capture any X-CSRF-TOKEN the backend returned so
        // subsequent unsafe requests can attach it. Same-site deployments still
        // rely on Axios reading the csrf_access_token cookie.
        captureCsrfFromResponse(response);
        return response;
      },
      (error) => handleApiError(error, { onSessionExpired: invalidateSession })
    );

    return () => {
      AuthenticatedAxiosObject.interceptors.response.eject(interceptorId);
    };
  }, [AuthenticatedAxiosObject, invalidateSession]);

  // Attach the in-memory CSRF token to unsafe requests. Registered once per
  // instance and ejected on cleanup so remounts never stack interceptors.
  useEffect(() => {
    const interceptorId = AuthenticatedAxiosObject.interceptors.request.use(
      (config) => {
        const csrfToken = getCsrfToken();
        if (csrfToken && isUnsafeMethod(config?.method)) {
          config.headers = config.headers || {};
          config.headers[CSRF_HEADER_NAME] = csrfToken;
        }
        return config;
      }
    );

    return () => {
      AuthenticatedAxiosObject.interceptors.request.eject(interceptorId);
    };
  }, [AuthenticatedAxiosObject]);

  // Periodic user-data refresh flag
  const [refreshData, setRefreshData] = useState(false);

  useEffect(() => {
    const delayMs = (dataRefresh || 60) * 60 * 1000;
    const timer = setTimeout(() => setRefreshData(true), delayMs);
    return () => clearTimeout(timer);
  }, [dataRefresh]);

  useEffect(() => {
    if (!refreshData) return;

    loadUserSnapshot({ warnMessage: "Invalid refresh data response" }).finally(
      () => {
        setRefreshData(false);
      }
    );
  }, [refreshData, loadUserSnapshot]);

  const hasRole = (roles) =>
    roles.some((r) => userInfo?.roles?.indexOf(r) >= 0);

  const contextValue = {
    isLoggedIn: currentLoggedIn,
    header: current,
    isAdmin,
    userInfo,
    refreshData,
    setHeader,
    setLoggedin,
    setRefreshData,
    hasRole,
    deviceUID,
    resetDeviceUID: resetMountedDeviceUID,
    loadingUser,
  };

  return (
    <SessionManagerContext value={contextValue}>
      <ToastContainer
        position="top-left"
        autoClose={5000}
        closeOnClick
        pauseOnFocusLoss
        pauseOnHover
        newestOnTop={false}
        toastClassName={"custToast materialToast"}
        {...toastOptions}
      />
      <VersionProtection appVersion={appVersion} />
      {children}
    </SessionManagerContext>
  );
};

export {
  SessionManagerContext as SessionManager,
  SessionManagerProvider,
  getDeviceFingerprint,
  resetDeviceUID,
};
export default SessionManagerProvider;
