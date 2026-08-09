export const EXPERIENCE_SCHEMA_VERSION = 1;
export const MAX_EXPERIENCE_LOGO_BYTES = 768 * 1024;

const THEMES = new Set(['dark', 'light', 'auto']);
const ENTRY_MODES = new Set(['intro', 'direct']);
const INFOGRAPHIC_MODES = new Set(['inherit', 'off', 'selected', 'all']);

const DEFAULT_ACCENT = '#ff7950';

function cleanText(value, fallback = '', maxLength = 160) {
  const normalized = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return (normalized || fallback).slice(0, maxLength);
}

function cleanMultiline(value, fallback = '', maxLength = 1000) {
  const normalized = typeof value === 'string'
    ? value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
    : '';
  return (normalized || fallback).slice(0, maxLength);
}

function boolean(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function enumValue(value, allowed, fallback) {
  return allowed.has(value) ? value : fallback;
}

function nullableText(value, maxLength = 240) {
  if (value === null || value === undefined || value === '') return null;
  return cleanText(value, '', maxLength) || null;
}

function sanitizeHex(value, fallback = DEFAULT_ACCENT) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : fallback;
}

function sanitizeHttpsUrl(value, { allowRelative = false } = {}) {
  if (value === null || value === undefined || value === '') return null;
  const candidate = String(value).trim().slice(0, 2048);
  if (allowRelative && /^\/(?!\/)/.test(candidate)) return candidate;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function estimateDataUrlBytes(value) {
  const comma = value.indexOf(',');
  if (comma < 0) return Number.POSITIVE_INFINITY;
  const payload = value.slice(comma + 1).replace(/\s/g, '');
  return Math.ceil(payload.length * 0.75);
}

export function sanitizeLogoDataUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('data:image/')) return null;
  const header = value.slice(0, value.indexOf(',') + 1).toLowerCase();
  if (!/^data:image\/(?:png|jpeg|webp|svg\+xml);base64,$/.test(header)) return null;
  if (estimateDataUrlBytes(value) > MAX_EXPERIENCE_LOGO_BYTES) return null;
  return value;
}

export const DEFAULT_EXPERIENCE_STATE = Object.freeze({
  schemaVersion: EXPERIENCE_SCHEMA_VERSION,
  title: 'Product Experience',
  eyebrow: 'PRODUCT VIS',
  subtitle: 'Explore the product through a guided realtime story.',
  accent: DEFAULT_ACCENT,
  theme: 'dark',
  logoDataUrl: null,
  entryMode: 'intro',
  startLabel: 'Start experience',
  entryStoryId: null,
  autoplay: true,
  allowOrbit: true,
  showOptions: true,
  showInfographics: true,
  infographicMode: 'inherit',
  showStepNavigation: true,
  showPlayControl: true,
  showFullscreen: true,
  showShare: true,
  showAr: true,
  showExit: true,
  intro: Object.freeze({
    enabled: true,
    title: 'Meet the product.',
    body: 'A guided 3D presentation built from the authored Product VIS story.',
  }),
  outro: Object.freeze({
    enabled: true,
    title: 'Ready for the next step?',
    body: 'Restart the story, explore freely, or continue to the product page.',
    ctaLabel: 'Learn more',
    ctaUrl: null,
  }),
  export: Object.freeze({
    brandOverlay: true,
    infographics: true,
    storyCaption: true,
  }),
  share: Object.freeze({
    hostedPackageUrl: null,
    publicPlayerUrl: null,
  }),
  ar: Object.freeze({
    androidGlbUrl: null,
    iosUsdzUrl: null,
    fallbackUrl: null,
    title: null,
    resizable: true,
    verticalPlacement: false,
  }),
});

