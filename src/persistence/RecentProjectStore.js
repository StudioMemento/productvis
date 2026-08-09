const DB_NAME = 'product-vis-local-projects';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

function getIndexedDB() {
  try {
    return globalThis.indexedDB || null;
  } catch {
    return null;
  }
}

function stripBlob(record) {
  if (!record) return null;
  const { blob, ...metadata } = record;
  return metadata;
}

export class RecentProjectStore {
  constructor({ indexedDB = undefined, maxEntries = 3 } = {}) {
    this.indexedDB = indexedDB === undefined ? getIndexedDB() : indexedDB;
    this.maxEntries = Math.max(1, Math.floor(maxEntries));
    this.dbPromise = null;
  }

  get available() {
    return Boolean(this.indexedDB);
  }

  async #open() {
    if (!this.indexedDB) return null;
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const request = this.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('savedAt', 'savedAt');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Recent project storage could not open.'));
    });
    return this.dbPromise;
  }

  async list() {
    const db = await this.#open().catch(() => null);
    if (!db) return [];
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve((request.result || [])
        .sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)))
        .slice(0, this.maxEntries)
        .map(stripBlob));
      request.onerror = () => resolve([]);
    });
  }

  async get(id) {
    const db = await this.#open().catch(() => null);
    if (!db) return null;
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(String(id));
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  async save({ id, title, assetName = null, blob } = {}) {
    if (!(blob instanceof Blob)) throw new TypeError('A project Blob is required.');
    const db = await this.#open();
    if (!db) return null;
    const record = {
      id: String(id),
      title: String(title || 'Product VIS Project').slice(0, 120),
      assetName: assetName ? String(assetName).slice(0, 240) : null,
      savedAt: new Date().toISOString(),
      size: blob.size,
      blob,
    };
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Recent project could not be saved.'));
    });
    await this.#trim();
    return stripBlob(record);
  }

  async remove(id) {
    const db = await this.#open().catch(() => null);
    if (!db) return false;
    await new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(String(id));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
    return true;
  }

  async #trim() {
    const db = await this.#open();
    const all = await new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
    const overflow = all
      .sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)))
      .slice(this.maxEntries);
    if (!overflow.length) return;
    await new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      overflow.forEach((record) => transaction.objectStore(STORE_NAME).delete(record.id));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  }
}
