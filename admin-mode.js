export const ADMIN_MODE_STORAGE_KEY = "polonese-game-admin-v1";

export function isAdminModeEnabled(storageProvider = () => globalThis.localStorage) {
  try {
    return storageProvider()?.getItem(ADMIN_MODE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}
