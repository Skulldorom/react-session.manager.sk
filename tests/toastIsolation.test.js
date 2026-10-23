import React from "react";
import { render, act } from "@testing-library/react";
import { ToastContainer, toast } from "react-toastify";
import { SessionManagerProvider } from "../src/index.js";
import VersionProtection from "../src/components/VersionProtection.js";
import { SESSION_TOAST_CONTAINER_ID } from "../src/components/toastContainer.js";

// This suite deliberately does NOT mock react-toastify. Containers and toasts
// share the single module instance imported above, so containerId routing is
// exercised against the real Toastify store rather than per-mock isolation.

jest.mock("../src/hooks/useDeviceFingerprint.js", () =>
  jest.fn(() => ({
    deviceUID: "test-device-uid",
    resetDeviceUID: jest.fn(),
  }))
);

const toastSections = () =>
  Array.from(document.querySelectorAll("section.Toastify"));

const sectionById = (containerId) =>
  toastSections().find((section) => section.id === containerId) ?? null;

const sectionText = (containerId) => {
  const section = sectionById(containerId);
  if (!section) throw new Error(`No Toastify section with id "${containerId}"`);
  return section.textContent;
};

const toastIdsIn = (containerId) => {
  const section = sectionById(containerId);
  if (!section) throw new Error(`No Toastify section with id "${containerId}"`);
  return Array.from(section.querySelectorAll(".Toastify__toast")).map(
    (node) => node.id
  );
};

const showToast = (content, options) =>
  act(() => {
    toast(content, options);
  });

function createAxios() {
  return {
    defaults: { withCredentials: false, headers: { common: {} } },
    interceptors: {
      request: { use: jest.fn(() => 1), eject: jest.fn() },
      response: { use: jest.fn(() => 2), eject: jest.fn() },
    },
  };
}

const providerElement = (axios, toastContainerId) => (
  <SessionManagerProvider
    AuthenticatedAxiosObject={axios}
    userLoader={() =>
      Promise.resolve({ data: { logged_in: false, is_admin: false, Info: {} } })
    }
    appVersion="1.0.0"
    toastContainerId={toastContainerId}
  >
    <span />
  </SessionManagerProvider>
);

beforeEach(() => {
  sessionStorage.clear();
});

describe("Toastify container isolation (real react-toastify)", () => {
  it("routes default and Session Manager toasts to separate containers", () => {
    render(
      <>
        <ToastContainer />
        <ToastContainer containerId={SESSION_TOAST_CONTAINER_ID} />
      </>
    );

    showToast("application notification", { toastId: "app-toast" });
    showToast("session notification", {
      toastId: "session-toast",
      containerId: SESSION_TOAST_CONTAINER_ID,
    });

    expect(toastSections()).toHaveLength(2);
    expect(document.querySelectorAll("#app-toast")).toHaveLength(1);
    expect(document.querySelectorAll("#session-toast")).toHaveLength(1);

    expect(sectionText("")).toContain("application notification");
    expect(sectionText("")).not.toContain("session notification");
    expect(sectionText(SESSION_TOAST_CONTAINER_ID)).toContain(
      "session notification"
    );
    expect(sectionText(SESSION_TOAST_CONTAINER_ID)).not.toContain(
      "application notification"
    );

    expect(toastIdsIn("")).toEqual(["app-toast"]);
    expect(toastIdsIn(SESSION_TOAST_CONTAINER_ID)).toEqual(["session-toast"]);
  });

  it("routes custom container IDs independently of the default container", () => {
    render(
      <>
        <ToastContainer />
        <ToastContainer containerId="custom-session-manager" />
      </>
    );

    showToast("application notification", { toastId: "app-custom" });
    showToast("session notification", {
      toastId: "session-custom",
      containerId: "custom-session-manager",
    });

    expect(toastIdsIn("")).toEqual(["app-custom"]);
    expect(toastIdsIn("custom-session-manager")).toEqual(["session-custom"]);
    expect(document.querySelectorAll("#session-custom")).toHaveLength(1);
  });

  it("keeps a single Session Manager toast out of the default container", () => {
    render(
      <>
        <ToastContainer />
        <ToastContainer containerId={SESSION_TOAST_CONTAINER_ID} />
      </>
    );

    showToast("only a session notification", {
      toastId: "session-only",
      containerId: SESSION_TOAST_CONTAINER_ID,
    });

    expect(toastIdsIn("")).toEqual([]);
    expect(toastIdsIn(SESSION_TOAST_CONTAINER_ID)).toEqual(["session-only"]);
  });

  it("scopes the real VersionProtection notification away from the application container", () => {
    sessionStorage.setItem("appVersionOld", "true");
    sessionStorage.setItem("requiredVersion", "1.0.0");

    render(
      <>
        <ToastContainer />
        <ToastContainer containerId={SESSION_TOAST_CONTAINER_ID} />
        <VersionProtection appVersion="1.0.0" />
      </>
    );

    showToast("application notification", { toastId: "app-version" });

    expect(toastIdsIn("")).toEqual(["app-version"]);
    expect(toastIdsIn(SESSION_TOAST_CONTAINER_ID)).toEqual(["appReload"]);
    expect(document.querySelectorAll("#appReload")).toHaveLength(1);
    expect(sectionText(SESSION_TOAST_CONTAINER_ID)).toContain(
      "Your application has been updated"
    );
    expect(sectionText("")).not.toContain("updated");
  });
});

