import {
  ensureCanonicalMemoriesMigrated,
  getMemoryMigrationState,
  mirrorLegacyItemToCanonical,
  readLocalMemories,
  MEMORY_MIGRATION_VERSION,
} from "../src/lib/memoryLocalStore";

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function installWindowStorage(store: Map<string, string>) {
  const storage: StorageLike = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: storage,
      dispatchEvent: () => true,
    },
  });
}

function resetWindowStorage() {
  Reflect.deleteProperty(globalThis, "window");
}

export function withMemoryLocalStorage<T>(
  seed: (storage: StorageLike) => void,
  run: () => T,
): T {
  const store = new Map<string, string>();
  const storage: StorageLike = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
  installWindowStorage(store);
  seed(storage);
  try {
    return run();
  } finally {
    resetWindowStorage();
  }
}

export {
  MEMORY_MIGRATION_VERSION,
  readLocalMemories,
  getMemoryMigrationState,
  ensureCanonicalMemoriesMigrated,
  mirrorLegacyItemToCanonical,
};
