import * as THREE from 'three';

export class MotionController {
  constructor({ getMotionRoot, isTransforming, onStateChange, onChapterComplete } = {}) {
    this.getMotionRoot = getMotionRoot;
    this.isTransforming = isTransforming;
    this.onStateChange = onStateChange;
    this.onChapterComplete = onChapterComplete;
    this.mixer = null;
    this.clips = [];
    this.action = null;
    this.playing = false;
    this.loop = true;
    this.speed = 1;
    this.turntable = false;
    this.turntableSpeed = 0.3;
    this.chapterRange = null;
  }

  setup(clips, asset) {
    if (this.mixer) this.mixer.stopAllAction();
    this.clips = clips || [];
    this.action = null;
    this.playing = false;
    this.chapterRange = null;

    if (this.clips.length === 0) {
      this.mixer = null;
      this.#notify();
      return this.getState();
    }

    this.mixer = new THREE.AnimationMixer(asset);
    this.mixer.timeScale = this.speed;
    this.mixer.addEventListener('finished', () => {
      if (this.chapterRange) return;
      if (!this.loop) this.setPlaying(false);
    });
    this.select(0, { autoplay: false, notify: false });
    this.#notify();
    return this.getState();
  }

  select(index, { autoplay = false, notify = true, preserveChapter = false } = {}) {
    if (!this.mixer || !this.clips[index]) return false;
    if (!preserveChapter) this.chapterRange = null;
    const previous = this.action;
    const next = this.mixer.clipAction(this.clips[index]);
    next.reset();
    next.enabled = true;
    next.clampWhenFinished = true;
    this.action = next;
    this.updateLoopMode();

    if (previous && previous !== next) {
      previous.fadeOut(0.25);
      next.fadeIn(0.25);
    }

    next.play();
    next.paused = !autoplay;
    this.playing = Boolean(autoplay);
    if (notify) this.#notify({ clipIndex: index });
    return true;
  }

  togglePlayback() {
    if (!this.action) return false;
    this.chapterRange = null;
    if (this.playing) {
      this.action.paused = true;
      this.setPlaying(false);
    } else {
      if (this.action.time >= this.action.getClip().duration - 0.001) this.action.reset();
      this.action.paused = false;
      this.action.play();
      this.setPlaying(true);
    }
    return true;
  }

  setPlaying(playing, { notify = true } = {}) {
    this.playing = Boolean(playing && this.action);
    if (this.action) {
      this.action.paused = !this.playing;
      if (this.playing) this.action.play();
    }
    if (notify) this.#notify();
  }

  setLoop(enabled, { notify = true } = {}) {
    this.loop = Boolean(enabled);
    this.updateLoopMode();
    if (notify) this.#notify();
  }

  updateLoopMode() {
    if (!this.action) return;
    if (this.loop) {
      this.action.setLoop(THREE.LoopRepeat, Infinity);
      this.action.clampWhenFinished = false;
    } else {
      this.action.setLoop(THREE.LoopOnce, 1);
      this.action.clampWhenFinished = true;
    }
  }

  setSpeed(speed, { notify = true } = {}) {
    this.speed = THREE.MathUtils.clamp(Number(speed) || 1, 0.01, 10);
    if (this.mixer) this.mixer.timeScale = this.speed;
    if (notify) this.#notify();
  }

  setTime(time, { notify = true } = {}) {
    const requested = Math.max(0, Number(time) || 0);
    if (this.action) {
      const duration = Math.max(0.000001, this.action.getClip().duration || 0);
      this.action.time = this.loop ? requested % duration : Math.min(requested, duration);
      this.mixer?.update(0);
    } else if (this.mixer) {
      this.mixer.setTime(requested);
    }
    if (notify) this.#notify();
    return this.getState().time;
  }

  playChapter(chapter, { notify = true } = {}) {
    if (!chapter || !this.mixer || !this.clips[chapter.clipIndex]) return false;
    const clip = this.clips[chapter.clipIndex];
    const duration = Math.max(0.000001, Number(clip.duration) || 0);
    const startTime = THREE.MathUtils.clamp(Number(chapter.startTime) || 0, 0, Math.max(0, duration - 0.001));
    const endTime = THREE.MathUtils.clamp(Number(chapter.endTime) || duration, startTime + 0.001, duration);
    const speed = THREE.MathUtils.clamp(Number(chapter.speed) || 1, 0.05, 4);

    this.select(chapter.clipIndex, { autoplay: false, notify: false, preserveChapter: true });
    this.chapterRange = {
      id: chapter.id || null,
      name: chapter.name || clip.name || 'Chapter',
      clipIndex: chapter.clipIndex,
      startTime,
      endTime,
      speed,
      loop: Boolean(chapter.loop),
      holdAtEnd: chapter.holdAtEnd !== false,
    };
    this.speed = speed;
    this.mixer.timeScale = speed;
    this.loop = false;
    if (this.action) {
      this.action.setLoop(THREE.LoopOnce, 1);
      this.action.clampWhenFinished = true;
      this.action.time = startTime;
      this.action.paused = false;
      this.action.play();
    }
    this.playing = true;
    this.mixer.update(0);
    if (notify) this.#notify();
    return true;
  }

  pauseChapter({ notify = true } = {}) {
    if (!this.chapterRange || !this.action) return false;
    this.playing = false;
    this.action.paused = true;
    if (notify) this.#notify();
    return true;
  }

