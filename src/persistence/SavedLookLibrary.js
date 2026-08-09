import { sanitizeProjectState } from './ProjectMigration.js';

export const SAVED_LOOK_STORAGE_KEY = 'product-vis:saved-looks:v1';
export const SAVED_LOOK_SCHEMA_VERSION = 1;

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `look-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeName(value, fallback = 'Saved Look') {
  const name = typeof value === 'string' ? value.trim() : '';
  return (name || fallback).slice(0, 80);
}

function getDefaultStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

export function createSavedLook(project, name, {
  id = createId(),
  now = new Date().toISOString(),
} = {}) {
  const state = sanitizeProjectState(project, { now });
  return {
    schemaVersion: SAVED_LOOK_SCHEMA_VERSION,
    id: String(id).slice(0, 96),
    name: normalizeName(name),
    createdAt: now,
    updatedAt: now,
    studio: clone(state.studio),
    render: clone(state.render),
  };
}

export function sanitizeSavedLook(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  try {
    const now = new Date(input.updatedAt || input.createdAt || Date.now()).toISOString();
    const project = sanitizeProjectState({
      studio: input.studio || input.payload?.studio,
      render: input.render || input.payload?.render,
    }, { now });
    return {
      schemaVersion: SAVED_LOOK_SCHEMA_VERSION,
      id: String(input.id || createId()).slice(0, 96),
      name: normalizeName(input.name),
      createdAt: new Date(input.createdAt || now).toISOString(),
      updatedAt: now,
      studio: clone(project.studio),
      render: clone(project.render),
    };
  } catch {
    return null;
  }
}

export class SavedLookLibrary {
  constructor(storage = undefined, { maxEntries = 24 } = {}) {
    this.storage = storage === undefined ? getDefaultStorage() : storage;
    this.maxEntries = Math.max(1, Math.floor(maxEntries));
  }

  list() {
    if (!this.storage) return [];
    try {
      const parsed = JSON.parse(this.storage.getItem(SAVED_LOOK_STORAGE_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item) => sanitizeSavedLook(item))
        .filter(Boolean)
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
        .slice(0, this.maxEntries);
    } catch {
      return [];
    }
  }

  get(id) {
    return this.list().find((look) => look.id === String(id)) || null;
  }

  add(project, name) {
    const fallbackName = `Look ${this.list().length + 1}`;
    const look = createSavedLook(project, normalizeName(name, fallbackName));
    this.#write([look, ...this.list().filter((item) => item.id !== look.id)]);
    return look;
  }

  remove(id) {
    const current = this.list();
    const next = current.filter((look) => look.id !== String(id));
    if (next.length === current.length) return false;
    this.#write(next);
    return true;
  }

  merge(looks = []) {
    const imported = Array.isArray(looks)
      ? looks.map((item) => sanitizeSavedLook(item)).filter(Boolean)
      : [];
    const merged = new Map(this.list().map((item) => [item.id, item]));
    imported.forEach((item) => {
      const existing = merged.get(item.id);
      if (!existing || String(item.updatedAt) >= String(existing.updatedAt)) merged.set(item.id, item);
    });
    const next = [...merged.values()]
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .slice(0, this.maxEntries);
    this.#write(next);
    return next;
  }

  clear() {
    if (!this.storage) return;
    try {
      this.storage.removeItem(SAVED_LOOK_STORAGE_KEY);
    } catch {
      // Saved looks are optional; storage failures must not block rendering.
    }
  }

  #write(looks) {
    if (!this.storage) return;
    try {
      const normalized = looks
        .map((item) => sanitizeSavedLook(item))
        .filter(Boolean)
        .slice(0, this.maxEntries);
      this.storage.setItem(SAVED_LOOK_STORAGE_KEY, JSON.stringify(normalized));
    } catch (error) {
      throw new Error(error?.name === 'QuotaExceededError'
        ? 'Saved-look storage is full.'
        : 'Saved looks could not be written on this device.');
    }
  }
}
