import { defineConfig } from 'vite';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { THREE_VERSION } from './src/config/runtime.js';

const projectRoot = dirname(fileURLToPath(import.meta.url));

function copyDirectory(source, destination) {
  if (!existsSync(source)) {
    throw new Error(`[product-vis] Required decoder source not found: ${source}`);
  }
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(destination, { recursive: true });
  cpSync(source, destination, { recursive: true });
}

function localThreeDecoders() {
  return {
    name: 'product-vis-local-three-decoders',
    configResolved() {
      const threeLibs = resolve(projectRoot, 'node_modules/three/examples/jsm/libs');
      copyDirectory(resolve(threeLibs, 'draco'), resolve(projectRoot, `public/decoders/three-${THREE_VERSION}/draco`));
      copyDirectory(resolve(threeLibs, 'basis'), resolve(projectRoot, `public/decoders/three-${THREE_VERSION}/basis`));
    },
  };
}

export default defineConfig({
  plugins: [localThreeDecoders()],
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
  },
  preview: {
    host: '127.0.0.1',
  },
});
