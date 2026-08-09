import {
  MAX_ANIMATION_CHAPTERS,
  MAX_STORIES,
  MAX_STORY_STEPS,
  createStoryId,
  sanitizeAnimationChapter,
  sanitizeStoryAuthoringState,
  sanitizeStoryStep,
  validateStoryReferences,
} from './StoryGrammar.js';

const clone = (value) => (typeof structuredClone === 'function'
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value)));

function cleanName(value, fallback, maxLength = 100) {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return (text || fallback).slice(0, maxLength);
}

export class StorySystem {
  constructor({ onChange, getLibraries } = {}) {
    this.onChange = onChange;
    this.getLibraries = getLibraries;
    this.animationChapters = [];
    this.stories = [];
    this.activeStoryId = null;
    this.activeStoryStepId = null;
    this.storyPreviewEnabled = false;
  }

  applyState(state = {}, { notify = true } = {}) {
    const sanitized = sanitizeStoryAuthoringState(state);
    this.animationChapters = sanitized.animationChapters;
    this.stories = sanitized.stories;
    this.activeStoryId = sanitized.activeStoryId;
    this.activeStoryStepId = sanitized.activeStoryStepId;
    this.storyPreviewEnabled = sanitized.storyPreviewEnabled;
    if (notify) this.#notify('state-apply');
    return this.getState();
  }

  createChapter(payload = {}) {
    if (this.animationChapters.length >= MAX_ANIMATION_CHAPTERS) return null;
    const now = new Date().toISOString();
    const chapter = sanitizeAnimationChapter({
      ...payload,
      id: createStoryId('chapter'),
      name: cleanName(payload.name, `Chapter ${this.animationChapters.length + 1}`),
      createdAt: now,
      updatedAt: now,
    }, this.animationChapters.length);
    this.animationChapters.push(chapter);
    this.#notify('chapter-create');
    return clone(chapter);
  }

  updateChapter(id, patch = {}) {
    const index = this.animationChapters.findIndex((chapter) => chapter.id === id);
    if (index < 0) return false;
    const existing = this.animationChapters[index];
    const updated = sanitizeAnimationChapter({
      ...existing,
      ...patch,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    }, index);
    this.animationChapters[index] = updated;
    this.#notify('chapter-update');
    return clone(updated);
  }

  deleteChapter(id) {
    const before = this.animationChapters.length;
    this.animationChapters = this.animationChapters.filter((chapter) => chapter.id !== id);
    const changed = before !== this.animationChapters.length;
    if (!changed) return false;
    this.#notify('chapter-delete');
    return true;
  }

  getChapter(id) {
    const chapter = this.animationChapters.find((item) => item.id === id);
    return chapter ? clone(chapter) : null;
  }

  createStory(name, { loop = false } = {}) {
    if (this.stories.length >= MAX_STORIES) return null;
    const now = new Date().toISOString();
    const story = {
      id: createStoryId('story'),
      name: cleanName(name, `Story ${this.stories.length + 1}`),
      loop: Boolean(loop),
      steps: [],
      createdAt: now,
      updatedAt: now,
    };
    this.stories.unshift(story);
    this.activeStoryId = story.id;
    this.activeStoryStepId = null;
    this.#notify('story-create');
    return clone(story);
  }

  updateStory(id, patch = {}) {
    const story = this.stories.find((item) => item.id === id);
    if (!story) return false;
    if ('name' in patch) story.name = cleanName(patch.name, story.name);
    if ('loop' in patch) story.loop = Boolean(patch.loop);
    story.updatedAt = new Date().toISOString();
    this.#notify('story-update');
    return clone(story);
  }

  deleteStory(id) {
    const before = this.stories.length;
    this.stories = this.stories.filter((story) => story.id !== id);
    if (before === this.stories.length) return false;
    if (this.activeStoryId === id) {
      this.activeStoryId = this.stories[0]?.id || null;
      this.activeStoryStepId = null;
    }
    this.#notify('story-delete');
    return true;
  }

  selectStory(id) {
    const story = this.stories.find((item) => item.id === id);
    this.activeStoryId = story?.id || null;
    this.activeStoryStepId = story?.steps.some((step) => step.id === this.activeStoryStepId)
      ? this.activeStoryStepId
      : story?.steps[0]?.id || null;
    this.#notify('story-select');
    return story ? clone(story) : null;
  }

