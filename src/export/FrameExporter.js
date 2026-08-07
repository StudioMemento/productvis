import * as THREE from 'three';
import { slugify, cleanErrorMessage } from '../utils/format.js';

export class FrameExporter {
  constructor({ engine, getProjectState, getModelName, getViewportRect, onResize, onStatus } = {}) {
    this.engine = engine;
    this.getProjectState = getProjectState;
    this.getModelName = getModelName;
    this.getViewportRect = getViewportRect;
    this.onResize = onResize;
    this.onStatus = onStatus;
    this.exporting = false;
  }

  async exportImage(format) {
    if (this.exporting) return;
    this.exporting = true;
    this.onStatus?.({ exporting: true });

    const rect = this.getViewportRect();
    let width;
    let height;
    if (format === 'viewport') {
      const size = this.engine.getViewportExportSize(rect.width, rect.height);
      ({ width, height } = size);
    } else {
      [width, height] = format.split('x').map(Number);
    }

    const { renderer, composer, camera, canvas } = this.engine;
    const oldPixelRatio = renderer.getPixelRatio();
    const oldAspect = camera.aspect;
    const oldSize = renderer.getSize(new THREE.Vector2());

    try {
      renderer.setPixelRatio(1);
      composer.setPixelRatio(1);
      renderer.setSize(width, height, false);
      composer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      this.engine.render();

      const blob = await this.#canvasToBlob(canvas, 'image/png');
      if (!blob) throw new Error('The browser could not create the PNG.');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const presetName = this.getProjectState()?.studio?.preset || 'custom';
      link.download = `${slugify(this.getModelName())}-${presetName}-${width}x${height}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1500);
      this.onStatus?.({ message: `PNG exported at ${width} × ${height}.` });
    } catch (error) {
      console.error(error);
      this.onStatus?.({ error: cleanErrorMessage(error) });
    } finally {
      renderer.setPixelRatio(oldPixelRatio);
      composer.setPixelRatio(oldPixelRatio);
      renderer.setSize(oldSize.x, oldSize.y, false);
      composer.setSize(oldSize.x, oldSize.y);
      camera.aspect = oldAspect;
      camera.updateProjectionMatrix();
      this.onResize?.();
      this.exporting = false;
      this.onStatus?.({ exporting: false });
    }
  }

  #canvasToBlob(canvas, type) {
    return new Promise((resolve) => canvas.toBlob(resolve, type, 1));
  }
}
