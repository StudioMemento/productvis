import * as THREE from 'three';

const dataCache = new Map();
const smooth = t => t * t * (3 - 2 * t);
const hash = (x, y) => {
  let n = Math.imul(x + 127, 374761393) ^ Math.imul(y + 911, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};
function periodicNoise(x, y, period) {
  const ix = Math.floor(x), iy = Math.floor(y), u = smooth(x - ix), v = smooth(y - iy);
  const at = (a, b) => hash((a + period) % period, (b + period) % period);
  const a = at(ix, iy) * (1 - u) + at(ix + 1, iy) * u;
  const b = at(ix, iy + 1) * (1 - u) + at(ix + 1, iy + 1) * u;
  return a * (1 - v) + b * v;
}

// Authored, seamless concrete maps. Generated once per device tier, never per frame.
// No photographic lighting is baked into the colour map.
export function concreteMapData(size = 1024) {
  if (dataCache.has(size)) return dataCache.get(size);
  const height = new Float32Array(size * size), broad = new Float32Array(size * size);
  const color = new Uint8Array(size * size * 4), normal = new Uint8Array(color.length), roughness = new Uint8Array(color.length);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, i = y * size + x;
    const large = periodicNoise(u * 4, v * 4, 4);
    const medium = periodicNoise(u * 16, v * 16, 16);
    const grain = periodicNoise(u * 64, v * 64, 64);
    const fine = periodicNoise(u * 128, v * 128, 128);
    const micro = periodicNoise(u * 256, v * 256, 256);
    const pore = Math.pow(Math.max(0, (hash(x, y) - .91) / .09), 3);
    broad[i] = large;
    height[i] = large * .24 + medium * .24 + grain * .24 + fine * .15 + micro * .10 - pore * .025;
    const value = Math.round(170 + (large - .5) * 40 + (medium - .5) * 22 + (fine - .5) * 10 + (micro - .5) * 8 - pore * 10);
    const rough = Math.round(128 + large * 66 + medium * 30 + fine * 16);
    for (let c = 0; c < 3; c++) { color[i * 4 + c] = value; roughness[i * 4 + c] = rough; }
    color[i * 4 + 3] = roughness[i * 4 + 3] = 255;
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    const dx = (height[y * size + (x + 1) % size] - height[y * size + (x + size - 1) % size]) * 3.5;
    const dy = (height[((y + 1) % size) * size + x] - height[((y + size - 1) % size) * size + x]) * 3.5;
    const length = Math.hypot(dx, dy, 1);
    normal.set([Math.round(127.5 - dx / length * 127.5), Math.round(127.5 - dy / length * 127.5), Math.round(127.5 + 127.5 / length), Math.round(broad[i] * 255)], i * 4);
  }
  const result = { size, color, normal, roughness };
  dataCache.set(size, result);
  return result;
}

export function createConcreteMaps(coarse = false) {
  const data = concreteMapData(coarse ? 512 : 1024);
  const texture = (bytes, colorSpace = THREE.NoColorSpace) => {
    const t = new THREE.DataTexture(bytes, data.size, data.size, THREE.RGBAFormat);
    t.name = 'ProductVis · fine procedural concrete';
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true; t.anisotropy = coarse ? 4 : 8;
    t.colorSpace = colorSpace; t.repeat.setScalar(40); t.needsUpdate = true;
    return t;
  };
  return { map: texture(data.color, THREE.SRGBColorSpace), normalMap: texture(data.normal), roughnessMap: texture(data.roughness) };
}

export function createHaloFloor(maps, uniforms) {
  const material = new THREE.MeshStandardMaterial({
    ...maps, color: '#323840', metalness: .12, roughness: .4,
    normalScale: new THREE.Vector2(.75, .75), dithering: true,
  });
  material.name = 'Amber Halo · honed concrete';
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'varying vec3 vHaloWorld;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvHaloWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = 'varying vec3 vHaloWorld; uniform vec3 haloColor; uniform float haloRadius, haloPower, haloWetness;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      float pool = smoothstep(.28, .7, texture2D(normalMap, vNormalMapUv).a);
      roughnessFactor = max(.075, roughnessFactor * (1.0 - pool * haloWetness * .65));`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float ringDistance = abs(length(vHaloWorld.xz) - haloRadius);
      float spill = exp(-ringDistance * 7.0) * .12 + exp(-ringDistance * 1.9) * .022;
      totalEmissiveRadiance += haloColor * spill * haloPower * (.8 + .2 * pool);`);
  };
  material.customProgramCacheKey = () => 'amber-halo-concrete-v1';
  return material;
}
