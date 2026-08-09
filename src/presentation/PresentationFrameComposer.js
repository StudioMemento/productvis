import * as THREE from 'three';
import { slugify, cleanErrorMessage } from '../utils/format.js';
import { layoutInfographicCards, createInfographicConnector } from '../configurator/InfographicLayout.js';
import { sanitizeExperienceState } from './ExperienceGrammar.js';
import { mapNdcToExport, presentationSafeArea, presentationCardSize } from './PresentationFrameLayout.js';

function hexToRgba(hex, alpha = 1) {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex.slice(1) : 'ff7950';
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function wrapText(context, text, maxWidth, maxLines = 4) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (words.length && lines.length === maxLines) {
    const joined = lines.join(' ');
    if (joined.length < String(text).length) lines[lines.length - 1] = `${lines.at(-1).replace(/[.,;:!?]?$/, '')}…`;
  }
  return lines;
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width * 0.5, height * 0.5));
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

async function loadImage(dataUrl) {
  if (!dataUrl || typeof Image === 'undefined') return null;
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
}

export class PresentationFrameComposer {
  constructor({
    frameExporter,
    getExperience,
    getModelName,
    getInfographicState,
    getAnchorMarkers,
    getStoryState,
    onStatus,
  } = {}) {
    this.frameExporter = frameExporter;
    this.getExperience = getExperience;
    this.getModelName = getModelName;
    this.getInfographicState = getInfographicState;
    this.getAnchorMarkers = getAnchorMarkers;
    this.getStoryState = getStoryState;
    this.onStatus = onStatus;
  }

  async exportImage(format) {
    try {
      const frame = await this.frameExporter.captureFrame(format);
      await this.compose(frame);
      const blob = await this.frameExporter.canvasToBlob(frame.canvas, 'image/png');
      if (!blob) throw new Error('The browser could not create the branded PNG.');
      const experience = sanitizeExperienceState(this.getExperience?.());
      const filename = `${slugify(experience.title || this.getModelName?.() || 'product-experience')}-presentation-${frame.width}x${frame.height}.png`;
      this.frameExporter.downloadBlob(blob, filename);
      this.onStatus?.({ message: `Branded presentation PNG exported at ${frame.width} × ${frame.height}.` });
      return { ...frame, blob };
    } catch (error) {
      console.error(error);
      this.onStatus?.({ error: cleanErrorMessage(error) });
      return null;
    }
  }

