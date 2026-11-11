// Tiny IndexedDB key-value store. Snapshots are too big for localStorage (5 MB per site).
const DB = 'data-desk';
const STORE = 'kv';

let conn: Promise<IDBDatabase> | null = null;
const open = () =>
  (conn ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const idbGet = <T,>(key: string) => tx<T | undefined>('readonly', (s) => s.get(key));
export const idbSet = (key: string, value: unknown) => tx('readwrite', (s) => s.put(value, key)).then(() => undefined);
export const idbDel = (key: string) => tx('readwrite', (s) => s.delete(key)).then(() => undefined);
