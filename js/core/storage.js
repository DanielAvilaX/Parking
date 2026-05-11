const MODE_KEY = "davinci-auth-mode";

const SESSION_MODE = "session";
const PERSISTENT_MODE = "persistent";

export function getSessionPersistenceMode() {
  return window.localStorage.getItem(MODE_KEY) === PERSISTENT_MODE ? PERSISTENT_MODE : SESSION_MODE;
}

export function setSessionPersistenceMode(mode) {
  window.localStorage.setItem(MODE_KEY, mode === PERSISTENT_MODE ? PERSISTENT_MODE : SESSION_MODE);
}

export function getModeForRole(role) {
  return role === "guard" ? PERSISTENT_MODE : SESSION_MODE;
}

export function clearStoredSession(storageKey) {
  window.localStorage.removeItem(storageKey);
  window.sessionStorage.removeItem(storageKey);
}

export function createRoleAwareStorage(storageKey) {
  return {
    getItem(key) {
      return window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key);
    },
    setItem(key, value) {
      const mode = getSessionPersistenceMode();
      if (mode === PERSISTENT_MODE) {
        window.localStorage.setItem(key, value);
        window.sessionStorage.removeItem(key);
        return;
      }

      window.sessionStorage.setItem(key, value);
      window.localStorage.removeItem(key);
    },
    removeItem(key) {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    },
    isServer: false,
    storageKey,
  };
}

