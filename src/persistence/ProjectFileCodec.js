import { slugify } from '../utils/format.js';
import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  migrateProjectState,
} from './ProjectMigration.js';
import { sanitizeSavedLook } from './SavedLookLibrary.js';

export const PROJECT_FILE_MAGIC = 'PVISPRJ1';
export const PROJECT_FILE_EXTENSION = '.productvis';
export const PROJECT_FILE_MIME = 'application/x-productvis';
export const PROJECT_CONTAINER_VERSION = 1;

const MAGIC_BYTES = new TextEncoder().encode(PROJECT_FILE_MAGIC);
const HEADER_PREFIX_BYTES = MAGIC_BYTES.byteLength + 4;
const MAX_HEADER_BYTES = 8 * 1024 * 1024;
const MAX_ASSET_BYTES = 1024 * 1024 * 1024;

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function asUint8Array(value) {
  if (!value) return new Uint8Array(0);
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new TypeError('Embedded asset bytes must be an ArrayBuffer or Uint8Array.');
}

function verifyMagic(bytes) {
  if (bytes.byteLength < HEADER_PREFIX_BYTES) return false;
  for (let index = 0; index < MAGIC_BYTES.length; index += 1) {
    if (bytes[index] !== MAGIC_BYTES[index]) return false;
  }
  return true;
}

function normalizeAsset(asset = {}) {
  if (asset.kind === 'procedural-demo' || !asset.bytes) {
    return {
      kind: 'procedural-demo',
      name: String(asset.name || 'Demo Object').slice(0, 180),
      mimeType: null,
      byteLength: 0,
      bytes: new Uint8Array(0),
    };
  }
  const bytes = asUint8Array(asset.bytes);
  if (bytes.byteLength > MAX_ASSET_BYTES) throw new Error('The embedded GLB is too large for a Product VIS project file.');
  return {
    kind: 'embedded-glb',
    name: String(asset.name || 'product.glb').slice(0, 240),
    mimeType: String(asset.mimeType || 'model/gltf-binary').slice(0, 120),
    byteLength: bytes.byteLength,
    bytes,
  };
}

function normalizeSavedLooks(looks = []) {
  if (!Array.isArray(looks)) return [];
  return looks.map((item) => sanitizeSavedLook(item)).filter(Boolean).slice(0, 24);
}

export function projectFilename(name) {
  return `${slugify(name || 'product-vis-project')}${PROJECT_FILE_EXTENSION}`;
}

export function encodeProjectFile({
  project,
  asset,
  savedLooks = [],
  appVersion = '1.9.0',
  sourceViewport = null,
  createdAt = null,
  modifiedAt = new Date().toISOString(),
} = {}) {
  const migration = migrateProjectState(project, { now: modifiedAt });
  const normalizedAsset = normalizeAsset(asset);
  const header = {
    kind: 'productvis-project',
    containerVersion: PROJECT_CONTAINER_VERSION,
    appVersion: String(appVersion),
    projectSchemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    createdAt: createdAt || migration.project.meta?.createdAt || modifiedAt,
    modifiedAt,
    sourceViewport: sourceViewport && typeof sourceViewport === 'object'
      ? {
        width: Math.max(1, Math.round(Number(sourceViewport.width) || 1)),
        height: Math.max(1, Math.round(Number(sourceViewport.height) || 1)),
      }
      : null,
    asset: {
      kind: normalizedAsset.kind,
      name: normalizedAsset.name,
      mimeType: normalizedAsset.mimeType,
      byteLength: normalizedAsset.byteLength,
    },
    project: migration.project,
    savedLooks: normalizeSavedLooks(savedLooks),
  };

  const headerBytes = new TextEncoder().encode(JSON.stringify(header));
  if (headerBytes.byteLength > MAX_HEADER_BYTES) throw new Error('The Product VIS project header is too large.');

  const prefix = new Uint8Array(HEADER_PREFIX_BYTES);
  prefix.set(MAGIC_BYTES, 0);
  new DataView(prefix.buffer).setUint32(MAGIC_BYTES.byteLength, headerBytes.byteLength, true);

  return new Blob([prefix, headerBytes, normalizedAsset.bytes], { type: PROJECT_FILE_MIME });
}

