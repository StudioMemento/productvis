import { sanitizeExperienceState } from './ExperienceGrammar.js';

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export class ExperienceRuntime {
  constructor({ onChange } = {}) {
    this.onChange = onChange;
    this.profile = sanitizeExperienceState();
    this.active = false;
    this.phase = 'editor';
    this.storyId = null;
    this.storyState = null;
    this.source = 'editor';
  }

  enter(profile, { storyId = null, source = 'editor' } = {}) {
    this.profile = sanitizeExperienceState(profile);
    this.active = true;
    this.source = source === 'package' || source === 'remote' ? source : 'editor';
    this.storyId = storyId || this.profile.entryStoryId || null;
    this.storyState = null;
    const wantsIntro = this.profile.entryMode === 'intro' && this.profile.intro.enabled;
    this.phase = wantsIntro ? 'intro' : 'active';
    this.#notify('enter');
    return this.getState();
  }

  updateProfile(profile) {
    this.profile = sanitizeExperienceState(profile);
    if (this.active && !this.storyId) this.storyId = this.profile.entryStoryId || null;
    this.#notify('profile');
    return this.getState();
  }

  start() {
    if (!this.active) return false;
    this.phase = 'active';
    this.#notify('start');
    return true;
  }

  showOutro() {
    if (!this.active || !this.profile.outro.enabled) return false;
    this.phase = 'outro';
    this.#notify('outro');
    return true;
  }

  dismissOutro() {
    if (!this.active || this.phase !== 'outro') return false;
    this.phase = 'active';
    this.#notify('outro-dismiss');
    return true;
  }

  updateStory(storyState = null) {
    this.storyState = storyState ? clone(storyState) : null;
    if (storyState?.storyId) this.storyId = storyState.storyId;
    this.#notify('story');
    return this.getState();
  }

  exit() {
    if (!this.active) return false;
    this.active = false;
    this.phase = 'editor';
    this.storyState = null;
    this.#notify('exit');
    return true;
  }

  getState() {
    return clone({
      active: this.active,
      phase: this.phase,
      storyId: this.storyId,
      storyState: this.storyState,
      source: this.source,
      profile: this.profile,
    });
  }

  #notify(reason) {
    this.onChange?.({ reason, state: this.getState() });
  }
}
