import * as THREE from 'three';

export class MotionController {
  constructor({ getMotionRoot, isTransforming, onStateChange } = {}) {
    this.getMotionRoot = getMotionRoot;
    this.isTransforming = isTransforming;
    this.onStateChange = onStateChange;
    this.mixer = null;
    this.clips = [];
    this.action = null;
    this.playing = false;
    this.loop = true;
    this.speed = 1;
    this.turntable = false;
    this.turntableSpeed = 0.3;
  }

  setup(clips, asset) {
    if (this.mixer) this.mixer.stopAllAction();
    this.clips = clips || [];
    this.action = null;
    this.playing = false;

    if (this.clips.length === 0) {
      this.mixer = null;
      this.#notify();
      return this.getState();
    }

    this.mixer = new THREE.AnimationMixer(asset);
    this.mixer.timeScale = this.speed;
    this.mixer.addEventListener('finished', () => {
      if (!this.loop) this.setPlaying(false);
    });
    this.select(0, { autoplay: false, notify: false });
    this.#notify();
    return this.getState();
  }

  select(index, { autoplay = false, notify = true } = {}) {
    if (!this.mixer || !this.clips[index]) return false;
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

  setPlaying(playing) {
    this.playing = Boolean(playing);
    this.#notify();
  }

  setLoop(enabled) {
    this.loop = Boolean(enabled);
    this.updateLoopMode();
    this.#notify();
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

  setSpeed(speed) {
    this.speed = speed;
    if (this.mixer) this.mixer.timeScale = speed;
    this.#notify();
  }

  setTurntable(enabled) {
    this.turntable = Boolean(enabled);
    this.#notify();
  }

  setTurntableSpeed(speed) {
    this.turntableSpeed = speed;
    this.#notify();
  }

  update(delta) {
    if (this.mixer) this.mixer.update(delta);
    const motionRoot = this.getMotionRoot?.();
    if (this.turntable && motionRoot && !this.isTransforming?.()) {
      motionRoot.rotation.y += delta * this.turntableSpeed * 0.7;
    }
  }

  getState() {
    const clipIndex = this.action
      ? Math.max(0, this.clips.findIndex((clip) => clip === this.action.getClip()))
      : 0;
    return {
      clips: this.clips,
      clipIndex,
      playing: this.playing,
      loop: this.loop,
      speed: this.speed,
      turntable: this.turntable,
      turntableSpeed: this.turntableSpeed,
    };
  }

  #notify(extra = {}) {
    this.onStateChange?.({ ...this.getState(), ...extra });
  }
}
