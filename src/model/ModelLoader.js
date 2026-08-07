import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { DECODER_BASE_PATH } from '../config/runtime.js';

export class ModelLoader {
  constructor(renderer, {
    dracoPath = `${DECODER_BASE_PATH}/draco/`,
    basisPath = `${DECODER_BASE_PATH}/basis/`,
  } = {}) {
    this.renderer = renderer;
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath(dracoPath);

    this.ktx2Loader = new KTX2Loader();
    this.ktx2Loader.setTranscoderPath(basisPath);
    this.ktx2Loader.detectSupport(renderer);

    this.loader = new GLTFLoader();
    this.loader.setDRACOLoader(this.dracoLoader);
    this.loader.setKTX2Loader(this.ktx2Loader);
    this.loader.setMeshoptDecoder(MeshoptDecoder);
  }

  loadFile(file, { onProgress } = {}) {
    const objectUrl = URL.createObjectURL(file);
    return new Promise((resolve, reject) => {
      this.loader.load(
        objectUrl,
        (gltf) => {
          URL.revokeObjectURL(objectUrl);
          resolve(gltf);
        },
        (event) => onProgress?.(event),
        (error) => {
          URL.revokeObjectURL(objectUrl);
          reject(error);
        },
      );
    });
  }

  dispose() {
    this.dracoLoader.dispose();
    this.ktx2Loader.dispose();
  }
}
