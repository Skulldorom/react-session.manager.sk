import { createContext, useState, useEffect, useCallback } from "react";
import handleApiError from "./components/handleApiError";
import VersionProtection from "./components/VersionProtection";
import getDeviceFingerprint from "./components/FingerPrint";
import useDeviceFingerprint from "./hooks/useDeviceFingerprint";
import { Logout } from "./components/Icons";
// Notifications
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./styling/toast.css";

const SessionManager = createContext({
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
  toastOptions,
  children,
}) => {
  const deviceUID = useDeviceFingerprint(AuthenticatedAxiosObject);

  // State to hold the current Authorization header value
  const [current, setCurrent] = useState("");

  // Set up axios defaults when instance / device info changes
  useEffect(() => {
    /* eslint-disable react-hooks/immutability -- intentional: configure axios defaults */
    AuthenticatedAxiosObject.defaults.withCredentials = true;

    if (deviceUID) {
      AuthenticatedAxiosObject.defaults.headers.common["deviceUID"] = deviceUID;
    } else {
      delete AuthenticatedAxiosObject.defaults.headers.common["deviceUID"];
    }

    if (appVersion) {
      AuthenticatedAxiosObject.defaults.headers.common["appVersion"] = appVersion;
    } else {
      delete AuthenticatedAxiosObject.defaults.headers.common["appVersion"];
    }
    /* eslint-enable react-hooks/immutability */
  }, [AuthenticatedAxiosObject, deviceUID, appVersion]);

  // Keep Authorization header in sync with the provider's header state
  useEffect(() => {
    /* eslint-disable react-hooks/immutability -- intentional: keep axios Authorization header in sync */
    if (current) {
      AuthenticatedAxiosObject.defaults.headers.common["Authorization"] = current;
    } else {
      delete AuthenticatedAxiosObject.defaults.headers.common["Authorization"];
    }
    /* eslint-enable react-hooks/immutability */
  }, [AuthenticatedAxiosObject, current]);

  const restoreSession = useCallback(
    (auth, remember) => {
      setCurrent(auth);
      setTimeout(() => {
        refreshToken()
          .then((data) => {
            if (data && data.access_token) {
              const token = `Bearer ${data.access_token}`;
              setCurrent(token);
              AuthenticatedAxiosObject.defaults.headers.common[
                "Authorization"
              ] = token;
              if (remember) localStorage.setItem("Authorization", token);
              sessionStorage.setItem("Authorization", token);

              if (data.refreshed) {
                console.info("Token was refreshed with new token");
              } else {
                console.info("Token is still valid, using existing token");
              }
            } else {
              localStorage.removeItem("Authorization");
              sessionStorage.removeItem("Authorization");
              toast.warn(
                "Your session could not be restored. Please log in again.",
                { toastId: "TOKEN_REFRESH_FAILED", icon: <Logout /> }
              );
            }
          })
          .catch((err) => {
            console.error("Session restoration failed:", err);
            localStorage.removeItem("Authorization");
            sessionStorage.removeItem("Authorization");
            toast.warn(
              "Your session could not be restored. Please log in again.",
              { toastId: "TOKEN_REFRESH_FAILED", icon: <Logout /> }
            );
          });
      }, 100);
    },
    [AuthenticatedAxiosObject, refreshToken]
  );

  // Restore session from storage on mount
  useEffect(() => {
    const localAuth = localStorage.getItem("Authorization");
    const sessAuth = sessionStorage.getItem("Authorization");

    if (localAuth) {
      Promise.resolve().then(() => restoreSession(localAuth, true));
    } else if (sessAuth) {
      Promise.resolve().then(() => restoreSession(sessAuth, false));
    }
  }, [restoreSession]);

  // Watch for Authorization token updates from other tabs via localStorage
  useEffect(() => {
    const handleStorageChange = (event) => {
      if (event.key === "Authorization" && event.newValue) {
        restoreSession(event.newValue, true);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [restoreSession]);

  const setHeader = (header) => setCurrent(header);

  const [currentLoggin, setCurrentLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userInfo, setUserInfo] = useState({});
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    setTimeout(() => {
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
  }, [current, currentLoggin, userLoader]);

  const setLoggedin = (status) => setCurrentLoggedIn(status);

  // Periodically refresh the token while logged in
  useEffect(() => {
    const intervalMs = (refreshTimer || 60) * 60 * 1000;

    if (!currentLoggin) return;

    const remember = Boolean(localStorage.getItem("Authorization"));
    const interval = setInterval(() => {
      restoreSession(sessionStorage.getItem("Authorization"), remember);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [current, restoreSession, currentLoggin, refreshTimer]);

  // Eject/re-register the Axios response interceptor when the instance changes
  useEffect(() => {
    const onSessionExpired = () => {
      setCurrentLoggedIn(false);
      AuthenticatedAxiosObject.defaults.headers.common["Authorization"] = "";
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
  const [refreshData, setRefreshFlag] = useState(false);

  useEffect(() => {
    const delayMs = (dataRefresh || 60) * 60 * 1000;
    const timer = setTimeout(() => setRefreshFlag(true), delayMs);
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
        setRefreshFlag(false);
      });
  }, [refreshData, userLoader]);

  const setRefreshData = (status) => setRefreshFlag(status);

  const hasRole = (roles) =>
    roles.some((r) => userInfo?.roles?.indexOf(r) >= 0);

  const contextValue = {
    isLoggedIn: currentLoggin,
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
    <SessionManager.Provider value={contextValue}>
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
    </SessionManager.Provider>
  );
};

export { SessionManager, SessionManagerProvider, getDeviceFingerprint };
export default SessionManagerProvider;
