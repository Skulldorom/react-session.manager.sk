import React, { createContext, useState, useEffect, useCallback } from "react";
import versionCompare from "./components/versionCompare";
import getDeviceFingerprint from "./components/FingerPrint";
// Notifications
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./styling/toast.css";

// Local Icons
import { GppBad, Update, BrowserUpdated, Logout } from "./components/Icons";

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
  // Set deivce UID
  const [deviceUID, setDeviceUID] = useState(
    localStorage.getItem("deviceUID") || false
  );

  useEffect(() => {
    if (!deviceUID) {
      const uid = getDeviceFingerprint();
      setDeviceUID(uid);
      localStorage.setItem("deviceUID", uid);
      AuthenticatedAxiosObject.defaults.headers.common["deviceUID"] = uid;
    }
  }, [deviceUID, AuthenticatedAxiosObject]);

  // State to hold the selected header name
  const [current, setCurrent] = useState("");

  AuthenticatedAxiosObject.defaults.withCredentials = true;
  AuthenticatedAxiosObject.defaults.headers.common["Authorization"] = current;
  AuthenticatedAxiosObject.defaults.headers.common["deviceUID"] = deviceUID;
  AuthenticatedAxiosObject.defaults.headers.common["appVersion"] = appVersion;

  const fromPrevious = useCallback(
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
                console.log("Token was refreshed with new token");
              } else {
                console.log("Token is still valid, using existing token");
              }
            } else {
              console.log("Token refresh failed - no valid response data");
            }
          })
          .catch((err) => {
            console.log(err);
            console.log("Missing/Invalid Token");
            localStorage.removeItem("Authorization");
            sessionStorage.removeItem("Authorization");
          });
      }, 100);
    },
    [AuthenticatedAxiosObject, refreshToken]
  );

  useEffect(() => {
    const local_auth = localStorage.getItem("Authorization");
    const sess_auth = sessionStorage.getItem("Authorization");

    if (local_auth) fromPrevious(local_auth, true);
    else if (sess_auth) fromPrevious(sess_auth, false);
    // No cleanup needed here since fromPrevious doesn't create intervals
  }, [fromPrevious]);

  // Watch for Authorization token updates from other tabs via localStorage
  useEffect(() => {
    const handleStorageChange = (event) => {
      if (event.key === "Authorization" && event.newValue) {
        fromPrevious(event.newValue, true);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [fromPrevious]);

  // Wrap setHeader to store new header names in localStorage
  const setHeader = (header) => {
    setCurrent(header);
  };

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
            console.log("Invalid user data response");
          }
        })
        .catch((err) => {
          console.log(err);
        })
        .finally(() => {
          setLoadingUser(false);
        });
    }, 100);
  }, [current, currentLoggin, userLoader]);

  const setLoggedin = (status) => {
    setCurrentLoggedIn(status);
  };

  useEffect(() => {
    const tokenRefreshTimer = () => {
      const mins = refreshTimer || 60;
      return mins * 60 * 1000 || 10000;
    };

    let interval = null;
    if (currentLoggin) {
      const remember = localStorage.getItem("Authorization") ? true : false;
      interval = setInterval(() => {
        fromPrevious(sessionStorage.getItem("Authorization"), remember);
      }, tokenRefreshTimer());
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [current, fromPrevious, currentLoggin, refreshTimer]);

  useEffect(() => {
    const customInterceptor = () => {
      AuthenticatedAxiosObject.interceptors.response.use(
        (response) => {
          return response;
        },
        (error) => {
          if (error?.response?.status === 455) {
            try {
              const status = error.response.data.logged_in || false;
              if (!status) {
                console.log("Session ended");
                setCurrentLoggedIn(false);
                AuthenticatedAxiosObject.defaults.headers.common[
                  "Authorization"
                ] = ``;
                toast.info(
                  "Your session in no longer valid, please login again.",
                  { toastId: "Forced_log_out", icon: <Logout /> }
                );
              }
            } catch (err) {
              throw err;
            }
          }
          if (error?.response?.status === 426) {
            sessionStorage.setItem("appVersionOld", true);
            sessionStorage.setItem(
              "requiredVersion",
              error.response.data.minVersion
            );
            let reloads = sessionStorage.getItem("appReloads") || 0;
            if (reloads < 2) {
              sessionStorage.setItem("appReloads", reloads + 1);
              setTimeout(() => {
                window.location.reload();
              }, 1000 * reloads);
            } else {
              toast.warning(
                "The application needs to be updated please wait for some time then reload the page.",
                {
                  toastId: "appReloadError",
                  icon: <Update />,
                }
              );
            }
          }

          if (!error?.response?.status) {
            if (error?.code !== "ERR_CANCELED" && error?.message !== "canceled") {
              // Check if it's a timeout error
              if (error?.code === "ECONNABORTED" || error?.code === "ETIMEDOUT") {
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
          throw error;
        }
      );
    };

    // Call the interceptor setup
    customInterceptor();

    // Cleanup function to remove interceptors
    return () => {
      if (AuthenticatedAxiosObject?.interceptors?.response) {
        AuthenticatedAxiosObject.interceptors.response.clear();
      }
    };
  }, [AuthenticatedAxiosObject, currentLoggin]);

  // We will use the below to refresh our data about the user when ever we flag refreshData as true
  const [refreshData, setRefreshFlag] = useState(false);

  useEffect(() => {
    const refreshDelay = () => {
      const mins = dataRefresh || 60;
      return mins * 60 * 1000 || 10000;
    };

    const timer = setTimeout(() => setRefreshFlag(true), refreshDelay());
    return () => clearTimeout(timer);
  }, [dataRefresh]);

  useEffect(() => {
    if (refreshData) {
      userLoader()
        .then((res) => {
          if (res && res.data) {
            const data = res.data;
            setUserInfo(data.Info);
          } else {
            console.log("Invalid refresh data response");
          }
          setRefreshData(false);
        })
        .catch((err) => {
          console.log("Error refreshing user data:", err);
          setRefreshData(false);
        });
    }
  }, [refreshData, userLoader]);

  const setRefreshData = (status) => {
    setRefreshFlag(status);
  };

  // Check if user has specific role

  const hasRole = (roles) => {
    const found = roles.some((r) => userInfo?.roles?.indexOf(r) >= 0);
    return found;
  };

  const contextValue = {
    isLoggedIn: currentLoggin,
    header: current,
    isAdmin: isAdmin,
    userInfo: userInfo,
    refreshData: refreshData,
    setHeader: setHeader,
    setLoggedin: setLoggedin,
    setRefreshData: setRefreshData,
    hasRole: hasRole,
    deviceUID: deviceUID,
    loadingUser: loadingUser,
  };

  // Show loading state while initializing
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

function VersionProtection({ appVersion }) {
  const oldVersion = sessionStorage.getItem("appVersionOld") || false;
  useEffect(() => {
    if (
      oldVersion &&
      sessionStorage.getItem("requiredVersion") &&
      versionCompare(appVersion, sessionStorage.getItem("requiredVersion"))
    ) {
      console.log("Update Success Toast");
      sessionStorage.removeItem("appVersionOld");
      sessionStorage.removeItem("requiredVersion");
      sessionStorage.removeItem("appReloads");
      toast.success("Your application has been updated", {
        toastId: "appReload",
        icon: <BrowserUpdated />,
      });
    }
  }, [oldVersion]);

  return <></>;
}

export { SessionManager, SessionManagerProvider };
export default SessionManagerProvider;
