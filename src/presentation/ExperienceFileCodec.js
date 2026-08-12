import { slugify } from '../utils/format.js';
import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  migrateProjectState,
} from '../persistence/ProjectMigration.js';
import { sanitizeExperienceState } from './ExperienceGrammar.js';

export const EXPERIENCE_FILE_MAGIC = 'PVISSHOW1';
export const EXPERIENCE_FILE_EXTENSION = '.productvis-show';
export const EXPERIENCE_FILE_MIME = 'application/x-productvis-show';
export const EXPERIENCE_CONTAINER_VERSION = 1;

const MAGIC_BYTES = new TextEncoder().encode(EXPERIENCE_FILE_MAGIC);
const PREFIX_BYTES = MAGIC_BYTES.byteLength + 4;
const MAX_HEADER_BYTES = 16 * 1024 * 1024;
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
  throw new TypeError('Experience asset bytes must be an ArrayBuffer or Uint8Array.');
}

function verifyMagic(bytes) {
  if (bytes.byteLength < PREFIX_BYTES) return false;
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
  if (bytes.byteLength > MAX_ASSET_BYTES) throw new Error('The embedded GLB is too large for a Product VIS experience.');
  return {
    kind: 'embedded-glb',
    name: String(asset.name || 'product.glb').slice(0, 240),
    mimeType: String(asset.mimeType || 'model/gltf-binary').slice(0, 120),
    byteLength: bytes.byteLength,
    bytes,
  };
}

export function experienceFilename(name) {
  return `${slugify(name || 'product-experience')}${EXPERIENCE_FILE_EXTENSION}`;
}

export function createPublishedProject(project, { now = new Date().toISOString() } = {}) {
  const migrated = migrateProjectState(project, { now }).project;
  const experience = sanitizeExperienceState(migrated.experience);
  return {
    ...migrated,
    experience,
    runtime: {
      autoQuality: true,
      pauseWhenHidden: true,
      recoveryEnabled: false,
    },
    configurator: {
      ...migrated.configurator,
      anchorDisplay: 'off',
      selectedAnchorId: null,
      storyPreviewEnabled: true,
      variantPreviewEnabled: experience.showOptions && migrated.configurator.variantGroups.length > 0,
      infographicDisplay: experience.showInfographics
        ? (experience.infographicMode === 'inherit'
          ? migrated.configurator.infographicDisplay
          : experience.infographicMode)
        : 'off',
    },
  };
}

export function encodeExperienceFile({
  project,
  asset,
  appVersion = '2.1.0-alpha.1',
  createdAt = null,
  modifiedAt = new Date().toISOString(),
} = {}) {
  const publishedProject = createPublishedProject(project, { now: modifiedAt });
  const normalizedAsset = normalizeAsset(asset);
  const experience = sanitizeExperienceState(publishedProject.experience);
  const header = {
    kind: 'productvis-experience',
    containerVersion: EXPERIENCE_CONTAINER_VERSION,
    appVersion: String(appVersion),
    projectSchemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    experienceSchemaVersion: experience.schemaVersion,
    createdAt: createdAt || publishedProject.meta?.createdAt || modifiedAt,
    modifiedAt,
    asset: {
      kind: normalizedAsset.kind,
      name: normalizedAsset.name,
      mimeType: normalizedAsset.mimeType,
      byteLength: normalizedAsset.byteLength,
    },
    experience,
    project: publishedProject,
  };

  const headerBytes = new TextEncoder().encode(JSON.stringify(header));
  if (headerBytes.byteLength > MAX_HEADER_BYTES) throw new Error('The Product VIS experience header is too large.');
  const prefix = new Uint8Array(PREFIX_BYTES);
  prefix.set(MAGIC_BYTES, 0);
  new DataView(prefix.buffer).setUint32(MAGIC_BYTES.byteLength, headerBytes.byteLength, true);
  return new Blob([prefix, headerBytes, normalizedAsset.bytes], { type: EXPERIENCE_FILE_MIME });
}

export async function decodeExperienceFile(input) {
  const blob = input instanceof Blob ? input : new Blob([input]);
  if (blob.size < PREFIX_BYTES) throw new Error('This is not a valid Product VIS experience file.');
  const prefix = new Uint8Array(await blob.slice(0, PREFIX_BYTES).arrayBuffer());
  if (!verifyMagic(prefix)) throw new Error('This is not a Product VIS experience package.');
  const headerLength = new DataView(prefix.buffer).getUint32(MAGIC_BYTES.byteLength, true);
  if (headerLength <= 0 || headerLength > MAX_HEADER_BYTES) throw new Error('The Product VIS experience header is invalid.');
  const assetOffset = PREFIX_BYTES + headerLength;
  if (assetOffset > blob.size) throw new Error('The Product VIS experience package is truncated.');

  let header;
  try {
    header = JSON.parse(await blob.slice(PREFIX_BYTES, assetOffset).text());
  } catch {
    throw new Error('The Product VIS experience header could not be decoded.');
  }
  if (header?.kind !== 'productvis-experience') throw new Error('This file is not a Product VIS experience.');
  if (Number(header.containerVersion) > EXPERIENCE_CONTAINER_VERSION) {
    throw new Error('This experience was created by a newer Product VIS version.');
  }

  const migration = migrateProjectState({
    ...(header.project || {}),
    experience: header.experience || header.project?.experience,
  });
  const declaredBytes = Math.max(0, Number(header.asset?.byteLength) || 0);
  const availableBytes = blob.size - assetOffset;
  if (declaredBytes > MAX_ASSET_BYTES || declaredBytes > availableBytes) {
    throw new Error('The embedded GLB is missing or truncated.');
  }
  const kind = header.asset?.kind === 'embedded-glb' && declaredBytes > 0
    ? 'embedded-glb'
    : 'procedural-demo';
  const bytes = kind === 'embedded-glb'
    ? new Uint8Array(await blob.slice(assetOffset, assetOffset + declaredBytes).arrayBuffer())
    : new Uint8Array(0);
  const project = createPublishedProject(migration.project, { now: header.modifiedAt || undefined });

  return {
    header: clone(header),
    project,
    experience: sanitizeExperienceState(project.experience),
    asset: {
      kind,
      name: String(header.asset?.name || project.model.name || 'product.glb'),
      mimeType: kind === 'embedded-glb' ? String(header.asset?.mimeType || 'model/gltf-binary') : null,
      byteLength: bytes.byteLength,
      bytes,
    },
    migration,
  };
}
