import FingerprintJS from "@fingerprintjs/fingerprintjs";

export default async function getDeviceFingerprint() {
  const cached = localStorage.getItem("deviceFingerprint");
  if (cached) return cached;

  const fp = await FingerprintJS.load();
  const result = await fp.get();
  const fingerprint = result.visitorId;

  localStorage.setItem("deviceFingerprint", fingerprint);
  return fingerprint;
}
