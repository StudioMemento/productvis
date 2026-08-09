const DB_NAME = 'product-vis-recovery-draft';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';
const LATEST_KEY = 'latest';
const DEFAULT_MAX_BYTES = 512 * 1024 * 1024;

function getIndexedDB() {
  try {
    return globalThis.indexedDB || null;
  } catch {
    return null;
  }
}

function withoutBlob(record) {
  if (!record) return null;
  const { blob, ...metadata } = record;
  return metadata;
}

export class RecoveryDraftStore {
  constructor({ indexedDB = undefined, maxBytes = DEFAULT_MAX_BYTES } = {}) {
    this.indexedDB = indexedDB === undefined ? getIndexedDB() : indexedDB;
    this.maxBytes = Math.max(1, Math.floor(Number(maxBytes) || DEFAULT_MAX_BYTES));
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
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Recovery storage could not open.'));
    });
    return this.dbPromise;
  }

  async save({ blob, title = 'Product VIS Project', assetName = null, projectId = null, schemaVersion = null } = {}) {
    if (!(blob instanceof Blob)) throw new TypeError('A recovery Blob is required.');
    if (blob.size > this.maxBytes) throw new Error('The recovery draft is too large for local recovery storage.');
    const db = await this.#open();
    if (!db) return null;
    const record = {
      key: LATEST_KEY,
      title: String(title || 'Product VIS Project').slice(0, 120),
      assetName: assetName ? String(assetName).slice(0, 240) : null,
      projectId: projectId ? String(projectId).slice(0, 96) : null,
      schemaVersion: Number.isFinite(Number(schemaVersion)) ? Math.floor(Number(schemaVersion)) : null,
      savedAt: new Date().toISOString(),
      size: blob.size,
      blob,
    };
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Recovery draft could not be saved.'));
    });
    return withoutBlob(record);
  }

  async get() {
    const db = await this.#open().catch(() => null);
    if (!db) return null;
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(LATEST_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  async metadata() {
    return withoutBlob(await this.get());
  }

  async remove() {
    const db = await this.#open().catch(() => null);
    if (!db) return false;
    await new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(LATEST_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
    return true;
  }
}