async function decodeLegacyJson(blob) {
  const text = await blob.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This is not a valid Product VIS project file.');
  }
  const migration = migrateProjectState(parsed.project || parsed);
  return {
    header: {
      kind: 'productvis-project',
      containerVersion: 0,
      appVersion: parsed.appVersion || null,
      projectSchemaVersion: migration.targetVersion,
      createdAt: parsed.createdAt || migration.project.meta?.createdAt || null,
      modifiedAt: parsed.modifiedAt || migration.project.meta?.updatedAt || null,
      sourceViewport: parsed.sourceViewport || null,
      asset: parsed.asset || { kind: 'procedural-demo', name: migration.project.model.name, byteLength: 0 },
    },
    project: migration.project,
    asset: {
      kind: 'procedural-demo',
      name: parsed.asset?.name || migration.project.model.name,
      mimeType: null,
      byteLength: 0,
      bytes: new Uint8Array(0),
    },
    savedLooks: normalizeSavedLooks(parsed.savedLooks),
    migration,
    legacyJson: true,
  };
}

export async function decodeProjectFile(input) {
  const blob = input instanceof Blob ? input : new Blob([input]);
  if (blob.size < HEADER_PREFIX_BYTES) return decodeLegacyJson(blob);

  const prefixBytes = new Uint8Array(await blob.slice(0, HEADER_PREFIX_BYTES).arrayBuffer());
  if (!verifyMagic(prefixBytes)) return decodeLegacyJson(blob);

  const headerLength = new DataView(prefixBytes.buffer).getUint32(MAGIC_BYTES.byteLength, true);
  if (headerLength <= 0 || headerLength > MAX_HEADER_BYTES) throw new Error('The Product VIS project header is invalid.');
  const assetOffset = HEADER_PREFIX_BYTES + headerLength;
  if (assetOffset > blob.size) throw new Error('The Product VIS project is truncated.');

  let header;
  try {
    const headerText = await blob.slice(HEADER_PREFIX_BYTES, assetOffset).text();
    header = JSON.parse(headerText);
  } catch {
    throw new Error('The Product VIS project header could not be decoded.');
  }

  if (header?.kind !== 'productvis-project') throw new Error('This file is not a Product VIS project.');
  if (Number(header.containerVersion) > PROJECT_CONTAINER_VERSION) {
    throw new Error('This project was created by a newer Product VIS version.');
  }

  const migration = migrateProjectState(header.project || {});
  const declaredAssetBytes = Math.max(0, Number(header.asset?.byteLength) || 0);
  const availableAssetBytes = blob.size - assetOffset;
  if (declaredAssetBytes > MAX_ASSET_BYTES || declaredAssetBytes > availableAssetBytes) {
    throw new Error('The embedded GLB is missing or truncated.');
  }

  const assetKind = header.asset?.kind === 'embedded-glb' && declaredAssetBytes > 0
    ? 'embedded-glb'
    : 'procedural-demo';
  const bytes = assetKind === 'embedded-glb'
    ? new Uint8Array(await blob.slice(assetOffset, assetOffset + declaredAssetBytes).arrayBuffer())
    : new Uint8Array(0);

  return {
    header: clone(header),
    project: migration.project,
    asset: {
      kind: assetKind,
      name: String(header.asset?.name || migration.project.model.name || 'product.glb'),
      mimeType: assetKind === 'embedded-glb'
        ? String(header.asset?.mimeType || 'model/gltf-binary')
        : null,
      byteLength: bytes.byteLength,
      bytes,
    },
    savedLooks: normalizeSavedLooks(header.savedLooks),
    migration,
    legacyJson: false,
  };
}
