import * as THREE from 'three';
import { slugify, cleanErrorMessage } from '../utils/format.js';
import { computeExportFramePlan, scaleExportFramePlanForGpu } from './ExportFramePlan.js';

export function sceneBackgroundCss(scene) {
  if (scene.background?.isColor) return `#${scene.background.getHexString(THREE.SRGBColorSpace)}`;
  return '#808080';
}

export class FrameExporter {
  constructor({ engine, getProjectState, getModelName, getViewportRect, beforeRender, afterRender, onStatus } = {}) {
    this.engine = engine;
    this.getProjectState = getProjectState;
    this.getModelName = getModelName;
    this.getViewportRect = getViewportRect;
    this.beforeRender = beforeRender;
    this.afterRender = afterRender;
    this.onStatus = onStatus;
    this.exporting = false;
  }

  resolveDimensions(format) {
    const rect = this.getViewportRect();
    if (format === 'viewport') {
      const size = this.engine.getViewportExportSize(rect.width, rect.height);
      return { ...size, rect };
    }
    const [width, height] = String(format).split('x').map(Number);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new Error('Invalid export dimensions.');
    }
    return { width: Math.round(width), height: Math.round(height), rect };
  }

  async captureFrame(format) {
    if (this.exporting) throw new Error('An export is already in progress.');
    this.exporting = true;
    this.onStatus?.({ exporting: true });

    try {
      const { width, height, rect } = this.resolveDimensions(format);
      const project = this.getProjectState() || {};
      const framing = project.render?.exportFraming === 'fill' ? 'fill' : 'match';
      const basePlan = computeExportFramePlan({
        viewportWidth: rect.width,
        viewportHeight: rect.height,
        outputWidth: width,
        outputHeight: height,
        mode: framing,
      });
      const maxTextureSize = this.engine.renderer.capabilities.maxTextureSize || 4096;
      const plan = scaleExportFramePlanForGpu(basePlan, maxTextureSize);
      const exportCamera = this.engine.camera.clone();
      exportCamera.aspect = plan.viewportAspect;
      exportCamera.updateProjectionMatrix();

      await this.beforeRender?.();
      const frame = await this.engine.renderOffscreen(plan.renderWidth, plan.renderHeight, { camera: exportCamera });
      const renderCanvas = this.#pixelsToCanvas(frame.pixels, frame.width, frame.height);
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = plan.outputWidth;
      outputCanvas.height = plan.outputHeight;
      const context = outputCanvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('The browser could not prepare the export canvas.');
      const background = sceneBackgroundCss(this.engine.scene);
      context.fillStyle = background;
      context.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
      context.drawImage(
        renderCanvas,
        plan.source.x,
        plan.source.y,
        plan.source.width,
        plan.source.height,
        plan.destination.x,
        plan.destination.y,
        plan.destination.width,
        plan.destination.height,
      );

      return {
        canvas: outputCanvas,
        width: plan.outputWidth,
        height: plan.outputHeight,
        plan,
        framing,
        project,
        camera: exportCamera,
        background,
      };
    } finally {
      try {
        await this.afterRender?.();
      } catch (cleanupError) {
        console.error('Product VIS export cleanup failed:', cleanupError);
      }
      this.exporting = false;
      this.onStatus?.({ exporting: false });
    }
  }

  async exportImage(format) {
    try {
      const frame = await this.captureFrame(format);
      const blob = await this.canvasToBlob(frame.canvas, 'image/png');
      if (!blob) throw new Error('The browser could not create the PNG.');
      const presetName = frame.project.studio?.backdropPreset || frame.project.studio?.preset || 'custom';
      this.downloadBlob(blob, `${slugify(this.getModelName())}-${presetName}-${frame.width}x${frame.height}.png`);
      const framingMessage = frame.framing === 'fill'
        ? 'frame filled with a centered crop'
        : 'viewport framing preserved';
      const gpuMessage = frame.plan.scaledForGpu ? ' GPU-safe internal scaling was used.' : '';
      this.onStatus?.({ message: `PNG exported at ${frame.width} × ${frame.height}; ${framingMessage}.${gpuMessage}` });
      return { ...frame, blob };
    } catch (error) {
      console.error(error);
      this.onStatus?.({ error: cleanErrorMessage(error) });
      return null;
    }
  }

  downloadBlob(blob, filename) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1800);
  }

  canvasToBlob(canvas, type = 'image/png') {
    return new Promise((resolve) => canvas.toBlob(resolve, type, 1));
  }

  #pixelsToCanvas(pixels, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The browser could not prepare the rendered pixels.');
    const imageData = context.createImageData(width, height);
    const rowBytes = width * 4;
    for (let y = 0; y < height; y += 1) {
      const sourceStart = (height - 1 - y) * rowBytes;
      const destinationStart = y * rowBytes;
      imageData.data.set(pixels.subarray(sourceStart, sourceStart + rowBytes), destinationStart);
    }
    context.putImageData(imageData, 0, 0);
    return canvas;
  }
}
