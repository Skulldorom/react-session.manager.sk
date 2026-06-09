import FingerprintJS from "@fingerprintjs/fingerprintjs";

export default function getDeviceFingerprint() {
  if (localStorage.getItem("deviceFingerprint"))
    return localStorage.getItem("deviceFingerprint");

  const fpPromise = FingerprintJS.load();
  const fingerprint = fpPromise
    .then((fp) => fp.get())
    .then((result) => result.visitorId);

  localStorage.setItem("deviceFingerprint", fingerprint);
  return fingerprint;
}
