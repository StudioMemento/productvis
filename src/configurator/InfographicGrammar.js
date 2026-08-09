export const MAX_INFOGRAPHICS = 64;
export const INFOGRAPHIC_DISPLAY_MODES = new Set(['off', 'selected', 'all']);
export const INFOGRAPHIC_SIDE_MODES = new Set(['auto', 'left', 'right']);

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function cleanText(value, fallback = '', maxLength = 240) {
  const normalized = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return (normalized || fallback).slice(0, maxLength);
}

function cleanBody(value, fallback = '', maxLength = 900) {
  const normalized = typeof value === 'string'
    ? value.replace(/\r\n?/g, '\n').trim().replace(/[ \t]+/g, ' ')
    : '';
  return (normalized || fallback).slice(0, maxLength);
}

export function createInfographicId() {
  if (globalThis.crypto?.randomUUID) return `info_${globalThis.crypto.randomUUID()}`;
  return `info_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function sanitizeInfographicId(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  const normalized = String(value)
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
  return normalized || fallback;
}

export function sanitizeInfographicAnchorId(value) {
  return sanitizeInfographicId(value, null);
}

export function sanitizeHexColor(value, fallback = '#ff7950') {
  const source = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const short = /^#([0-9a-f]{3})$/.exec(source);
  if (short) return `#${[...short[1]].map((char) => `${char}${char}`).join('')}`;
  const full = /^#([0-9a-f]{6})$/.exec(source);
  return full ? `#${full[1]}` : fallback;
}

function isoDate(value, fallback = null) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

export function sanitizeInfographics(value) {
  const source = Array.isArray(value) ? value : [];
  const used = new Set();
  return source.slice(0, MAX_INFOGRAPHICS).map((record, index) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
    const anchorId = sanitizeInfographicAnchorId(record.anchorId);
    if (!anchorId) return null;
    let id = sanitizeInfographicId(record.id, `info_${index + 1}`);
    const base = id;
    let suffix = 2;
    while (used.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    used.add(id);
    return {
      id,
      anchorId,
      eyebrow: cleanText(record.eyebrow, 'FEATURE', 48),
      title: cleanText(record.title, `Infographic ${index + 1}`, 100),
      body: cleanBody(record.body, '', 900),
      accent: sanitizeHexColor(record.accent, '#ff7950'),
      side: INFOGRAPHIC_SIDE_MODES.has(record.side) ? record.side : 'auto',
      visible: record.visible !== false,
      createdAt: isoDate(record.createdAt, null),
      updatedAt: isoDate(record.updatedAt, null),
    };
  }).filter(Boolean);
}

export function sanitizeInfographicState(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const infographics = sanitizeInfographics(source.infographics ?? source.callouts);
  const candidate = source.selectedInfographicId ?? source.selectedCalloutId;
  const selectedInfographicId = infographics.some((item) => item.id === candidate) ? candidate : null;
  const displayCandidate = source.infographicDisplay ?? source.calloutDisplay;
  return {
    infographics,
    infographicDisplay: INFOGRAPHIC_DISPLAY_MODES.has(displayCandidate) ? displayCandidate : 'off',
    selectedInfographicId,
  };
}

export function cloneInfographicState(value) {
  return clone(sanitizeInfographicState(value));
}
