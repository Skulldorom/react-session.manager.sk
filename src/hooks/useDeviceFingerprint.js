import { useState, useEffect } from "react";
import getDeviceUID from "../components/FingerPrint";

/**
 * Reads (or generates) a stable device UID and keeps the Axios instance header
 * in sync. Persistence is owned by the shared fingerprint helper so the package
 * has exactly one canonical localStorage key: deviceUID.
 *
 * @param {import("axios").AxiosInstance} axiosInstance
 * @returns {string|null} deviceUID
 */
function useDeviceFingerprint(axiosInstance) {
  const [deviceUID, setDeviceUID] = useState(null);

  useEffect(() => {
    let canceled = false;

    Promise.resolve(getDeviceUID())
      .then((uid) => {
        if (canceled) return;
        setDeviceUID(uid);
        if (uid) {
          axiosInstance.defaults.headers.common["deviceUID"] = uid;
        } else {
          delete axiosInstance.defaults.headers.common["deviceUID"];
        }
      })
      .catch((err) => {
        if (canceled) return;
        console.error("Failed to generate device fingerprint:", err);
        setDeviceUID(null);
        delete axiosInstance.defaults.headers.common["deviceUID"];
      });

    return () => {
      canceled = true;
    };
  }, [axiosInstance]);

  return deviceUID;
}

export default useDeviceFingerprint;