export function sanitizeExperienceState(value = {}, defaults = DEFAULT_EXPERIENCE_STATE) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const intro = source.intro && typeof source.intro === 'object' ? source.intro : {};
  const outro = source.outro && typeof source.outro === 'object' ? source.outro : {};
  const exportState = source.export && typeof source.export === 'object' ? source.export : {};
  const share = source.share && typeof source.share === 'object' ? source.share : {};
  const ar = source.ar && typeof source.ar === 'object' ? source.ar : {};

  return {
    schemaVersion: EXPERIENCE_SCHEMA_VERSION,
    title: cleanText(source.title, defaults.title, 120),
    eyebrow: cleanText(source.eyebrow, defaults.eyebrow, 48),
    subtitle: cleanText(source.subtitle, defaults.subtitle, 260),
    accent: sanitizeHex(source.accent, defaults.accent),
    theme: enumValue(source.theme, THEMES, defaults.theme),
    logoDataUrl: sanitizeLogoDataUrl(source.logoDataUrl),
    entryMode: enumValue(source.entryMode, ENTRY_MODES, defaults.entryMode),
    startLabel: cleanText(source.startLabel, defaults.startLabel, 72),
    entryStoryId: nullableText(source.entryStoryId, 120),
    autoplay: boolean(source.autoplay, defaults.autoplay),
    allowOrbit: boolean(source.allowOrbit, defaults.allowOrbit),
    showOptions: boolean(source.showOptions, defaults.showOptions),
    showInfographics: boolean(source.showInfographics, defaults.showInfographics),
    infographicMode: enumValue(source.infographicMode, INFOGRAPHIC_MODES, defaults.infographicMode),
    showStepNavigation: boolean(source.showStepNavigation, defaults.showStepNavigation),
    showPlayControl: boolean(source.showPlayControl, defaults.showPlayControl),
    showFullscreen: boolean(source.showFullscreen, defaults.showFullscreen),
    showShare: boolean(source.showShare, defaults.showShare),
    showAr: boolean(source.showAr, defaults.showAr),
    showExit: boolean(source.showExit, defaults.showExit),
    intro: {
      enabled: boolean(intro.enabled, defaults.intro.enabled),
      title: cleanText(intro.title, defaults.intro.title, 140),
      body: cleanMultiline(intro.body, defaults.intro.body, 800),
    },
    outro: {
      enabled: boolean(outro.enabled, defaults.outro.enabled),
      title: cleanText(outro.title, defaults.outro.title, 140),
      body: cleanMultiline(outro.body, defaults.outro.body, 800),
      ctaLabel: cleanText(outro.ctaLabel, defaults.outro.ctaLabel, 72),
      ctaUrl: sanitizeHttpsUrl(outro.ctaUrl, { allowRelative: true }),
    },
    export: {
      brandOverlay: boolean(exportState.brandOverlay, defaults.export.brandOverlay),
      infographics: boolean(exportState.infographics, defaults.export.infographics),
      storyCaption: boolean(exportState.storyCaption, defaults.export.storyCaption),
    },
    share: {
      hostedPackageUrl: sanitizeHttpsUrl(share.hostedPackageUrl, { allowRelative: true }),
      publicPlayerUrl: sanitizeHttpsUrl(share.publicPlayerUrl, { allowRelative: true }),
    },
    ar: {
      androidGlbUrl: sanitizeHttpsUrl(ar.androidGlbUrl),
      iosUsdzUrl: sanitizeHttpsUrl(ar.iosUsdzUrl),
      fallbackUrl: sanitizeHttpsUrl(ar.fallbackUrl, { allowRelative: true }),
      title: nullableText(ar.title, 120),
      resizable: boolean(ar.resizable, defaults.ar.resizable),
      verticalPlacement: boolean(ar.verticalPlacement, defaults.ar.verticalPlacement),
    },
  };
}

export function experienceHasArTarget(experience = {}) {
  const state = sanitizeExperienceState(experience);
  return Boolean(state.ar.androidGlbUrl || state.ar.iosUsdzUrl);
}

export function experiencePlayerTitle(experience = {}, fallback = 'Product Experience') {
  return sanitizeExperienceState(experience).title || fallback;
}
