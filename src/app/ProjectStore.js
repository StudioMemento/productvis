import { DEFAULT_PROJECT_STATE } from '../config/presets.js';

function clone(value) {
  return structuredClone(value);
}

export function createInitialState() {
  return {
    project: clone(DEFAULT_PROJECT_STATE),
    session: {
      status: 'booting',
      meta: 'STARTING',
      stats: {
        triangles: 0,
        vertices: 0,
        materials: 0,
        textures: 0,
        animations: 0,
      },
    },
    ui: {
      activePanel: 'look',
      introDismissed: false,
      exporting: false,
    },
  };
}

function splitPath(path) {
  if (Array.isArray(path)) return path;
  return String(path).split('.').filter(Boolean);
}

function getAtPath(target, path) {
  return splitPath(path).reduce((value, key) => value?.[key], target);
}

function setAtPath(target, path, value) {
  const keys = splitPath(path);
  if (keys.length === 0) throw new Error('ProjectStore.set requires a non-empty path.');
  let cursor = target;
  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index];
    if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[keys.at(-1)] = value;
}

export class ProjectStore {
  #state;

  #listeners = new Set();

  #revision = 0;

  constructor(initialState = createInitialState()) {
    this.#state = clone(initialState);
  }

  getState() {
    return this.#state;
  }

  get(path) {
    return getAtPath(this.#state, path);
  }

  set(path, value, meta = {}) {
    const previous = this.get(path);
    if (Object.is(previous, value)) return this.#revision;
    setAtPath(this.#state, path, value);
    this.#emit({ type: 'set', path: splitPath(path).join('.'), value, previous, ...meta });
    return this.#revision;
  }

  patch(path, values, meta = {}) {
    const current = this.get(path);
    if (!current || typeof current !== 'object') {
      throw new Error(`ProjectStore.patch could not find object at "${path}".`);
    }
    Object.assign(current, values);
    this.#emit({ type: 'patch', path: splitPath(path).join('.'), values: { ...values }, ...meta });
    return this.#revision;
  }

  transaction(mutator, meta = {}) {
    if (typeof mutator !== 'function') throw new TypeError('ProjectStore.transaction requires a function.');
    mutator(this.#state);
    this.#emit({ type: 'transaction', ...meta });
    return this.#revision;
  }

  snapshot() {
    return clone(this.#state);
  }

  subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('ProjectStore.subscribe requires a function.');
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #emit(event) {
    this.#revision += 1;
    const payload = { ...event, revision: this.#revision, state: this.#state };
    this.#listeners.forEach((listener) => listener(payload));
  }
}