describe("SessionManagerProvider integration", () => {
  it("sends its own API-error toast to its container while the app toast stays default", async () => {
    const axios = createAxios();

    render(
      <>
        <ToastContainer />
        {providerElement(axios)}
      </>
    );

    const [, reject] = axios.interceptors.response.use.mock.calls[0];
    await act(async () => {
      await expect(reject({ response: { status: 403 } })).rejects.toBeTruthy();
    });
    showToast("application notification", { toastId: "app-integration" });

    expect(toastIdsIn("")).toEqual(["app-integration"]);
    expect(toastIdsIn(SESSION_TOAST_CONTAINER_ID)).toEqual(["ERR_FORBIDDEN"]);
    expect(toastSections()).toHaveLength(2);
  });

  it("honours a custom toastContainerId end to end", async () => {
    const axios = createAxios();

    render(
      <>
        <ToastContainer />
        {providerElement(axios, "tenant-session-manager")}
      </>
    );

    const [, reject] = axios.interceptors.response.use.mock.calls[0];
    await act(async () => {
      await expect(reject({ response: { status: 403 } })).rejects.toBeTruthy();
    });

    expect(toastIdsIn("tenant-session-manager")).toEqual(["ERR_FORBIDDEN"]);
    expect(sectionById(SESSION_TOAST_CONTAINER_ID)).toBeNull();
    expect(toastIdsIn("")).toEqual([]);
  });
});

describe("multiple SessionManagerProvider instances", () => {
  it("routes each provider's notifications to its own container when IDs differ", async () => {
    const axiosA = createAxios();
    const axiosB = createAxios();

    render(
      <>
        <ToastContainer />
        {providerElement(axiosA, "session-manager-a")}
        {providerElement(axiosB, "session-manager-b")}
      </>
    );

    const [, rejectA] = axiosA.interceptors.response.use.mock.calls[0];
    const [, rejectB] = axiosB.interceptors.response.use.mock.calls[0];

    await act(async () => {
      await expect(rejectA({ response: { status: 403 } })).rejects.toBeTruthy();
    });
    await act(async () => {
      await expect(rejectB({ response: { status: 403 } })).rejects.toBeTruthy();
    });

    expect(toastIdsIn("session-manager-a")).toEqual(["ERR_FORBIDDEN"]);
    expect(toastIdsIn("session-manager-b")).toEqual(["ERR_FORBIDDEN"]);
    expect(document.querySelectorAll("#ERR_FORBIDDEN")).toHaveLength(2);
    expect(toastIdsIn("")).toEqual([]);
  });

  it("mirrors a notification in both containers when two providers share the default ID", async () => {
    const axiosA = createAxios();
    const axiosB = createAxios();

    render(
      <>
        <ToastContainer />
        {providerElement(axiosA)}
        {providerElement(axiosB)}
      </>
    );

    const [, rejectA] = axiosA.interceptors.response.use.mock.calls[0];
    await act(async () => {
      await expect(rejectA({ response: { status: 403 } })).rejects.toBeTruthy();
    });

    expect(
      toastSections().filter(
        (section) => section.id === SESSION_TOAST_CONTAINER_ID
      )
    ).toHaveLength(2);
    // React-Toastify keys its store by containerId, so two providers sharing
    // "session-manager" see the same toast and RenderQueues mount two Sections
    // that each render it. Multi-provider setups must pass distinct IDs.
    expect(document.querySelectorAll("#ERR_FORBIDDEN")).toHaveLength(2);
    expect(toastIdsIn("")).toEqual([]);
  });
});
