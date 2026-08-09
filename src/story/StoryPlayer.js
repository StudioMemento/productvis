const clone = (value) => (typeof structuredClone === 'function'
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value)));

export class StoryPlayer {
  constructor({
    onApplyStep,
    onStartChapter,
    onPauseChapter,
    onResumeChapter,
    onStopChapter,
    onPauseTransition,
    onResumeTransition,
    onStopTransition,
    onStateChange,
    onComplete,
  } = {}) {
    this.onApplyStep = onApplyStep;
    this.onStartChapter = onStartChapter;
    this.onPauseChapter = onPauseChapter;
    this.onResumeChapter = onResumeChapter;
    this.onStopChapter = onStopChapter;
    this.onPauseTransition = onPauseTransition;
    this.onResumeTransition = onResumeTransition;
    this.onStopTransition = onStopTransition;
    this.onStateChange = onStateChange;
    this.onComplete = onComplete;
    this.story = null;
    this.stepIndex = -1;
    this.phase = 'idle';
    this.phaseStartedAt = 0;
    this.phaseDurationMs = 0;
    this.playing = false;
    this.paused = false;
    this.pausedAt = 0;
  }

  play(story, { stepId = null, now = performance.now() } = {}) {
    if (!story?.steps?.length) return false;
    if (this.story) {
      this.onStopChapter?.();
      this.onStopTransition?.();
    }
    this.story = clone(story);
    const requested = stepId ? this.story.steps.findIndex((step) => step.id === stepId) : -1;
    this.stepIndex = requested >= 0 ? requested : 0;
    this.playing = true;
    this.paused = false;
    this.#beginStep(now);
    return true;
  }

  preview(story, stepId, { now = performance.now() } = {}) {
    if (!story?.steps?.length) return false;
    const index = story.steps.findIndex((step) => step.id === stepId);
    if (index < 0) return false;
    this.stop({ notify: false });
    this.story = clone(story);
    this.stepIndex = index;
    this.playing = false;
    this.paused = false;
    this.#applyCurrentStep(now, false);
    this.phase = 'idle';
    this.#notify();
    return true;
  }

  pause({ now = performance.now() } = {}) {
    if (!this.playing || this.paused) return false;
    this.paused = true;
    this.pausedAt = now;
    if (this.phase === 'chapter') this.onPauseChapter?.();
    if (this.phase === 'transition') this.onPauseTransition?.({ now });
    this.#notify();
    return true;
  }

  resume({ now = performance.now() } = {}) {
    if (!this.playing || !this.paused) return false;
    const delta = Math.max(0, now - this.pausedAt);
    this.phaseStartedAt += delta;
    this.paused = false;
    this.pausedAt = 0;
    if (this.phase === 'chapter') this.onResumeChapter?.();
    if (this.phase === 'transition') this.onResumeTransition?.({ now });
    this.#notify();
    return true;
  }

  toggle(story, options = {}) {
    if (this.playing && this.paused) return this.resume(options);
    if (this.playing) return this.pause(options);
    return this.play(story, options);
  }

  stop({ notify = true } = {}) {
    this.onStopChapter?.();
    this.onStopTransition?.();
    this.story = null;
    this.stepIndex = -1;
    this.phase = 'idle';
    this.phaseStartedAt = 0;
    this.phaseDurationMs = 0;
    this.playing = false;
    this.paused = false;
    this.pausedAt = 0;
    if (notify) this.#notify();
  }

  next({ now = performance.now(), keepPlaying = this.playing } = {}) {
    if (!this.story?.steps?.length) return false;
    let next = this.stepIndex + 1;
    if (next >= this.story.steps.length) {
      if (!this.story.loop) return false;
      next = 0;
    }
    this.onStopChapter?.();
    this.onStopTransition?.();
    this.stepIndex = next;
    this.playing = Boolean(keepPlaying);
    this.paused = false;
    this.#beginStep(now);
    return true;
  }

