import React from "react";
import { render } from "@testing-library/react";
import VersionProtection from "../src/components/VersionProtection.js";

jest.mock("react-toastify", () => ({
  toast: {
    success: jest.fn(),
  },
}));

const { toast } = require("react-toastify");

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
});

describe("VersionProtection", () => {
  it("renders without crashing", () => {
    const { container } = render(<VersionProtection appVersion="1.0.0" />);
    // Component returns an empty fragment
    expect(container).toBeDefined();
  });

  it("does nothing when appVersionOld flag is absent", () => {
    render(<VersionProtection appVersion="1.0.0" />);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("does nothing when requiredVersion is absent (even if appVersionOld is set)", () => {
    sessionStorage.setItem("appVersionOld", "true");

    render(<VersionProtection appVersion="1.0.0" />);

    expect(toast.success).not.toHaveBeenCalled();
  });

  it("shows a success toast when the current version meets the required version", () => {
    sessionStorage.setItem("appVersionOld", "true");
    sessionStorage.setItem("requiredVersion", "1.0.0");

    render(<VersionProtection appVersion="1.0.0" />);

    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining("updated"),
      expect.objectContaining({ toastId: "appReload" })
    );
  });

  it("clears all update-related sessionStorage entries after showing the toast", () => {
    sessionStorage.setItem("appVersionOld", "true");
    sessionStorage.setItem("requiredVersion", "1.0.0");
    sessionStorage.setItem("appReloads", "1");

    render(<VersionProtection appVersion="1.0.0" />);

    expect(sessionStorage.getItem("appVersionOld")).toBeNull();
    expect(sessionStorage.getItem("requiredVersion")).toBeNull();
    expect(sessionStorage.getItem("appReloads")).toBeNull();
  });

  it("does not show a toast when the current version is below the required version", () => {
    sessionStorage.setItem("appVersionOld", "true");
    sessionStorage.setItem("requiredVersion", "2.0.0");

    render(<VersionProtection appVersion="1.0.0" />);

    expect(toast.success).not.toHaveBeenCalled();
  });
});
