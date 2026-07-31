import { AppState } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';

/**
 * Small namespaced JSON key-value store.
 *
 * Reads are synchronous (expo-file-system's current API is sync for local files) and lazily done on
 * first access, so callers never have to gate their UI behind a load. Writes are debounced and
 * batched, because the size index rewrites the same store hundreds of times while it fills.
 */

const STORE_DIRECTORY = 'compresshd';
const WRITE_DEBOUNCE_MS = 400;

type Snapshot = Record<string, unknown>;

export type JsonStore = {
  get<T>(key: string): T | null;
  set(key: string, value: unknown): void;
  remove(key: string): void;
  snapshot(): Readonly<Snapshot>;
  replaceAll(next: Snapshot): void;
  /** Persist immediately, skipping the debounce. */
  flush(): void;
};

const openStores = new Map<string, JsonStore>();
let appStateBound = false;

export function openJsonStore(name: string): JsonStore {
  const existing = openStores.get(name);
  if (existing) return existing;

  const store = createJsonStore(name);
  openStores.set(name, store);
  bindAppStateFlush();
  return store;
}

/** Persist every open store — call before the process may be torn down. */
export function flushAllStores(): void {
  for (const store of openStores.values()) store.flush();
}

function createJsonStore(name: string): JsonStore {
  const file = storeFile(name);

  let snapshot: Snapshot | null = null;
  let pendingWrite: ReturnType<typeof setTimeout> | null = null;

  const load = (): Snapshot => {
    snapshot ??= readSnapshot(file);
    return snapshot;
  };

  const schedulePersist = () => {
    if (pendingWrite) clearTimeout(pendingWrite);
    pendingWrite = setTimeout(flush, WRITE_DEBOUNCE_MS);
  };

  const flush = () => {
    if (pendingWrite) {
      clearTimeout(pendingWrite);
      pendingWrite = null;
    }
    if (snapshot) writeSnapshot(file, snapshot);
  };

  return {
    get<T>(key: string): T | null {
      const value = load()[key];
      return value === undefined ? null : (value as T);
    },
    set(key, value) {
      load()[key] = value;
      schedulePersist();
    },
    remove(key) {
      delete load()[key];
      schedulePersist();
    },
    snapshot() {
      return load();
    },
    replaceAll(next) {
      snapshot = { ...next };
      schedulePersist();
    },
    flush,
  };
}

function storeFile(name: string): File {
  const directory = new Directory(Paths.document, STORE_DIRECTORY);
  if (!directory.exists)
    directory.create({ intermediates: true, idempotent: true });
  return new File(directory, `${name}.json`);
}

/** A store is a cache or a preference, so unreadable content is discarded rather than surfaced. */
function readSnapshot(file: File): Snapshot {
  if (!file.exists) return {};
  try {
    const parsed: unknown = JSON.parse(file.textSync());
    return isSnapshot(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeSnapshot(file: File, snapshot: Snapshot): void {
  try {
    file.write(JSON.stringify(snapshot));
  } catch (error) {
    console.warn(`[storage] failed to persist ${file.name}`, error);
  }
}

function isSnapshot(value: unknown): value is Snapshot {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function bindAppStateFlush(): void {
  if (appStateBound) return;
  appStateBound = true;
  AppState.addEventListener('change', state => {
    if (state !== 'active') flushAllStores();
  });
}
