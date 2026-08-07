import { queryAll } from './dom.js';
import { formatBytes, formatCompact, formatNumber, capitalize } from '../utils/format.js';

export class UIController {
  constructor(dom, actions = {}) {
    this.dom = dom;
    this.actions = actions;
    this.dragDepth = 0;
    this.toastTimer = null;
    this.introDismissed = false;
  }

  setActions(actions) {
    this.actions = actions;
  }

  bind() {
    window.addEventListener('resize', () => this.actions.resize?.(), { passive: true });
    window.addEventListener('keydown', (event) => this.#handleKeyboardShortcut(event));

    this.dom.fileInput.addEventListener('change', () => {
      const file = this.dom.fileInput.files?.[0];
      if (file) this.actions.importFile?.(file);
      this.dom.fileInput.value = '';
    });

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((type) => {
      window.addEventListener(type, (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    });

    window.addEventListener('dragenter', () => {
      this.dragDepth += 1;
      this.dom.dropOverlay.classList.add('is-visible');
      this.dom.dropOverlay.setAttribute('aria-hidden', 'false');
    });
    window.addEventListener('dragleave', () => {
      this.dragDepth = Math.max(0, this.dragDepth - 1);
      if (this.dragDepth === 0) this.hideDropOverlay();
    });
    window.addEventListener('drop', (event) => {
      this.dragDepth = 0;
      this.hideDropOverlay();
      const files = [...(event.dataTransfer?.files || [])];
      const file = files.find((candidate) => candidate.name.toLowerCase().endsWith('.glb'));
      if (!file) {
        this.showToast('Drop a self-contained .glb file.', true, '!');
        return;
      }
      this.actions.importFile?.(file);
    });

    queryAll('.scene-preset').forEach((button) => {
      button.addEventListener('click', () => this.actions.applyLookPreset?.(button.dataset.preset));
    });

    queryAll('.panel-tab').forEach((button) => {
      button.addEventListener('click', () => this.switchPanel(button.dataset.panel));
    });

    queryAll('.camera-preset, .camera-card').forEach((button) => {
      button.addEventListener('click', () => this.actions.setCameraPreset?.(button.dataset.camera));
    });

    queryAll('.segmented [data-material]').forEach((button) => {
      button.addEventListener('click', () => this.actions.setMaterialMode?.(button.dataset.material));
    });

    queryAll('.segmented [data-quality]').forEach((button) => {
      button.addEventListener('click', () => this.actions.setQuality?.(button.dataset.quality));
    });

    this.#bindRange(this.dom.exposureInput, this.dom.exposureOutput, (value) => this.actions.setExposure?.(value));
    this.#bindRange(this.dom.environmentInput, this.dom.environmentOutput, (value) => this.actions.setEnvironment?.(value));
    this.#bindRange(this.dom.keyInput, this.dom.keyOutput, (value) => this.actions.setKey?.(value));
    this.#bindRange(this.dom.rimInput, this.dom.rimOutput, (value) => this.actions.setRim?.(value));
    this.#bindRange(this.dom.bloomInput, this.dom.bloomOutput, (value) => this.actions.setBloom?.(value));

    this.dom.floorToggle.addEventListener('change', () => this.actions.setFloorEnabled?.(this.dom.floorToggle.checked));
    this.dom.shadowToggle.addEventListener('change', () => this.actions.setShadowsEnabled?.(this.dom.shadowToggle.checked));
    this.dom.postToggle.addEventListener('change', () => this.actions.setPostEnabled?.(this.dom.postToggle.checked));

    this.dom.scaleInput.addEventListener('input', () => {
      const value = Number(this.dom.scaleInput.value);
      this.dom.scaleOutput.value = `${value.toFixed(2)}×`;
      this.updateRangeProgress(this.dom.scaleInput);
      this.actions.setScale?.(value);
    });

    this.dom.offsetInput.addEventListener('input', () => {
      const value = Number(this.dom.offsetInput.value);
      this.dom.offsetOutput.value = value.toFixed(2);
      this.updateRangeProgress(this.dom.offsetInput);
      this.actions.setOffset?.(value);
    });

    queryAll('[data-rotate-axis]').forEach((button) => {
      button.addEventListener('click', () => this.actions.rotateObject?.(button.dataset.rotateAxis));
    });

    this.dom.centerButton.addEventListener('click', () => this.actions.centerObject?.());
    this.dom.groundButton.addEventListener('click', () => this.actions.groundObject?.());
    this.dom.resetTransformButton.addEventListener('click', () => this.actions.resetTransform?.());
    this.dom.resetButton.addEventListener('click', () => this.actions.resetAll?.());
    this.dom.fitButton.addEventListener('click', () => this.actions.fitModel?.());
    this.dom.objectFitButton.addEventListener('click', () => this.actions.fitModel?.());
    this.dom.cameraResetButton.addEventListener('click', () => this.actions.setCameraPreset?.('hero'));

    this.dom.focalInput.addEventListener('input', () => {
      const focal = Number(this.dom.focalInput.value);
      this.dom.focalOutput.value = `${focal} mm`;
      this.updateRangeProgress(this.dom.focalInput);
      this.actions.setFocalLength?.(focal);
    });
    this.dom.focalInput.addEventListener('change', () => this.actions.fitModel?.());

    this.dom.dampingInput.addEventListener('input', () => {
      const value = Number(this.dom.dampingInput.value);
      this.dom.dampingOutput.value = value.toFixed(2);
      this.updateRangeProgress(this.dom.dampingInput);
      this.actions.setDamping?.(value);
    });

    this.dom.autoRotateToggle.addEventListener('change', () => this.actions.setAutoRotate?.(this.dom.autoRotateToggle.checked));
    this.dom.horizonToggle.addEventListener('change', () => this.actions.setHorizonLocked?.(this.dom.horizonToggle.checked));

    this.dom.animationSelect.addEventListener('change', () => this.actions.selectAnimation?.(Number(this.dom.animationSelect.value)));
    this.dom.animationPlayButton.addEventListener('click', () => this.actions.toggleAnimationPlayback?.());
    this.dom.animationLoopToggle.addEventListener('change', () => this.actions.setAnimationLoop?.(this.dom.animationLoopToggle.checked));
    this.dom.animationSpeedInput.addEventListener('input', () => {
      const speed = Number(this.dom.animationSpeedInput.value);
      this.dom.animationSpeedOutput.value = `${speed.toFixed(2)}×`;
      this.updateRangeProgress(this.dom.animationSpeedInput);
      this.actions.setAnimationSpeed?.(speed);
    });

    this.dom.turntableToggle.addEventListener('change', () => this.actions.setTurntable?.(this.dom.turntableToggle.checked));
    this.dom.turntableSpeedInput.addEventListener('input', () => {
      const speed = Number(this.dom.turntableSpeedInput.value);
      this.dom.turntableSpeedOutput.value = `${speed.toFixed(2)}×`;
      this.updateRangeProgress(this.dom.turntableSpeedInput);
      this.actions.setTurntableSpeed?.(speed);
    });

    this.dom.dismissIntro.addEventListener('click', () => this.dismissIntro());
    this.dom.introHint.addEventListener('pointerdown', (event) => event.stopPropagation());

    this.dom.panelToggle.addEventListener('click', () => this.toggleMobilePanel());
    this.dom.panelClose.addEventListener('click', () => this.closeMobilePanel());

    this.dom.helpButton.addEventListener('click', () => {
      if (typeof this.dom.helpDialog.showModal === 'function') this.dom.helpDialog.showModal();
      else this.dom.helpDialog.setAttribute('open', '');
    });

    this.dom.exportButton.addEventListener('click', (event) => {
      event.stopPropagation();
      const open = this.dom.exportButton.getAttribute('aria-expanded') === 'true';
      this.toggleExportMenu(!open);
    });

    queryAll('#exportMenu [data-export]').forEach((button) => {
      button.addEventListener('click', () => {
        this.toggleExportMenu(false);
        this.actions.exportImage?.(button.dataset.export);
      });
    });

    document.addEventListener('pointerdown', (event) => {
      if (!event.target.closest('.export-wrap')) this.toggleExportMenu(false);
    });

    this.dom.fullscreenButton.addEventListener('click', () => this.actions.toggleFullscreen?.());
    document.addEventListener('fullscreenchange', () => this.updateFullscreenButton());

    this.initRangeVisuals();
  }

  #bindRange(input, output, callback) {
    input.addEventListener('input', () => {
      const value = Number(input.value);
      this.updateRangeProgress(input);
      output.value = value.toFixed(2);
      callback(value);
    });
    output.value = Number(input.value).toFixed(2);
  }

  initRangeVisuals() {
    queryAll('input[type="range"]').forEach((input) => this.updateRangeProgress(input));
  }

  updateRangeProgress(input) {
    const min = Number(input.min || 0);
    const max = Number(input.max || 100);
    const value = Number(input.value);
    const percent = ((value - min) / (max - min)) * 100;
    input.style.setProperty('--range-progress', `${Math.max(0, Math.min(100, percent))}%`);
  }

  shouldStartBalanced() {
    const compact = window.matchMedia('(max-width: 720px)').matches;
    const lowMemory = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4;
    return compact || lowMemory;
  }

  hideDropOverlay() {
    this.dom.dropOverlay.classList.remove('is-visible');
    this.dom.dropOverlay.setAttribute('aria-hidden', 'true');
  }

  setModelStatus(status, name, meta) {
    this.dom.modelStatus?.classList.remove('is-loading', 'is-error');
    if (status === 'loading') this.dom.modelStatus?.classList.add('is-loading');
    if (status === 'error') this.dom.modelStatus?.classList.add('is-error');
    this.dom.modelName.textContent = name;
    this.dom.modelMeta.textContent = meta;
  }

  updateModelStats(stats, { procedural = false, fileSize = null, animations = 0 } = {}) {
    this.dom.trianglesStat.textContent = formatNumber(stats.triangles);
    this.dom.verticesStat.textContent = formatNumber(stats.vertices);
    this.dom.materialsStat.textContent = String(stats.materials);
    this.dom.texturesStat.textContent = String(stats.textures);
    this.dom.animationsStat.textContent = String(animations);
    this.dom.fileSizeStat.textContent = procedural ? 'Procedural' : formatBytes(fileSize);
    this.dom.statsBadge.textContent = `${formatCompact(stats.triangles)} TRIS · ${stats.materials} MATS`;
  }

  setLookPresetActive(name) {
    queryAll('.scene-preset').forEach((button) => {
      const active = button.dataset.preset === name;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  clearLookPresetActive() {
    queryAll('.scene-preset').forEach((button) => {
      button.classList.remove('is-active');
      button.setAttribute('aria-pressed', 'false');
    });
  }

  setLookInputs(preset) {
    this.setInputValue(this.dom.exposureInput, this.dom.exposureOutput, preset.exposure, 2);
    this.setInputValue(this.dom.environmentInput, this.dom.environmentOutput, preset.environment, 2);
    this.setInputValue(this.dom.keyInput, this.dom.keyOutput, preset.key, 2);
    this.setInputValue(this.dom.rimInput, this.dom.rimOutput, preset.rim, 2);
    this.setInputValue(this.dom.bloomInput, this.dom.bloomOutput, preset.bloom, 2);
  }

  setInputValue(input, output, value, decimals = 2) {
    input.value = String(value);
    output.value = Number(value).toFixed(decimals);
    this.updateRangeProgress(input);
  }

  setMaterialMode(mode) {
    queryAll('[data-material]').forEach((button) => button.classList.toggle('is-active', button.dataset.material === mode));
    this.dom.materialModeValue.textContent = mode.toUpperCase();
  }

  setQuality(mode) {
    queryAll('[data-quality]').forEach((button) => button.classList.toggle('is-active', button.dataset.quality === mode));
    this.dom.qualityValue.textContent = mode.toUpperCase();
    this.dom.renderModeBadge.innerHTML = `<i></i> ${mode.toUpperCase()}`;
  }

  setCameraButtons(name) {
    queryAll('.camera-preset, .camera-card').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.camera === name);
    });
  }

  updateTransformUI(scale, offset) {
    this.dom.scaleInput.value = String(scale);
    this.dom.scaleOutput.value = `${scale.toFixed(2)}×`;
    this.dom.offsetInput.value = String(offset);
    this.dom.offsetOutput.value = offset.toFixed(2);
    this.updateRangeProgress(this.dom.scaleInput);
    this.updateRangeProgress(this.dom.offsetInput);
  }

  updateMotionState({ clips, clipIndex, playing, loop, speed, turntable, turntableSpeed }) {
    const hasClips = clips.length > 0;
    const expectedOptionCount = hasClips ? clips.length : 1;
    const optionsChanged = this.dom.animationSelect.options.length !== expectedOptionCount
      || (hasClips && this.dom.animationSelect.options[0]?.textContent !== (clips[0].name || 'Clip 1'))
      || (!hasClips && this.dom.animationSelect.options[0]?.textContent !== 'No animations in this model');

    if (optionsChanged) {
      this.dom.animationSelect.innerHTML = '';
      if (!hasClips) {
        this.dom.animationSelect.innerHTML = '<option>No animations in this model</option>';
      } else {
        clips.forEach((clip, index) => {
          const option = document.createElement('option');
          option.value = String(index);
          option.textContent = clip.name || `Clip ${index + 1}`;
          this.dom.animationSelect.appendChild(option);
        });
      }
    }

    this.dom.animationSelect.disabled = !hasClips;
    this.dom.animationPlayButton.disabled = !hasClips;
    this.dom.animationSpeedInput.disabled = !hasClips;
    this.dom.animationSpeedControl.classList.toggle('is-disabled', !hasClips);
    this.dom.animationCount.textContent = hasClips
      ? `${clips.length} ${clips.length === 1 ? 'CLIP' : 'CLIPS'}`
      : '0 CLIPS';
    this.dom.animationsStat.textContent = String(clips.length);

    if (hasClips) this.dom.animationSelect.value = String(clipIndex);
    this.dom.animationPlayButton.classList.toggle('is-playing', playing);
    this.dom.animationPlayButton.querySelector('span').textContent = playing ? 'Pause' : 'Play';
    this.dom.animationLoopToggle.checked = loop;
    this.dom.animationSpeedInput.value = String(speed);
    this.dom.animationSpeedOutput.value = `${speed.toFixed(2)}×`;
    this.dom.turntableToggle.checked = turntable;
    this.dom.turntableSpeedInput.value = String(turntableSpeed);
    this.dom.turntableSpeedOutput.value = `${turntableSpeed.toFixed(2)}×`;
    this.updateRangeProgress(this.dom.animationSpeedInput);
    this.updateRangeProgress(this.dom.turntableSpeedInput);
  }

  switchPanel(name) {
    const titles = { look: 'Look', object: 'Object', camera: 'Camera', motion: 'Motion' };
    queryAll('.panel-tab').forEach((button) => {
      const active = button.dataset.panel === name;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    queryAll('[data-panel-page]').forEach((page) => {
      const active = page.dataset.panelPage === name;
      page.classList.toggle('is-active', active);
      page.hidden = !active;
    });
    this.dom.panelTitle.textContent = titles[name] || capitalize(name);
  }

  toggleMobilePanel() {
    const opening = !this.dom.controlPanel.classList.contains('is-open');
    this.dom.controlPanel.classList.toggle('is-open', opening);
    this.dom.panelToggle.setAttribute('aria-expanded', String(opening));
    document.body.classList.toggle('panel-open', opening);
  }

  closeMobilePanel() {
    this.dom.controlPanel.classList.remove('is-open');
    this.dom.panelToggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('panel-open');
  }

  toggleExportMenu(open) {
    this.dom.exportButton.setAttribute('aria-expanded', String(open));
    this.dom.exportMenu.hidden = !open;
  }

  setExporting(exporting) {
    this.dom.exportButton.disabled = exporting;
  }

  setViewportExportSize(width, height) {
    this.dom.viewportExportSize.textContent = `${width} × ${height}`;
  }

  handleResponsivePanel() {
    if (window.innerWidth > 720) {
      this.dom.controlPanel.classList.remove('is-open');
      document.body.classList.remove('panel-open');
      this.dom.panelToggle.setAttribute('aria-expanded', 'true');
    } else if (!this.dom.controlPanel.classList.contains('is-open')) {
      this.dom.panelToggle.setAttribute('aria-expanded', 'false');
    }
  }

  dismissIntro() {
    if (this.introDismissed) return;
    this.introDismissed = true;
    this.dom.introHint.classList.add('is-dismissed');
  }

  updateFullscreenButton() {
    this.dom.fullscreenButton.classList.toggle('is-active', Boolean(document.fullscreenElement));
    setTimeout(() => this.actions.resize?.(), 80);
  }

  showLoading(show, label = 'Preparing model', percent = 8) {
    this.dom.loadingOverlay.hidden = !show;
    if (show) {
      this.dom.loadingLabel.textContent = label;
      this.dom.loadingProgress.style.width = `${Math.max(4, Math.min(100, percent))}%`;
    }
  }

  showToast(message, isError = false, icon = '✓') {
    clearTimeout(this.toastTimer);
    this.dom.toast.hidden = false;
    this.dom.toastMessage.textContent = message;
    this.dom.toastIcon.textContent = icon;
    this.dom.toast.classList.toggle('is-error', isError);
    requestAnimationFrame(() => this.dom.toast.classList.add('is-visible'));
    this.toastTimer = setTimeout(() => {
      this.dom.toast.classList.remove('is-visible');
      setTimeout(() => { this.dom.toast.hidden = true; }, 280);
    }, isError ? 5200 : 2800);
  }

  showFatalError(error) {
    console.error('Product VIS failed to initialize:', error);
    const message = document.createElement('div');
    message.style.cssText = 'position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:28px;background:#08090a;color:#f4f4f0;font:14px/1.5 Inter,system-ui,sans-serif;text-align:center;';
    message.innerHTML = '<div style="max-width:520px"><div style="color:#ff7950;font-size:10px;font-weight:800;letter-spacing:.16em;margin-bottom:18px">PRODUCT VIS / RENDERER ERROR</div><h1 style="margin:0 0 14px;font-size:32px;line-height:1;font-weight:520;letter-spacing:-.04em">WebGL could not start.</h1><p style="margin:0;color:rgba(255,255,255,.55)">Use a current Chrome, Edge, Safari or Firefox build with hardware acceleration enabled, then reload the page.</p></div>';
    document.body.appendChild(message);
  }

  #handleKeyboardShortcut(event) {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return;
    if (this.dom.helpDialog.open) return;

    const key = event.key.toLowerCase();
    if (key === 'i') this.dom.fileInput.click();
    if (key === 'f') this.actions.fitModel?.();
    if (key === 'r') this.actions.resetAll?.();
    if (key === ' ' && this.actions.hasAnimations?.()) {
      event.preventDefault();
      this.actions.toggleAnimationPlayback?.();
    }

    const cameraKeys = { '1': 'hero', '2': 'front', '3': 'side', '4': 'top', '5': 'detail' };
    if (cameraKeys[event.key]) this.actions.setCameraPreset?.(cameraKeys[event.key]);
  }
}
