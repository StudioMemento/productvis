export const MAX_EXPLODE_OFFSETS = 256;
export const MAX_EXPLODE_STATES = 32;
export const MAX_ANIMATION_CHAPTERS = 32;
export const MAX_STORIES = 16;
export const MAX_STORY_STEPS = 48;

export const STORY_EASINGS = Object.freeze(['linear', 'ease-in-out', 'ease-out', 'cinematic']);
export const EXPLODE_DIRECTIONS = Object.freeze(['auto', 'x', 'y', 'z', '-x', '-y', '-z']);
export const STORY_INFOGRAPHIC_MODES = Object.freeze(['inherit', 'off', 'selected', 'all']);

const easingSet = new Set(STORY_EASINGS);
const infographicModeSet = new Set(STORY_INFOGRAPHIC_MODES);

const clone = (value) => (typeof structuredClone === 'function'
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value)));

const finite = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const clamp = (value, min, max, fallback = min) => Math.min(max, Math.max(min, finite(value, fallback)));
const bool = (value, fallback = false) => (typeof value === 'boolean' ? value : fallback);

const cleanText = (value, fallback = '', maxLength = 120) => {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return (text || fallback).slice(0, maxLength);
};

export function cleanStoryId(value, fallback = null, maxLength = 120) {
  if (value === null || value === undefined || value === '') return fallback;
  const normalized = String(value)
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLength);
  return normalized || fallback;
}

export function createStoryId(prefix = 'story') {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function isoDate(value, fallback = null) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

export function sanitizePartId(value) {
  const normalized = typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 96)
    : '';
  return /^part_[a-z0-9_]+$/.test(normalized) ? normalized : null;
}

export function sanitizeExplodeVector(value) {
  const source = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? [value.x, value.y, value.z]
      : [0, 0, 0];
  return source.slice(0, 3).map((component) => clamp(component, -8, 8, 0));
}

export function sanitizeExplodeOffsets(value, { validPartIds = null } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const valid = validPartIds instanceof Set ? validPartIds : null;
  const result = {};
  Object.entries(value).slice(0, MAX_EXPLODE_OFFSETS).forEach(([partId, vector]) => {
    const id = sanitizePartId(partId);
    if (!id || (valid && !valid.has(id))) return;
    const sanitized = sanitizeExplodeVector(vector);
    if (Math.hypot(...sanitized) > 0.000001) result[id] = sanitized;
  });
  return result;
}

export function sanitizeExplodeStates(value, { validPartIds = null } = {}) {
  const source = Array.isArray(value) ? value : [];
  const usedIds = new Set();
  return source.slice(0, MAX_EXPLODE_STATES).map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    let id = cleanStoryId(item.id, `explode_${index + 1}`);
    const base = id;
    let suffix = 2;
    while (usedIds.has(id)) id = `${base}-${suffix++}`;
    usedIds.add(id);
    return {
      id,
      name: cleanText(item.name, `Exploded state ${index + 1}`, 100),
      offsets: sanitizeExplodeOffsets(item.offsets, { validPartIds }),
      createdAt: isoDate(item.createdAt),
      updatedAt: isoDate(item.updatedAt),
    };
  }).filter(Boolean);
}

export function sanitizeExplosionState(value = {}, options = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const explodeOffsets = sanitizeExplodeOffsets(source.explodeOffsets ?? source.partOffsets, options);
  const explodeStates = sanitizeExplodeStates(source.explodeStates ?? source.explodedStates, options);
  const activeCandidate = cleanStoryId(source.activeExplodeStateId ?? source.activeExplodedStateId);
  return {
    explodeOffsets,
    explodeStates,
    activeExplodeStateId: explodeStates.some((item) => item.id === activeCandidate) ? activeCandidate : null,
  };
}

export function sanitizeAnimationChapter(value = {}, index = 0) {
  const start = clamp(value.startTime ?? value.start, 0, 3600, 0);
  const requestedEnd = clamp(value.endTime ?? value.end, 0, 3600, Math.max(1, start + 1));
  const end = Math.max(start + 0.001, requestedEnd);
  return {
    id: cleanStoryId(value.id, `chapter_${index + 1}`),
    name: cleanText(value.name, `Chapter ${index + 1}`, 100),
    clipIndex: Math.max(0, Math.min(999, Math.floor(finite(value.clipIndex, 0)))),
    startTime: start,
    endTime: end,
    speed: clamp(value.speed, 0.05, 4, 1),
    loop: bool(value.loop, false),
    holdAtEnd: bool(value.holdAtEnd, true),
    createdAt: isoDate(value.createdAt),
    updatedAt: isoDate(value.updatedAt),
  };
}

export function sanitizeAnimationChapters(value) {
  const source = Array.isArray(value) ? value : [];
  const usedIds = new Set();
  return source.slice(0, MAX_ANIMATION_CHAPTERS).map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const chapter = sanitizeAnimationChapter(item, index);
    const base = chapter.id;
    let suffix = 2;
    while (usedIds.has(chapter.id)) chapter.id = `${base}-${suffix++}`;
    usedIds.add(chapter.id);
    return chapter;
  }).filter(Boolean);
}

