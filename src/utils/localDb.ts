const DB_NAME = 'career_craft_db';
const DB_VERSION = 1;
const STORE_NAME = 'guest_store';

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
}

export const localDb = {
  async getItem<T>(key: string, fallback: T): Promise<T> {
    try {
      const db = await getDB();
      return new Promise<T>((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);
        request.onsuccess = () => {
          resolve(request.result !== undefined ? (request.result as T) : fallback);
        };
        request.onerror = () => {
          resolve(fallback);
        };
      });
    } catch (e) {
      console.error('IndexedDB error on getItem:', e);
      try {
        const localVal = localStorage.getItem(key);
        return localVal ? JSON.parse(localVal) : fallback;
      } catch {
        return fallback;
      }
    }
  },

  async setItem<T>(key: string, value: T): Promise<void> {
    try {
      const db = await getDB();
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(value, key);
        request.onsuccess = () => {
          resolve();
        };
        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (e) {
      console.error('IndexedDB error on setItem:', e);
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (localErr) {
        console.error('LocalStorage fallback also failed:', localErr);
      }
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      const db = await getDB();
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('IndexedDB error on removeItem:', e);
      try {
        localStorage.removeItem(key);
      } catch {}
    }
  },

  /**
   * Migrate specific keys from localStorage to IndexedDB once, safely.
   */
  async migrateFromLocalStorage(keys: string[]): Promise<void> {
    for (const key of keys) {
      try {
        const localVal = localStorage.getItem(key);
        if (localVal) {
          const parsed = JSON.parse(localVal);
          // Check if IndexedDB already has it
          const currentInDb = await localDb.getItem<any>(key, null);
          if (!currentInDb) {
            await this.setItem(key, parsed);
            console.log(`Successfully migrated key "${key}" to IndexedDB`);
          }
          // Optionally, we can remove it from localStorage to free up space
          localStorage.removeItem(key);
        }
      } catch (err) {
        console.error(`Failed to migrate key "${key}" from localStorage:`, err);
      }
    }
  }
};
