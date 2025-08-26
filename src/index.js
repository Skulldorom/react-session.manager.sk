import React, { createContext, useState, useEffect, useCallback } from "react";
import versionCompare from "./components/versionCompare";
import getDeviceFingerprint from "./components/FingerPrint";
import ErrorBoundary from "./components/ErrorBoundary";
import ThemeWrapper from "./components/ThemeWrapper";
// Notifications
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./styling/toast.css";

// Icons
import { GppBad, Update, BrowserUpdated, Logout } from "@mui/icons-material";

export const SessionManager = createContext({
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
      try {
        const uid = getDeviceFingerprint();
        if (uid) {
          setDeviceUID(uid);
          localStorage.setItem("deviceUID", uid);
          AuthenticatedAxiosObject.defaults.headers.common["deviceUID"] = uid;
        }
      } catch (err) {
        console.error("Failed to generate device fingerprint:", err);
        // Generate a fallback UUID
        const fallbackUID =
          "fallback-" +
          Date.now() +
          "-" +
          Math.random().toString(36).substr(2, 9);
        setDeviceUID(fallbackUID);
        localStorage.setItem("deviceUID", fallbackUID);
        AuthenticatedAxiosObject.defaults.headers.common["deviceUID"] =
          fallbackUID;
      }
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
            if (data?.refreshed) {
              const token = `Bearer ${data.access_token}`;
              setCurrent(token);
              AuthenticatedAxiosObject.defaults.headers.common[
                "Authorization"
              ] = token;
              if (remember) localStorage.setItem("Authorization", token);
              sessionStorage.setItem("Authorization", token);
            }
          })
          .catch((err) => {
            console.error("Token refresh failed:", err);
            
            // Track auth failures
            if (err?.code === "ERR_NETWORK" || err?.code === "ERR_CONNECTION_REFUSED") {
              setAuthError(true);
            }
            
            // Clear invalid tokens
            localStorage.removeItem("Authorization");
            sessionStorage.removeItem("Authorization");
            setCurrent("");
            setCurrentLoggedIn(false);

            // Only show toast for actual network/server errors, not auth failures
            if (err?.code === "ERR_NETWORK" || err?.response?.status >= 500) {
              // Don't spam with toasts during retries
              const lastToast = sessionStorage.getItem("lastRefreshErrorToast");
              const now = Date.now();
              if (!lastToast || now - parseInt(lastToast) > 30000) { // 30 seconds
                toast.error(
                  "Unable to refresh your session. Please login again.",
                  {
                    toastId: "token-refresh-error",
                    icon: <Logout />,
                  }
                );
                sessionStorage.setItem("lastRefreshErrorToast", now.toString());
              }
            }
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

  // Wrap setHeader to store new header names in localStorage
  const setHeader = (header) => {
    setCurrent(header);
  };

  const [currentLoggin, setCurrentLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userInfo, setUserInfo] = useState({});
  const [loadingUser, setLoadingUser] = useState(true);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      userLoader()
        .then((res) => {
          const data = res?.data;
          if (data) {
            setCurrentLoggedIn(data.logged_in);
            setIsAdmin(data.is_admin);
            setUserInfo(data.Info || {});
            setAuthError(false);
          }
        })
        .catch((err) => {
          console.error("User data loading failed:", err);
          
          // Check if this is a persistent auth error
          if (err?.code === "ERR_NETWORK" || err?.code === "ERR_CONNECTION_REFUSED") {
            setAuthError(true);
            // Don't show toast immediately, let retries happen first
          } else if (err?.response?.status !== 401 && err?.response?.status !== 403) {
            if (err?.response?.status >= 500) {
              toast.error(
                "Unable to load user information. Some features may be limited.",
                {
                  toastId: "user-load-error",
                  icon: <GppBad />,
                }
              );
            }
          }
          // Set safe defaults
          setCurrentLoggedIn(false);
          setIsAdmin(false);
          setUserInfo({});
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
  }, [fromPrevious, currentLoggin, refreshTimer]);

  useEffect(() => {
    const customInterceptor = () => {
      AuthenticatedAxiosObject.interceptors.response.use(
        (response) => {
          // Reset connection failure count on successful response
          sessionStorage.setItem("connectionFailures", "0");
          return response;
        },
        (error) => {
          console.error("Axios interceptor caught error:", error);

          // Handle session expiry (455)
          if (error?.response?.status === 455) {
            try {
              const status = error.response.data?.logged_in || false;
              if (!status) {
                console.log("Session ended");
                setCurrentLoggedIn(false);
                AuthenticatedAxiosObject.defaults.headers.common[
                  "Authorization"
                ] = ``;
                toast.info(
                  "Your session is no longer valid, please login again.",
                  { toastId: "Forced_log_out", icon: <Logout /> }
                );
              }
            } catch (err) {
              console.error("Error handling session expiry:", err);
              // Don't throw here - just log and continue
            }
            return Promise.reject(error);
          }

          // Handle version mismatch (426)
          if (error?.response?.status === 426) {
            try {
              sessionStorage.setItem("appVersionOld", true);
              sessionStorage.setItem(
                "requiredVersion",
                error.response.data?.minVersion || "unknown"
              );
              let reloads = parseInt(
                sessionStorage.getItem("appReloads") || "0"
              );
              if (reloads < 2) {
                sessionStorage.setItem("appReloads", (reloads + 1).toString());
                setTimeout(() => {
                  window.location.reload();
                }, 1000 * reloads);
              } else {
                toast.warning(
                  "The application needs to be updated. Please wait for some time then reload the page.",
                  {
                    toastId: "appReloadError",
                    icon: <Update />,
                  }
                );
              }
            } catch (err) {
              console.error("Error handling version mismatch:", err);
            }
            return Promise.reject(error);
          }

          // Handle network errors and connection issues
          if (!error?.response?.status) {
            if (
              error?.code !== "ERR_CANCELED" &&
              error?.message !== "canceled"
            ) {
              const errorMessage =
                error?.code === "ERR_NETWORK"
                  ? "Unable to connect to the server. Please check your internet connection and try again."
                  : "The server is not responding, please reload or try again later.";

              // Only show toast after multiple failures to avoid spam
              const failureCount = parseInt(sessionStorage.getItem("connectionFailures") || "0");
              sessionStorage.setItem("connectionFailures", (failureCount + 1).toString());
              
              if (failureCount >= 3) {
                toast.error(errorMessage, {
                  toastId: `${error?.code || "ERR_CONNECTION_REFUSED"}`,
                  icon: <GppBad />,
                });
                // Reset counter after showing toast
                sessionStorage.setItem("connectionFailures", "0");
              }
            }
            return Promise.reject(error);
          }

          // For all other errors, just reject without throwing
          return Promise.reject(error);
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
  }, [AuthenticatedAxiosObject, currentLoggin, setCurrentLoggedIn]);

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
          const data = res?.data;
          if (data) {
            setUserInfo(data.Info || {});
          }
        })
        .catch((err) => {
          console.error("User data refresh failed:", err);
          // Silently fail for data refresh - don't overwhelm user with toasts
        })
        .finally(() => {
          setRefreshData(false);
        });
    }
  }, [refreshData, userLoader]);

  const setRefreshData = (status) => {
    setRefreshFlag(status);
  };

  // Check if user has specific role
  const hasRole = (roles) => {
    if (
      !roles ||
      !Array.isArray(roles) ||
      !userInfo?.roles ||
      !Array.isArray(userInfo.roles)
    ) {
      return false;
    }
    try {
      return roles.some((r) => userInfo.roles.indexOf(r) >= 0);
    } catch (err) {
      console.error("Error checking user roles:", err);
      return false;
    }
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
    authError: authError,
  };

  // Show loading state while initializing
  if (loadingUser) {
    return (
      <ThemeWrapper>
        <ErrorBoundary>
          <SessionManager.Provider value={contextValue}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '100vh',
              padding: '20px',
              backgroundColor: '#f5f5f5',
              fontFamily: 'Arial, sans-serif'
            }}>
              <div style={{
                backgroundColor: 'white',
                padding: '40px',
                borderRadius: '8px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                textAlign: 'center',
                maxWidth: '400px'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  border: '4px solid #f3f3f3',
                  borderTop: '4px solid #1976d2',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 16px'
                }} />
                <h3 style={{ color: '#333', marginBottom: '8px' }}>Loading...</h3>
                <p style={{ color: '#666', margin: 0 }}>
                  Initializing session manager
                </p>
              </div>
              <style>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          </SessionManager.Provider>
        </ErrorBoundary>
      </ThemeWrapper>
    );
  }
    return (
      <ThemeWrapper>
        <ErrorBoundary>
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
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '100vh',
              padding: '20px',
              backgroundColor: '#f5f5f5',
              fontFamily: 'Arial, sans-serif'
            }}>
              <div style={{
                backgroundColor: 'white',
                padding: '40px',
                borderRadius: '8px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                textAlign: 'center',
                maxWidth: '400px'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                <h2 style={{ color: '#d32f2f', marginBottom: '16px' }}>Connection Error</h2>
                <p style={{ color: '#666', marginBottom: '24px' }}>
                  Unable to connect to the server. Please check your internet connection and try again.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  style={{
                    backgroundColor: '#1976d2',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  Retry
                </button>
              </div>
            </div>
          </SessionManager.Provider>
        </ErrorBoundary>
      </ThemeWrapper>
    );
  }

  // If there's a persistent auth error, render a minimal error state
  if (authError && !loadingUser) {
    return (
      <ThemeWrapper>
        <ErrorBoundary>
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
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '100vh',
              padding: '20px',
              backgroundColor: '#f5f5f5',
              fontFamily: 'Arial, sans-serif'
            }}>
              <div style={{
                backgroundColor: 'white',
                padding: '40px',
                borderRadius: '8px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                textAlign: 'center',
                maxWidth: '400px'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                <h2 style={{ color: '#d32f2f', marginBottom: '16px' }}>Connection Error</h2>
                <p style={{ color: '#666', marginBottom: '24px' }}>
                  Unable to connect to the server. Please check your internet connection and try again.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  style={{
                    backgroundColor: '#1976d2',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  Retry
                </button>
              </div>
            </div>
          </SessionManager.Provider>
        </ErrorBoundary>
      </ThemeWrapper>
    );
  }

  return (
    <ThemeWrapper>
      <ErrorBoundary>
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
      </ErrorBoundary>
    </ThemeWrapper>
  );
};

function VersionProtection({ appVersion }) {
  const [oldVersion, setOldVersion] = useState(false);

  useEffect(() => {
    try {
      const isOldVersion = sessionStorage.getItem("appVersionOld") === "true";
      setOldVersion(isOldVersion);

      if (
        isOldVersion &&
        sessionStorage.getItem("requiredVersion") &&
        appVersion &&
        versionCompare(appVersion, sessionStorage.getItem("requiredVersion"))
      ) {
        console.log("Update Success Toast");
        toast.success("Your application has been updated", {
          toastId: "appReload",
          icon: <BrowserUpdated />,
          onClose: () => {
            try {
              sessionStorage.removeItem("appVersionOld");
              sessionStorage.removeItem("requiredVersion");
              sessionStorage.removeItem("appReloads");
            } catch (err) {
              console.error("Error cleaning up version storage:", err);
            }
          },
        });
      }
    } catch (err) {
      console.error("Error in version protection:", err);
    }
  }, [appVersion]);

  return <></>;
}

export default SessionManagerProvider;
