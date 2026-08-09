import * as THREE from 'three';

/**
 * Neutral direct-light support for edge definition. Reflections remain owned by
 * EnvironmentManager; these lights are intentionally color restrained.
 */
export class LightRig {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'Product VIS Neutral Light Rig';
    this.hemiLight = null;
    this.keyLight = null;
    this.fillLight = null;
    this.rimLight = null;
  }

  initialize() {
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x121418, 0.24);

    this.keyLight = new THREE.DirectionalLight(0xfffbf6, 2.35);
    this.keyLight.name = 'PV Key Light';
    this.keyLight.position.set(4.8, 7.2, 5.8);

    this.fillLight = new THREE.DirectionalLight(0xdce7f2, 0.78);
    this.fillLight.name = 'PV Fill Light';
    this.fillLight.position.set(-5.2, 3.8, 4.4);

    this.rimLight = new THREE.DirectionalLight(0xffffff, 1.8);
    this.rimLight.name = 'PV Rim Light';
    this.rimLight.position.set(-4.6, 5.5, -5.5);

    [this.keyLight, this.fillLight, this.rimLight].forEach((light) => {
      light.castShadow = false;
      this.group.add(light);
      this.group.add(light.target);
      light.target.position.set(0, 1.2, 0);
    });
    this.group.add(this.hemiLight);
    this.scene.add(this.group);
    return this;
  }

  setKeyIntensity(value) {
    this.keyLight.intensity = Math.max(0, Number(value) || 0);
  }

  setFillIntensity(value) {
    this.fillLight.intensity = Math.max(0, Number(value) || 0);
  }

  setRimIntensity(value) {
    this.rimLight.intensity = Math.max(0, Number(value) || 0);
  }

  updateForBounds(bounds) {
    if (!bounds || bounds.isEmpty()) return;
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const targetY = bounds.min.y + size.y * 0.48;

    [this.keyLight.target, this.fillLight.target, this.rimLight.target].forEach((target) => {
      target.position.set(center.x, targetY, center.z);
      target.updateMatrixWorld();
    });
  }

  getCurrent() {
    return {
      key: this.keyLight.intensity,
      fill: this.fillLight.intensity,
      rim: this.rimLight.intensity,
    };
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.clear();
  }
}
