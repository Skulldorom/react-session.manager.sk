import { useState, useEffect, useCallback, useRef } from "react";
import getDeviceUID, { resetDeviceUID as resetStoredDeviceUID } from "../components/FingerPrint";

/**
 * Reads (or generates) a stable device UID and keeps the Axios instance header
 * in sync. Persistence is owned by the shared fingerprint helper so the package
 * has exactly one canonical localStorage key: deviceUID.
 *
 * @param {import("axios").AxiosInstance} axiosInstance
 * @returns {{ deviceUID: string|null, resetDeviceUID: () => Promise<string|null> }}
 */
function useDeviceFingerprint(axiosInstance) {
  const [deviceUID, setDeviceUID] = useState(null);
  const generationRef = useRef(0);

  const setAxiosDeviceUID = useCallback(
    (uid) => {
      if (uid) {
        axiosInstance.defaults.headers.common["deviceUID"] = uid;
      } else {
        delete axiosInstance.defaults.headers.common["deviceUID"];
      }
    },
    [axiosInstance]
  );

  const loadDeviceUID = useCallback(
    ({ reset = false } = {}) => {
      const generation = generationRef.current + 1;
      generationRef.current = generation;

      if (reset) {
        resetStoredDeviceUID();
        setDeviceUID(null);
        setAxiosDeviceUID(null);
      }

      return Promise.resolve(getDeviceUID())
        .then((uid) => {
          if (generation !== generationRef.current) return null;
          setDeviceUID(uid);
          setAxiosDeviceUID(uid);
          return uid;
        })
        .catch((err) => {
          if (generation !== generationRef.current) return null;
          console.error("Failed to generate device fingerprint:", err);
          setDeviceUID(null);
          setAxiosDeviceUID(null);
          return null;
        });
    },
    [setAxiosDeviceUID]
  );

  useEffect(() => {
    let canceled = false;
    const generation = generationRef.current + 1;
    generationRef.current = generation;

    Promise.resolve(getDeviceUID())
      .then((uid) => {
        if (canceled || generation !== generationRef.current) return;
        setDeviceUID(uid);
        setAxiosDeviceUID(uid);
      })
      .catch((err) => {
        if (canceled || generation !== generationRef.current) return;
        console.error("Failed to generate device fingerprint:", err);
        setDeviceUID(null);
        setAxiosDeviceUID(null);
      });

    return () => {
      canceled = true;
    };
  }, [setAxiosDeviceUID]);

  const resetMountedDeviceUID = useCallback(
    () => loadDeviceUID({ reset: true }),
    [loadDeviceUID]
  );

  return { deviceUID, resetDeviceUID: resetMountedDeviceUID };
}

export default useDeviceFingerprint;