export function sanitizeStoryStep(value = {}, index = 0) {
  return {
    id: cleanStoryId(value.id, `step_${index + 1}`),
    name: cleanText(value.name, `Step ${index + 1}`, 100),
    presentationId: cleanStoryId(value.presentationId),
    explodeStateId: cleanStoryId(value.explodeStateId ?? value.explodedStateId),
    chapterId: cleanStoryId(value.chapterId ?? value.animationChapterId),
    infographicDisplay: infographicModeSet.has(value.infographicDisplay) ? value.infographicDisplay : 'inherit',
    selectedInfographicId: cleanStoryId(value.selectedInfographicId),
    transitionDuration: clamp(value.transitionDuration, 0, 12, 1.2),
    holdDuration: clamp(value.holdDuration, 0, 30, 1),
    easing: easingSet.has(value.easing) ? value.easing : 'cinematic',
    createdAt: isoDate(value.createdAt),
    updatedAt: isoDate(value.updatedAt),
  };
}

export function sanitizeStorySteps(value) {
  const source = Array.isArray(value) ? value : [];
  const usedIds = new Set();
  return source.slice(0, MAX_STORY_STEPS).map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const step = sanitizeStoryStep(item, index);
    const base = step.id;
    let suffix = 2;
    while (usedIds.has(step.id)) step.id = `${base}-${suffix++}`;
    usedIds.add(step.id);
    return step;
  }).filter(Boolean);
}

export function sanitizeStories(value) {
  const source = Array.isArray(value) ? value : [];
  const usedIds = new Set();
  return source.slice(0, MAX_STORIES).map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    let id = cleanStoryId(item.id, `story_${index + 1}`);
    const base = id;
    let suffix = 2;
    while (usedIds.has(id)) id = `${base}-${suffix++}`;
    usedIds.add(id);
    return {
      id,
      name: cleanText(item.name, `Story ${index + 1}`, 100),
      loop: bool(item.loop, false),
      steps: sanitizeStorySteps(item.steps),
      createdAt: isoDate(item.createdAt),
      updatedAt: isoDate(item.updatedAt),
    };
  }).filter(Boolean);
}

export function sanitizeStoryAuthoringState(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const chapters = sanitizeAnimationChapters(source.animationChapters ?? source.chapters);
  const stories = sanitizeStories(source.stories ?? source.storySequences);
  const activeStoryCandidate = cleanStoryId(source.activeStoryId);
  const activeStoryId = stories.some((story) => story.id === activeStoryCandidate) ? activeStoryCandidate : null;
  const activeStory = stories.find((story) => story.id === activeStoryId) || null;
  const activeStepCandidate = cleanStoryId(source.activeStoryStepId ?? source.activeStepId);
  const activeStoryStepId = activeStory?.steps.some((step) => step.id === activeStepCandidate) ? activeStepCandidate : null;
  return {
    animationChapters: chapters,
    stories,
    activeStoryId,
    activeStoryStepId,
    storyPreviewEnabled: bool(source.storyPreviewEnabled, false),
  };
}

export function validateStoryReferences(state = {}, libraries = {}) {
  const sanitized = sanitizeStoryAuthoringState(state);
  const presentationIds = new Set((libraries.presentations || []).map((item) => item.id));
  const explodeStateIds = new Set((libraries.explodeStates || []).map((item) => item.id));
  const chapterIds = new Set(sanitized.animationChapters.map((item) => item.id));
  const infographicIds = new Set((libraries.infographics || []).map((item) => item.id));
  const unresolved = [];

  const stories = sanitized.stories.map((story) => ({
    ...story,
    steps: story.steps.map((step) => {
      const missing = [];
      if (step.presentationId && !presentationIds.has(step.presentationId)) missing.push('presentation');
      if (step.explodeStateId && !explodeStateIds.has(step.explodeStateId)) missing.push('explode-state');
      if (step.chapterId && !chapterIds.has(step.chapterId)) missing.push('chapter');
      if (step.selectedInfographicId && !infographicIds.has(step.selectedInfographicId)) missing.push('infographic');
      if (missing.length) unresolved.push({ storyId: story.id, stepId: step.id, missing });
      return { ...step, unresolved: missing };
    }),
  }));

  return clone({ ...sanitized, stories, unresolved, unresolvedCount: unresolved.length });
}

export function resolveChapterRange(chapter, clipDuration) {
  const sanitized = sanitizeAnimationChapter(chapter);
  const duration = Math.max(0, finite(clipDuration, 0));
  if (duration <= 0) return { ...sanitized, valid: false, startTime: 0, endTime: 0, duration: 0 };
  const startTime = Math.min(sanitized.startTime, Math.max(0, duration - 0.001));
  const endTime = Math.min(Math.max(startTime + 0.001, sanitized.endTime), duration);
  return {
    ...sanitized,
    valid: endTime > startTime,
    startTime,
    endTime,
    duration: Math.max(0, (endTime - startTime) / sanitized.speed),
  };
}
