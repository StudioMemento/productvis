import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/**
 * Owns image-based lighting independently from the visible backdrop.
 * The procedural RoomEnvironment is converted once to a PMREM texture and
 * remains stable while users move between white, gray and black backgrounds.
 */
export class EnvironmentManager {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.pmremGenerator = null;
    this.renderTarget = null;
    this.texture = null;
    this.intensity = 1;
    this.rotation = 0;
  }

  initialize({ intensity = 1.1, rotation = Math.PI * 0.08 } = {}) {
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.pmremGenerator.compileEquirectangularShader();

    const room = new RoomEnvironment();
    this.renderTarget = this.pmremGenerator.fromScene(room, 0.04);
    this.texture = this.renderTarget.texture;
    room.dispose();

    this.scene.environment = this.texture;
    this.setIntensity(intensity);
    this.setRotation(rotation);
    return this;
  }

  setIntensity(value) {
    this.intensity = THREE.MathUtils.clamp(Number(value) || 0, 0, 4);
    this.scene.environmentIntensity = this.intensity;
  }

  setRotation(radians) {
    this.rotation = Number.isFinite(radians) ? radians : 0;
    if (this.scene.environmentRotation?.isEuler) {
      this.scene.environmentRotation.set(0, this.rotation, 0);
    }
  }

  dispose() {
    if (this.scene.environment === this.texture) this.scene.environment = null;
    this.renderTarget?.dispose();
    this.pmremGenerator?.dispose();
    this.renderTarget = null;
    this.texture = null;
    this.pmremGenerator = null;
  }
}
