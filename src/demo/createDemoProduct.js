import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function createDemoProduct() {
  const group = new THREE.Group();
  group.name = 'Demo Product Camera';

  const graphite = new THREE.MeshPhysicalMaterial({
    name: 'Graphite shell',
    color: 0x1a1d21,
    roughness: 0.3,
    metalness: 0.58,
    clearcoat: 0.38,
    clearcoatRoughness: 0.22,
  });
  const darkGlass = new THREE.MeshPhysicalMaterial({
    name: 'Smoked glass',
    color: 0x06070a,
    roughness: 0.1,
    metalness: 0.05,
    transmission: 0.08,
    thickness: 0.18,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
  });
  const chrome = new THREE.MeshPhysicalMaterial({
    name: 'Machined ring',
    color: 0xbcc3c9,
    roughness: 0.18,
    metalness: 1,
    clearcoat: 0.35,
  });
  const lens = new THREE.MeshPhysicalMaterial({
    name: 'Lens',
    color: 0x111821,
    roughness: 0.06,
    metalness: 0.25,
    transmission: 0.22,
    thickness: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    iridescence: 0.28,
    iridescenceIOR: 1.3,
  });
  const accent = new THREE.MeshPhysicalMaterial({
    name: 'Accent',
    color: 0xff7950,
    roughness: 0.28,
    metalness: 0.18,
    emissive: 0x44140a,
    emissiveIntensity: 0.65,
    clearcoat: 0.45,
  });

  const body = new THREE.Mesh(new RoundedBoxGeometry(1.76, 2.18, 0.86, 8, 0.16), graphite);
  body.position.y = 1.19;
  group.add(body);

  const grip = new THREE.Mesh(new RoundedBoxGeometry(0.34, 1.58, 0.94, 6, 0.12), graphite.clone());
  grip.material.roughness = 0.52;
  grip.position.set(0.76, 1.17, -0.015);
  group.add(grip);

  const frontPanel = new THREE.Mesh(new RoundedBoxGeometry(1.34, 1.63, 0.075, 7, 0.09), darkGlass);
  frontPanel.position.set(-0.08, 1.19, 0.468);
  group.add(frontPanel);

  const lensHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.49, 0.53, 0.34, 72, 1, false), graphite.clone());
  lensHousing.material.roughness = 0.2;
  lensHousing.material.metalness = 0.72;
  lensHousing.rotation.x = Math.PI / 2;
  lensHousing.position.set(-0.08, 1.33, 0.62);
  group.add(lensHousing);

  const lensRing = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.045, 18, 80), chrome);
  lensRing.position.set(-0.08, 1.33, 0.81);
  group.add(lensRing);

  const lensGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.09, 72), lens);
  lensGlass.rotation.x = Math.PI / 2;
  lensGlass.position.set(-0.08, 1.33, 0.83);
  group.add(lensGlass);

  const innerLens = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.25, 0.045, 64), darkGlass.clone());
  innerLens.rotation.x = Math.PI / 2;
  innerLens.position.set(-0.08, 1.33, 0.885);
  group.add(innerLens);

  const topPlate = new THREE.Mesh(new RoundedBoxGeometry(1.34, 0.18, 0.68, 5, 0.07), chrome.clone());
  topPlate.material.roughness = 0.24;
  topPlate.position.set(-0.12, 2.32, -0.01);
  group.add(topPlate);

  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.12, 48), chrome.clone());
  dial.position.set(0.28, 2.48, 0.02);
  group.add(dial);

  const shutter = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.085, 40), accent);
  shutter.position.set(-0.48, 2.44, 0.15);
  group.add(shutter);

  const accentStrip = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.035, 0.05, 3, 0.015), accent.clone());
  accentStrip.position.set(0.48, 0.44, 0.49);
  group.add(accentStrip);

  const badge = new THREE.Mesh(new THREE.RingGeometry(0.055, 0.072, 32), chrome.clone());
  badge.position.set(0.48, 1.9, 0.51);
  group.add(badge);

  group.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  return group;
}
