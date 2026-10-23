import { useEffect } from "react";
import { toast } from "react-toastify";
import versionCompare from "./versionCompare";
import { BrowserUpdated } from "./Icons";
import { SESSION_TOAST_CONTAINER_ID } from "./toastContainer";

function VersionProtection({
  appVersion,
  toastContainerId = SESSION_TOAST_CONTAINER_ID,
}) {
  const effectiveToastContainerId =
    toastContainerId || SESSION_TOAST_CONTAINER_ID;

  useEffect(() => {
    const oldVersion = sessionStorage.getItem("appVersionOld");
    if (
      oldVersion &&
      sessionStorage.getItem("requiredVersion") &&
      versionCompare(appVersion, sessionStorage.getItem("requiredVersion"))
    ) {
      sessionStorage.removeItem("appVersionOld");
      sessionStorage.removeItem("requiredVersion");
      sessionStorage.removeItem("appReloads");
      toast.success("Your application has been updated", {
        toastId: "appReload",
        icon: <BrowserUpdated />,
        containerId: effectiveToastContainerId,
      });
    }
  }, [appVersion, effectiveToastContainerId]);

  return <></>;
}

export default VersionProtection;
