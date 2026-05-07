import { useEffect } from "react";
import { toast } from "react-toastify";
import versionCompare from "./versionCompare";
import { BrowserUpdated } from "./Icons";

function VersionProtection({ appVersion }) {
  useEffect(() => {
    const oldVersion = sessionStorage.getItem("appVersionOld");
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
  }, [appVersion]);

  return <></>;
}

export default VersionProtection;
