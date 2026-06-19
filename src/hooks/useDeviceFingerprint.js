import { useState, useEffect } from "react";
import getDeviceFingerprint from "../components/FingerPrint";

/**
 * Reads (or generates) a stable device fingerprint, persists it to
 * localStorage, and keeps the Axios instance header in sync.
 *
 * @param {import("axios").AxiosInstance} axiosInstance
 * @returns {string|null} deviceUID
 */
function useDeviceFingerprint(axiosInstance) {
  const [deviceUID, setDeviceUID] = useState(() => {
    return localStorage.getItem("deviceUID") || null;
  });

  useEffect(() => {
    if (deviceUID) {
      // eslint-disable-next-line react-hooks/immutability -- intentional: sync deviceUID header to axios instance
      axiosInstance.defaults.headers.common["deviceUID"] = deviceUID;
      return;
    }

    Promise.resolve(getDeviceFingerprint())
      .then((uid) => {
        localStorage.setItem("deviceUID", uid);
        setDeviceUID(uid);
        axiosInstance.defaults.headers.common["deviceUID"] = uid;
      })
      .catch((err) => {
        console.error("Failed to generate device fingerprint:", err);
      });
  }, [axiosInstance, deviceUID]);

  return deviceUID;
}

export default useDeviceFingerprint;
