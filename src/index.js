import { createContext, useState, useEffect, useCallback } from "react";
import handleApiError from "./components/handleApiError";
import VersionProtection from "./components/VersionProtection";
import getDeviceFingerprint from "./components/FingerPrint";
import useDeviceFingerprint from "./hooks/useDeviceFingerprint";

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
  loadingUser: null,
});

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
  const deviceUID = useDeviceFingerprint(AuthenticatedAxiosObject);

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

  useEffect(() => {
    onSessionChange?.({
      isLoggedIn: currentLoggedIn,
      isAdmin,
      userInfo,
      loadingUser,
      deviceUID,
    });
  }, [onSessionChange, currentLoggedIn, isAdmin, userInfo, loadingUser, deviceUID]);

  useEffect(() => {
    const userLoaderTimer = setTimeout(() => {
      userLoader()
        .then((res) => {
          if (res && res.data) {
            const data = res.data;
            setCurrentLoggedIn(data.logged_in);
            setIsAdmin(data.is_admin);
            setUserInfo(data.Info);
          } else {
            console.warn("Invalid user data response");
          }
        })
        .catch((err) => {
          console.error("User data fetch failed:", err);
        })
        .finally(() => {
          setLoadingUser(false);
        });
    }, 100);

    return () => clearTimeout(userLoaderTimer);
  }, [current, currentLoggedIn, userLoader]);

  const setLoggedin = (status) => setCurrentLoggedIn(status);

  // Optionally ping/refresh the server-side cookie session while logged in. This
  // no longer reads, writes, or rotates bearer tokens in browser storage.
  useEffect(() => {
    const intervalMs = (refreshTimer || 60) * 60 * 1000;

    if (!currentLoggedIn || typeof refreshToken !== "function") return;

    const interval = setInterval(() => {
      refreshToken().catch((err) => {
        console.error("Session refresh failed:", err);
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [currentLoggedIn, refreshTimer, refreshToken]);

  // Eject/re-register the Axios response interceptor when the instance changes
  useEffect(() => {
    const onSessionExpired = () => {
      setCurrentLoggedIn(false);
      delete AuthenticatedAxiosObject.defaults.headers.common["Authorization"];
    };

    const interceptorId = AuthenticatedAxiosObject.interceptors.response.use(
      (response) => response,
      (error) => handleApiError(error, { onSessionExpired })
    );

    return () => {
      AuthenticatedAxiosObject.interceptors.response.eject(interceptorId);
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

    userLoader()
      .then((res) => {
        if (res && res.data) {
          setUserInfo(res.data.Info);
        } else {
          console.warn("Invalid refresh data response");
        }
      })
      .catch((err) => {
        console.error("Error refreshing user data:", err);
      })
      .finally(() => {
        setRefreshData(false);
      });
  }, [refreshData, userLoader]);

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
};
export default SessionManagerProvider;
