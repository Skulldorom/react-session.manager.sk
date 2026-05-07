import { useState, useEffect } from "react";
import getDeviceFingerprint from "../components/FingerPrint";

/**
 * Reads (or generates) a stable device fingerprint, persists it to
 * localStorage, and keeps the Axios instance header in sync.
 *
 * @param {import("axios").AxiosInstance} axiosInstance
 * @returns {string} deviceUID
 */
function useDeviceFingerprint(axiosInstance) {
  const [deviceUID] = useState(() => {
    const stored = localStorage.getItem("deviceUID");
    if (stored) return stored;
    const uid = getDeviceFingerprint();
    localStorage.setItem("deviceUID", uid);
    return uid;
  });

  useEffect(() => {
    axiosInstance.defaults.headers.common["deviceUID"] = deviceUID;
  }, [axiosInstance, deviceUID]);

  return deviceUID;
}

export default useDeviceFingerprint;
