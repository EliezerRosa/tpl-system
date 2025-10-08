import { STORAGE_KEY } from "./constants.js";

const hasBrowserStorage = () =>
  typeof globalThis !== "undefined" && typeof globalThis.localStorage !== "undefined";

export const createInMemoryStorage = (seed = {}) => {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key) => {
      const value = map.get(key);
      return value ?? null;
    },
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
    clear: () => {
      map.clear();
    },
  };
};

const getNativeStorage = () => {
  if (!hasBrowserStorage()) {
    return null;
  }
  try {
    const testKey = "__rvm_test__";
    globalThis.localStorage.setItem(testKey, "ok");
    globalThis.localStorage.removeItem(testKey);
    return globalThis.localStorage;
  } catch (error) {
    console.warn("LocalStorage indisponível, usando memória", error);
    return null;
  }
};

export class StorageProvider {
  constructor({ storage = null, key = STORAGE_KEY } = {}) {
    this.key = key;
    this.storage = storage ?? getNativeStorage() ?? createInMemoryStorage();
  }

  read() {
    const raw = this.storage.getItem(this.key);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.error("Falha ao interpretar dados persistidos", error);
      return null;
    }
  }

  write(data) {
    const payload = JSON.stringify(data, null, 2);
    this.storage.setItem(this.key, payload);
  }

  seed(defaultValue) {
    if (!this.storage.getItem(this.key)) {
      this.write(defaultValue);
      return this.read();
    }
    return this.read();
  }

  clear() {
    this.storage.removeItem(this.key);
  }
}