  addStep(storyId, payload = {}) {
    const story = this.stories.find((item) => item.id === storyId);
    if (!story || story.steps.length >= MAX_STORY_STEPS) return null;
    const now = new Date().toISOString();
    const step = sanitizeStoryStep({
      ...payload,
      id: createStoryId('step'),
      name: cleanName(payload.name, `Step ${story.steps.length + 1}`),
      createdAt: now,
      updatedAt: now,
    }, story.steps.length);
    story.steps.push(step);
    story.updatedAt = now;
    this.activeStoryId = story.id;
    this.activeStoryStepId = step.id;
    this.#notify('step-create');
    return clone(step);
  }

  updateStep(storyId, stepId, patch = {}) {
    const story = this.stories.find((item) => item.id === storyId);
    const index = story?.steps.findIndex((step) => step.id === stepId) ?? -1;
    if (!story || index < 0) return false;
    const existing = story.steps[index];
    const step = sanitizeStoryStep({
      ...existing,
      ...patch,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    }, index);
    story.steps[index] = step;
    story.updatedAt = step.updatedAt;
    this.activeStoryId = story.id;
    this.activeStoryStepId = step.id;
    this.#notify('step-update');
    return clone(step);
  }

  deleteStep(storyId, stepId) {
    const story = this.stories.find((item) => item.id === storyId);
    if (!story) return false;
    const before = story.steps.length;
    story.steps = story.steps.filter((step) => step.id !== stepId);
    if (before === story.steps.length) return false;
    story.updatedAt = new Date().toISOString();
    if (this.activeStoryStepId === stepId) this.activeStoryStepId = story.steps[0]?.id || null;
    this.#notify('step-delete');
    return true;
  }

  moveStep(storyId, stepId, direction) {
    const story = this.stories.find((item) => item.id === storyId);
    if (!story) return false;
    const index = story.steps.findIndex((step) => step.id === stepId);
    if (index < 0) return false;
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= story.steps.length) return false;
    [story.steps[index], story.steps[target]] = [story.steps[target], story.steps[index]];
    story.updatedAt = new Date().toISOString();
    this.#notify('step-move');
    return true;
  }

  selectStep(storyId, stepId) {
    const story = this.stories.find((item) => item.id === storyId);
    const step = story?.steps.find((item) => item.id === stepId) || null;
    this.activeStoryId = story?.id || null;
    this.activeStoryStepId = step?.id || null;
    this.#notify('step-select');
    return step ? clone(step) : null;
  }

  setPreviewEnabled(enabled) {
    this.storyPreviewEnabled = Boolean(enabled);
    this.#notify('preview-toggle');
    return this.storyPreviewEnabled;
  }

  getStory(id = this.activeStoryId) {
    const story = this.stories.find((item) => item.id === id);
    return story ? clone(story) : null;
  }

  getStep(storyId = this.activeStoryId, stepId = this.activeStoryStepId) {
    const story = this.stories.find((item) => item.id === storyId);
    const step = story?.steps.find((item) => item.id === stepId);
    return step ? clone(step) : null;
  }

  clear({ notify = true } = {}) {
    this.animationChapters = [];
    this.stories = [];
    this.activeStoryId = null;
    this.activeStoryStepId = null;
    this.storyPreviewEnabled = false;
    if (notify) this.#notify('clear');
  }

  getState() {
    return clone({
      animationChapters: this.animationChapters,
      stories: this.stories,
      activeStoryId: this.activeStoryId,
      activeStoryStepId: this.activeStoryStepId,
      storyPreviewEnabled: this.storyPreviewEnabled,
    });
  }

  getReport() {
    const libraries = this.getLibraries?.() || {};
    const validated = validateStoryReferences(this.getState(), libraries);
    const activeStory = validated.stories.find((story) => story.id === validated.activeStoryId) || null;
    const activeStep = activeStory?.steps.find((step) => step.id === validated.activeStoryStepId) || null;
    return clone({
      ...validated,
      chapterCount: validated.animationChapters.length,
      storyCount: validated.stories.length,
      stepCount: validated.stories.reduce((total, story) => total + story.steps.length, 0),
      activeStory,
      activeStep,
    });
  }

  #notify(reason) {
    this.onChange?.({ reason, state: this.getState(), report: this.getReport() });
  }
}