  async compose(frame) {
    const experience = sanitizeExperienceState(this.getExperience?.());
    const context = frame.canvas.getContext('2d');
    if (!context) throw new Error('The browser could not prepare the presentation graphics.');
    const safe = presentationSafeArea(frame.width, frame.height);
    const themeIsLight = experience.theme === 'light';
    const foreground = themeIsLight ? '#101113' : '#ffffff';
    const muted = themeIsLight ? 'rgba(16,17,19,.58)' : 'rgba(255,255,255,.62)';
    const panel = themeIsLight ? 'rgba(255,255,255,.84)' : 'rgba(7,8,9,.78)';

    if (experience.export.brandOverlay) {
      const gradient = context.createLinearGradient(0, 0, 0, frame.height * 0.24);
      gradient.addColorStop(0, themeIsLight ? 'rgba(255,255,255,.76)' : 'rgba(0,0,0,.68)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, frame.width, frame.height * 0.26);

      const logo = await loadImage(experience.logoDataUrl);
      let copyX = safe.left;
      if (logo) {
        const logoHeight = Math.max(34, Math.min(74, frame.height * 0.055));
        const logoWidth = Math.min(frame.width * 0.24, logo.width * (logoHeight / Math.max(1, logo.height)));
        context.drawImage(logo, safe.left, safe.top, logoWidth, logoHeight);
        copyX += logoWidth + Math.max(18, logoHeight * 0.34);
      }
      context.fillStyle = experience.accent;
      context.font = `700 ${Math.max(12, Math.round(frame.height * 0.012))}px Inter, system-ui, sans-serif`;
      context.textBaseline = 'top';
      context.fillText(experience.eyebrow.toUpperCase(), copyX, safe.top + 2);
      context.fillStyle = foreground;
      context.font = `600 ${Math.max(24, Math.round(frame.height * 0.032))}px Inter, system-ui, sans-serif`;
      context.fillText(experience.title, copyX, safe.top + Math.max(22, frame.height * 0.024));
      context.fillStyle = muted;
      context.font = `400 ${Math.max(13, Math.round(frame.height * 0.014))}px Inter, system-ui, sans-serif`;
      const subtitleLines = wrapText(context, experience.subtitle, Math.min(frame.width * 0.52, 760), 2);
      subtitleLines.forEach((line, index) => context.fillText(line, copyX, safe.top + Math.max(60, frame.height * 0.064) + index * Math.max(18, frame.height * 0.019)));
    }

    if (experience.export.infographics) {
      this.#drawInfographics(context, frame, experience, { foreground, muted, panel });
    }

    if (experience.export.storyCaption) {
      const story = this.getStoryState?.() || {};
      if (story.storyName || story.stepName) {
        const captionWidth = Math.min(frame.width * 0.56, 760);
        const captionHeight = Math.max(70, frame.height * 0.082);
        const x = safe.left;
        const y = safe.bottom - captionHeight;
        roundedRect(context, x, y, captionWidth, captionHeight, Math.max(14, captionHeight * 0.22));
        context.fillStyle = panel;
        context.fill();
        context.strokeStyle = themeIsLight ? 'rgba(0,0,0,.1)' : 'rgba(255,255,255,.12)';
        context.lineWidth = Math.max(1, frame.width / 1600);
        context.stroke();
        context.fillStyle = experience.accent;
        context.fillRect(x, y, Math.max(4, frame.width * 0.004), captionHeight);
        context.fillStyle = muted;
        context.font = `700 ${Math.max(11, Math.round(frame.height * 0.011))}px Inter, system-ui, sans-serif`;
        context.fillText(String(story.storyName || 'PRODUCT STORY').toUpperCase(), x + 24, y + 17);
        context.fillStyle = foreground;
        context.font = `600 ${Math.max(18, Math.round(frame.height * 0.021))}px Inter, system-ui, sans-serif`;
        context.fillText(story.stepName || experience.title, x + 24, y + 38);
      }
    }
    return frame.canvas;
  }

  #drawInfographics(context, frame, experience, palette) {
    const state = this.getInfographicState?.() || {};
    const display = experience.showInfographics
      ? (experience.infographicMode === 'inherit' ? state.infographicDisplay : experience.infographicMode)
      : 'off';
    if (display === 'off') return;
    const records = Array.isArray(state.infographics) ? state.infographics : [];
    const selectedId = state.selectedInfographicId || null;
    const markers = Array.isArray(this.getAnchorMarkers?.()) ? this.getAnchorMarkers() : [];
    const markerMap = new Map(markers.map((marker) => [marker.id, marker]));
    const vector = new THREE.Vector3();
    const size = presentationCardSize(frame.width, frame.height);
    const layoutInput = [];

    records
      .filter((record) => record.visible !== false)
      .filter((record) => display === 'all' || record.id === selectedId)
      .forEach((record) => {
        const marker = markerMap.get(record.anchorId);
        if (!marker || marker.resolved === false || !Array.isArray(marker.worldPosition)) return;
        vector.fromArray(marker.worldPosition).project(frame.camera);
        const mapped = mapNdcToExport(vector, frame.plan);
        if (!mapped?.visible) return;
        const side = record.side === 'left' || record.side === 'right'
          ? record.side
          : mapped.x < frame.width * 0.5 ? 'right' : 'left';
        layoutInput.push({
          record,
          side,
          anchorX: mapped.x,
          anchorY: mapped.y,
          cardWidth: size.width,
          cardHeight: size.minHeight,
          idealY: mapped.y - size.minHeight * 0.5,
        });
      });

    const layout = layoutInfographicCards(layoutInput, { width: frame.width, height: frame.height });
    layout.forEach((item) => {
      const record = item.record;
      context.save();
      context.strokeStyle = record.accent || experience.accent;
      context.lineWidth = Math.max(2, frame.width / 960);
      const path = new Path2D(createInfographicConnector(item));
      context.stroke(path);
      context.fillStyle = record.accent || experience.accent;
      context.beginPath();
      context.arc(item.anchorX, item.anchorY, Math.max(4, frame.width / 480), 0, Math.PI * 2);
      context.fill();

      roundedRect(context, item.cardX, item.cardY, item.cardWidth, item.cardHeight, size.radius);
      context.fillStyle = palette.panel;
      context.fill();
      context.strokeStyle = hexToRgba(record.accent || experience.accent, 0.5);
      context.lineWidth = Math.max(1, frame.width / 1600);
      context.stroke();
      context.fillStyle = record.accent || experience.accent;
      context.font = `700 ${Math.max(10, Math.round(frame.height * 0.01))}px Inter, system-ui, sans-serif`;
      context.textBaseline = 'top';
      context.fillText(String(record.eyebrow || 'FEATURE').toUpperCase(), item.cardX + 20, item.cardY + 18);
      context.fillStyle = palette.foreground;
      context.font = `600 ${Math.max(17, Math.round(frame.height * 0.018))}px Inter, system-ui, sans-serif`;
      context.fillText(record.title || 'Infographic', item.cardX + 20, item.cardY + 39);
      context.fillStyle = palette.muted;
      context.font = `400 ${Math.max(11, Math.round(frame.height * 0.0115))}px Inter, system-ui, sans-serif`;
      const lines = wrapText(context, record.body || '', item.cardWidth - 40, 3);
      lines.forEach((line, index) => context.fillText(line, item.cardX + 20, item.cardY + 67 + index * Math.max(15, frame.height * 0.014)));
      context.restore();
    });
  }
}