  resumeChapter({ notify = true } = {}) {
    if (!this.chapterRange || !this.action) return false;
    this.playing = true;
    this.action.paused = false;
    this.action.play();
    if (notify) this.#notify();
    return true;
  }

  clearChapter({ pause = true, notify = true } = {}) {
    const hadChapter = Boolean(this.chapterRange);
    this.chapterRange = null;
    if (pause && this.action) {
      this.playing = false;
      this.action.paused = true;
    }
    if (notify && hadChapter) this.#notify();
    return hadChapter;
  }

  setTurntable(enabled, { notify = true } = {}) {
    this.turntable = Boolean(enabled);
    if (notify) this.#notify();
  }

  setTurntableSpeed(speed, { notify = true } = {}) {
    this.turntableSpeed = THREE.MathUtils.clamp(Number(speed) || 0.3, 0.01, 10);
    if (notify) this.#notify();
  }

  setTurntableAngle(angle, { notify = true } = {}) {
    const motionRoot = this.getMotionRoot?.();
    const safeAngle = Number.isFinite(Number(angle)) ? Number(angle) : 0;
    if (motionRoot) motionRoot.rotation.y = safeAngle;
    if (notify) this.#notify();
    return safeAngle;
  }

  applyState(state = {}, { notify = true } = {}) {
    this.chapterRange = null;
    const clipIndex = Math.max(0, Math.min(this.clips.length - 1, Math.floor(Number(state.clipIndex) || 0)));
    this.loop = typeof state.loop === 'boolean' ? state.loop : true;
    this.speed = THREE.MathUtils.clamp(Number(state.speed) || 1, 0.01, 10);
    this.turntable = Boolean(state.turntable);
    this.turntableSpeed = THREE.MathUtils.clamp(Number(state.turntableSpeed) || 0.3, 0.01, 10);
    if (this.mixer) this.mixer.timeScale = this.speed;

    if (this.clips.length > 0 && this.mixer) {
      this.select(clipIndex, { autoplay: false, notify: false });
      this.updateLoopMode();
      this.setTime(state.time, { notify: false });
      this.playing = Boolean(state.playing);
      if (this.action) {
        this.action.paused = !this.playing;
        if (this.playing) this.action.play();
      }
    } else {
      this.playing = false;
      this.action = null;
    }

    this.setTurntableAngle(state.turntableAngle ?? state.rotationY ?? 0, { notify: false });
    if (notify) this.#notify();
    return this.getState();
  }

  reset({ notify = true } = {}) {
    this.chapterRange = null;
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.timeScale = 1;
      this.mixer.setTime(0);
    }
    this.action = null;
    this.playing = false;
    this.loop = true;
    this.speed = 1;
    this.turntable = false;
    this.turntableSpeed = 0.3;
    this.chapterRange = null;

    const motionRoot = this.getMotionRoot?.();
    if (motionRoot) motionRoot.rotation.set(0, 0, 0);

    if (this.clips.length > 0 && this.mixer) {
      this.select(0, { autoplay: false, notify: false });
      if (this.action) {
        this.action.reset();
        this.action.paused = true;
      }
    }
    if (notify) this.#notify();
    return this.getState();
  }

  update(delta) {
    if (this.mixer) this.mixer.update(delta);
    if (this.chapterRange && this.action && this.playing) {
      const range = this.chapterRange;
      if (this.action.time >= range.endTime - 0.0001) {
        if (range.loop) {
          this.action.time = range.startTime;
          this.mixer?.update(0);
        } else {
          this.action.time = range.holdAtEnd ? range.endTime : range.startTime;
          this.action.paused = true;
          this.playing = false;
          this.mixer?.update(0);
          const completed = { ...range };
          this.chapterRange = null;
          this.#notify();
          this.onChapterComplete?.(completed);
        }
      }
    }
    const motionRoot = this.getMotionRoot?.();
    if (this.turntable && motionRoot && !this.isTransforming?.()) {
      motionRoot.rotation.y += delta * this.turntableSpeed * 0.7;
    }
  }

  isDynamic() {
    return Boolean(this.playing || this.turntable);
  }

  getState() {
    const clipIndex = this.action
      ? Math.max(0, this.clips.findIndex((clip) => clip === this.action.getClip()))
      : 0;
    const motionRoot = this.getMotionRoot?.();
    return {
      clips: this.clips,
      clipIndex,
      playing: this.playing,
      loop: this.loop,
      speed: this.speed,
      time: this.action?.time || 0,
      turntable: this.turntable,
      turntableSpeed: this.turntableSpeed,
      turntableAngle: motionRoot?.rotation.y || 0,
      chapter: this.chapterRange ? { ...this.chapterRange } : null,
      chapterId: this.chapterRange?.id || null,
    };
  }

  getSerializableState() {
    const state = this.getState();
    return {
      clipIndex: state.clipIndex,
      playing: state.playing,
      loop: state.loop,
      speed: state.speed,
      time: state.time,
      turntable: state.turntable,
      turntableSpeed: state.turntableSpeed,
      turntableAngle: state.turntableAngle,
      rotationY: state.turntableAngle,
    };
  }

  #notify(extra = {}) {
    this.onStateChange?.({ ...this.getState(), ...extra });
  }
}
