import FingerprintJS from "@fingerprintjs/fingerprintjs";

export const DEVICE_UID_STORAGE_KEY = "deviceUID";
export const LEGACY_DEVICE_FINGERPRINT_STORAGE_KEY = "deviceFingerprint";

const readStorageValue = (key) => {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.error(`Failed to read ${key} from localStorage:`, err);
    return null;
  }
};

const writeStorageValue = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.error(`Failed to write ${key} to localStorage:`, err);
  }
};

const removeStorageValue = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.error(`Failed to remove ${key} from localStorage:`, err);
  }
};

const generateFingerprint = async () => {
  const fp = await FingerprintJS.load();
  const result = await fp.get();
  return result.visitorId;
};

export async function getDeviceUID() {
  const canonical = readStorageValue(DEVICE_UID_STORAGE_KEY);
  if (canonical) {
    removeStorageValue(LEGACY_DEVICE_FINGERPRINT_STORAGE_KEY);
    return canonical;
  }

  const legacy = readStorageValue(LEGACY_DEVICE_FINGERPRINT_STORAGE_KEY);
  if (legacy) {
    writeStorageValue(DEVICE_UID_STORAGE_KEY, legacy);
    removeStorageValue(LEGACY_DEVICE_FINGERPRINT_STORAGE_KEY);
    return legacy;
  }

  const fingerprint = await generateFingerprint();
  writeStorageValue(DEVICE_UID_STORAGE_KEY, fingerprint);
  removeStorageValue(LEGACY_DEVICE_FINGERPRINT_STORAGE_KEY);
  return fingerprint;
}

export function resetDeviceUID() {
  removeStorageValue(DEVICE_UID_STORAGE_KEY);
  removeStorageValue(LEGACY_DEVICE_FINGERPRINT_STORAGE_KEY);
}

export default getDeviceUID;