  previous({ now = performance.now(), keepPlaying = this.playing } = {}) {
    if (!this.story?.steps?.length) return false;
    let previous = this.stepIndex - 1;
    if (previous < 0) previous = this.story.loop ? this.story.steps.length - 1 : 0;
    this.onStopChapter?.();
    this.onStopTransition?.();
    this.stepIndex = previous;
    this.playing = Boolean(keepPlaying);
    this.paused = false;
    this.#beginStep(now);
    return true;
  }

  goToStep(stepId, { now = performance.now(), keepPlaying = this.playing } = {}) {
    const index = this.story?.steps?.findIndex((step) => step.id === stepId) ?? -1;
    if (index < 0) return false;
    this.onStopChapter?.();
    this.onStopTransition?.();
    this.stepIndex = index;
    this.playing = Boolean(keepPlaying);
    this.paused = false;
    this.#beginStep(now);
    return true;
  }

  notifyChapterComplete({ now = performance.now() } = {}) {
    if (this.phase !== 'chapter') return false;
    this.#beginHold(now);
    return true;
  }

  update(now = performance.now()) {
    if (!this.playing || this.paused || !this.story) return this.getState();
    const elapsed = Math.max(0, now - this.phaseStartedAt);
    if (this.phase === 'transition' && elapsed >= this.phaseDurationMs) {
      this.#startChapterOrHold(now);
    } else if (this.phase === 'hold' && elapsed >= this.phaseDurationMs) {
      if (!this.next({ now, keepPlaying: true })) {
        const completed = clone(this.story);
        this.stop({ notify: false });
        this.onComplete?.(completed);
        this.#notify();
      }
    }
    return this.getState();
  }

  getCurrentStep() {
    return this.story?.steps?.[this.stepIndex] || null;
  }

  getState() {
    const step = this.getCurrentStep();
    return {
      playing: this.playing,
      paused: this.paused,
      phase: this.phase,
      storyId: this.story?.id || null,
      storyName: this.story?.name || null,
      stepIndex: this.stepIndex,
      stepId: step?.id || null,
      stepName: step?.name || null,
      stepCount: this.story?.steps?.length || 0,
    };
  }

  #beginStep(now) {
    this.#applyCurrentStep(now, true);
    this.#notify();
  }

  #applyCurrentStep(now, schedule) {
    const step = this.getCurrentStep();
    if (!step) return;
    this.onApplyStep?.(clone(step), {
      story: clone(this.story),
      stepIndex: this.stepIndex,
      playing: this.playing,
    });
    if (!schedule) return;
    const durationMs = Math.max(0, Number(step.transitionDuration) || 0) * 1000;
    if (durationMs > 0) {
      this.phase = 'transition';
      this.phaseStartedAt = now;
      this.phaseDurationMs = durationMs;
    } else {
      this.#startChapterOrHold(now);
    }
  }

  #startChapterOrHold(now) {
    const step = this.getCurrentStep();
    if (!step) return;
    const started = step.chapterId ? this.onStartChapter?.(step.chapterId, clone(step)) : false;
    if (started) {
      this.phase = 'chapter';
      this.phaseStartedAt = now;
      this.phaseDurationMs = Number.POSITIVE_INFINITY;
      this.#notify();
    } else {
      this.#beginHold(now);
    }
  }

  #beginHold(now) {
    const step = this.getCurrentStep();
    const durationMs = Math.max(0, Number(step?.holdDuration) || 0) * 1000;
    if (durationMs <= 0) {
      if (!this.next({ now, keepPlaying: true })) {
        const completed = clone(this.story);
        this.stop({ notify: false });
        this.onComplete?.(completed);
        this.#notify();
      }
      return;
    }
    this.phase = 'hold';
    this.phaseStartedAt = now;
    this.phaseDurationMs = durationMs;
    this.#notify();
  }

  #notify() {
    this.onStateChange?.(this.getState());
  }
}
