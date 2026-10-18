import * as THREE from 'three';
import { createConcreteMaps, createHaloFloor } from './amberHaloMaterial.js';
import { haloSettings, haloBudget } from './amberHaloSettings.js';
import { addHorizonToMaterial, createHorizon } from './horizon.js';

const fogVertex = `
  varying vec2 vMistUv; varying vec3 vMistWorld;
  void main() {
    vMistUv = uv;
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vMistWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }`;
const fogFragment = `
  uniform sampler2D detail; uniform vec3 mistColor, accent;
  uniform float phase, density, haloRadius, haloPower;
  varying vec2 vMistUv; varying vec3 vMistWorld;
  void main() {
    vec2 p = vMistWorld.xz * .075 + vec2(phase * .018, -phase * .009);
    float a = texture2D(detail, p).a;
    float b = texture2D(detail, p * 2.31 + vec2(-phase * .012, phase * .006)).a;
    float billow = smoothstep(.18, .8, a * .65 + b * .35);
    vec2 q = vMistUv * 2.0 - 1.0;
    float edge = pow(max(0.0, 1.0 - q.x * q.x), 2.0) * pow(max(0.0, 1.0 - q.y * q.y), 2.0);
    float clearCentre = smoothstep(haloRadius + .55, haloRadius + 2.8, length(vMistWorld.xz));
    float opacity = edge * billow * density * clearCentre * .20;
    if(opacity < .002) discard;
    vec3 tint = mistColor + accent * haloPower * .035 * exp(-abs(length(vMistWorld.xz) - haloRadius) * .25);
    gl_FragColor = vec4(tint, opacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

// A lighting-only set: wide cool softboxes and a low amber band around the product.
// Captured by PMREM when its appearance changes, never on every animation frame.
export function createHaloProbe(s) {
  const settings = haloSettings(s), scene = new THREE.Scene();
  scene.background = new THREE.Color('#080b10');
  function card(width, height, position, color, intensity, target = [0, 1, 0]) {
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    mesh.position.fromArray(position); mesh.lookAt(...target); scene.add(mesh);
  }
  card(7, 4, [0, 7, 0], '#dce8ff', 3.2);
  card(3, 6, [-6, 3, 1], '#b6c9e5', 2.2);
  card(2, 5, [6, 3, -3], '#e7edf6', 1.3);
  const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(s.ringColor).multiplyScalar(settings.haloIntensity * 3.4), side: THREE.DoubleSide });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(settings.haloRadius, settings.haloRadius, .18, 64, 1, true), material);
  band.position.y = .07; scene.add(band);
  return scene;
}

export function createAmberHaloStage(s, coarse = false, sharedHorizon) {
  const group = new THREE.Group(); group.name = 'Amber Halo · realtime studio';
  const horizon=sharedHorizon||createHorizon(s);if(!sharedHorizon)group.add(horizon.sky);
  const maps = createConcreteMaps(coarse);
  const uniforms = {
    haloColor: { value: new THREE.Color(s.ringColor) }, haloRadius: { value: 3.7 },
    haloPower: { value: 1 }, haloWetness: { value: .55 },
  };
  const floorMaterial = addHorizonToMaterial(createHaloFloor(maps, uniforms),horizon);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), floorMaterial);
  floor.name = 'Amber Halo · concrete floor'; floor.rotation.x = -Math.PI / 2; floor.position.y = -.012; floor.receiveShadow = true;
  group.add(floor);
  const ring = new THREE.Group(); group.add(ring);
  const grooveMaterial = new THREE.MeshStandardMaterial({ color: '#050609', metalness: .6, roughness: .3 });
  const groove = new THREE.Mesh(new THREE.RingGeometry(.982, 1.018, 128), grooveMaterial);
  groove.rotation.x = -Math.PI / 2; groove.position.y = -.007; ring.add(groove);
  const trimMaterial = new THREE.MeshStandardMaterial({ color: '#33343a', metalness: .85, roughness: .28 });
  for (const radius of [.982, 1.018]) {
    const trim = new THREE.Mesh(new THREE.TorusGeometry(radius, .0016, 6, 128), trimMaterial);
    trim.rotation.x = -Math.PI / 2; trim.position.y = -.001; ring.add(trim);
  }
  const stripMaterial = new THREE.MeshBasicMaterial({ color: s.ringColor });
  const strip = new THREE.Mesh(new THREE.TorusGeometry(1, .0035, 6, 128), stripMaterial);
  strip.name = 'Amber Halo · recessed emitter'; strip.rotation.x = -Math.PI / 2; strip.position.y = .003; ring.add(strip);
  const lamps = [-1, 1].map(side => {
    const lamp = new THREE.PointLight(s.ringColor, 1, 8, 2);
    lamp.name = 'Amber Halo · low bounce'; lamp.position.set(side * 2.6, .22, .8); group.add(lamp); return lamp;
  });
  const mistMaterial = new THREE.ShaderMaterial({
    uniforms: { detail: { value: maps.normalMap }, mistColor: { value: new THREE.Color('#91a2bc') }, accent: uniforms.haloColor,
      phase: { value: 0 }, density: { value: s.fog }, haloRadius: uniforms.haloRadius, haloPower: uniforms.haloPower },
    vertexShader: fogVertex, fragmentShader: fogFragment, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const atmosphere = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mistMaterial, 20);
  atmosphere.name = 'Amber Halo · low drifting mist'; atmosphere.frustumCulled = false;
  atmosphere.renderOrder = 2;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 20; i++) {
    const angle = i * 2.399963, radius = 7.5 + (i % 4) * 2.4;
    dummy.position.set(Math.sin(angle) * radius, .35 + (i % 3) * .16, Math.cos(angle) * radius);
    dummy.rotation.set(0, angle, 0); dummy.scale.set(7 + (i % 3), 1.1 + (i % 4) * .24, 1); dummy.updateMatrix();
    atmosphere.setMatrixAt(i, dummy.matrix);
  }
  group.add(atmosphere);
  let phase = 0, lastTime = null;
  const result = {
    group, atmosphere, floorVisible: false, reflectionSpan: 90, isAmberHalo: true, usesCachedReflection:true, maps,
    createProbe: createHaloProbe,
    probeSignature(config) {
      const v = haloSettings(config);
      return `halo:${config.ringColor}:${v.haloIntensity.toFixed(3)}:${v.haloRadius.toFixed(2)}`;
    },
    update(config, time = 0, context = {}) {
      const v = haloSettings(config), budget = haloBudget(context.quality, coarse);
      const speed = context.reducedMotion ? 0 : Math.max(0, config.speed ?? .35);
      if (context.recording) phase = time * speed;
      else if (lastTime !== null) phase += Math.max(0, Math.min(time - lastTime, .1)) * speed;
      lastTime = time;
      ring.scale.set(v.haloRadius, 1, v.haloRadius);
      const power = v.haloIntensity * 3.4;
      uniforms.haloColor.value.set(config.ringColor); uniforms.haloRadius.value = v.haloRadius;
      uniforms.haloPower.value = power; uniforms.haloWetness.value = v.wetness;
      stripMaterial.color.set(config.ringColor).multiplyScalar(power);
      floorMaterial.color.set(config.groundColor);
      floorMaterial.roughness = Math.max(.09, config.floorRoughness * (1 - v.wetness * .35));
      floorMaterial.normalScale.setScalar(.08 + v.microDetail * .48);
      floorMaterial.metalness = .08 + v.wetness * .08;
      horizon.update(config);
      for (const [i, lamp] of lamps.entries()) {
        lamp.color.set(config.ringColor);
        lamp.intensity = power * (context.lighting?.intensity ?? 1) * .85;
        lamp.position.x = (i ? 1 : -1) * v.haloRadius * .72;
      }
      atmosphere.count = budget.fogCount;
      atmosphere.visible = config.fog > .001 && context.inspection?.view !== 'normals';
      mistMaterial.uniforms.density.value = Math.min(1, config.fog * 1.7);
      mistMaterial.uniforms.phase.value = phase;
      return atmosphere.visible && speed > 0;
    },
    get phase() { return phase; },
    restorePhase(value, time) { phase = value; lastTime = time; },
  };
  result.update(s);
  return result;
}
