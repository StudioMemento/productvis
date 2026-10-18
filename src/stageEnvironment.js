import * as THREE from 'three';

// One bounded stage probe, plus the original studio environment. Updates are
// coalesced while dragging a control; the final value is applied before sleeping.
export class StageEnvironment {
  constructor(renderer, scene, fallback, coarse = false, createGenerator = () => new THREE.PMREMGenerator(renderer)) {
    this.scene = scene; this.fallback = fallback; this.coarse = coarse; this.createGenerator = createGenerator;
    this.lastCapture = -Infinity; this.signature = ''; this.stage = null; this.target = null;
  }
  setStage(stage, settings) {
    this.stage = stage?.createProbe ? stage : null; this.settings = settings;
    if (!this.stage) {
      this.scene.environment = this.fallback;
      this.target?.dispose(); this.target = null; this.signature = '';
    }
  }
  update(time = 0, force = false) {
    if (!this.stage) return false;
    const key = this.stage.probeSignature(this.settings);
    if (key === this.signature) return false;
    if (!force && time - this.lastCapture < 180) return true;
    this.generator ??= this.createGenerator();
    const probe = this.stage.createProbe(this.settings);
    let target;
    try { target = this.generator.fromScene(probe, .025, .1, 90, { size: this.coarse ? 128 : 256, position: new THREE.Vector3(0, 1, 0) }); }
    finally {
      const geometry = new Set(), materials = new Set();
      probe.traverse(node => { if (node.geometry) geometry.add(node.geometry); if (node.material) materials.add(node.material); });
      geometry.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    }
    const previous = this.target;
    this.target = target; this.scene.environment = target.texture;
    this.signature = key; this.lastCapture = time; previous?.dispose();
    return false;
  }
  dispose() { this.scene.environment = this.fallback; this.target?.dispose(); this.generator?.dispose(); this.target = null; }
}
