import test from 'node:test';
import assert from 'node:assert/strict';
import { RecoveryDraftStore } from '../src/persistence/RecoveryDraftStore.js';

class FakeObjectStore {
  constructor(records) { this.records = records; }
  createIndex() {}
  put(record) { this.records.set(record.key, structuredClone(record)); }
  delete(key) { this.records.delete(key); }
  get(key) {
    const request = {};
    queueMicrotask(() => {
      request.result = this.records.get(key) || null;
      request.onsuccess?.();
    });
    return request;
  }
}

class FakeTransaction {
  constructor(store) {
    this.store = store;
    queueMicrotask(() => this.oncomplete?.());
  }
  objectStore() { return this.store; }
}

class FakeDatabase {
  constructor() {
    this.records = new Map();
    this.store = new FakeObjectStore(this.records);
    this.objectStoreNames = { contains: () => this.created };
    this.created = false;
  }
  createObjectStore() { this.created = true; return this.store; }
  transaction() { return new FakeTransaction(this.store); }
}

class FakeIndexedDB {
  constructor() { this.db = new FakeDatabase(); this.opened = false; }
  open() {
    const request = {};
    queueMicrotask(() => {
      request.result = this.db;
      if (!this.opened) {
        this.opened = true;
        request.onupgradeneeded?.();
      }
      request.onsuccess?.();
    });
    return request;
  }
}

test('recovery store degrades safely when IndexedDB is unavailable', async () => {
  const store = new RecoveryDraftStore({ indexedDB: null });
  assert.equal(store.available, false);
  assert.equal(await store.metadata(), null);
  assert.equal(await store.save({ blob: new Blob(['draft']) }), null);
  assert.equal(await store.remove(), false);
});

test('recovery store round-trips one local draft and removes it', async () => {
  const store = new RecoveryDraftStore({ indexedDB: new FakeIndexedDB() });
  const blob = new Blob(['portable project'], { type: 'application/x-productvis' });
  const metadata = await store.save({
    blob,
    title: 'Recovered Shot',
    assetName: 'product.glb',
    projectId: 'project-1',
    schemaVersion: 8,
  });
  assert.equal(metadata.title, 'Recovered Shot');
  assert.equal(metadata.size, blob.size);
  const record = await store.get();
  assert.equal(record.projectId, 'project-1');
  assert.equal(await record.blob.text(), 'portable project');
  assert.equal(await store.remove(), true);
  assert.equal(await store.get(), null);
});

test('recovery store rejects drafts above its local safety budget', async () => {
  const store = new RecoveryDraftStore({ indexedDB: new FakeIndexedDB(), maxBytes: 3 });
  await assert.rejects(() => store.save({ blob: new Blob(['four']) }), /too large/i);
});
