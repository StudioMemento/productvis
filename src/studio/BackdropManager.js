import * as THREE from 'three';

function toneToCss(tone) {
  const byte = Math.round(THREE.MathUtils.clamp(tone, 0, 1) * 255);
  return `rgb(${byte}, ${byte}, ${byte})`;
}

/**
 * A seam-free visible field. It never changes scene.environment, so background
 * tone is a presentation decision rather than a lighting decision.
 */
export class BackdropManager {
  constructor(scene) {
    this.scene = scene;
    this.color = new THREE.Color();
    this.tone = 0.82;
  }

  initialize(tone = 0.82) {
    this.scene.background = this.color;
    this.scene.backgroundBlurriness = 0;
    this.scene.backgroundIntensity = 1;
    this.setTone(tone);
    return this;
  }

  setTone(value) {
    this.tone = THREE.MathUtils.clamp(Number(value) || 0, 0.015, 0.985);
    this.color.setStyle(toneToCss(this.tone));
    if (this.scene.background !== this.color) this.scene.background = this.color;
  }

  getTone() {
    return this.tone;
  }
}
