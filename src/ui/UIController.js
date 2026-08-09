import { queryAll } from './dom.js';
import { formatBytes, formatCompact, formatNumber, capitalize } from '../utils/format.js';

function radiansToDegrees(value) {
  return Number(value) * (180 / Math.PI);
}

function degreesToRadians(value) {
  return Number(value) * (Math.PI / 180);
}

export class UIController {
  constructor(dom, actions = {}) {
    this.dom = dom;
    this.actions = actions;
    this.dragDepth = 0;
    this.toastTimer = null;
    this.introDismissed = false;
    this.materialListSignature = '';
    this.structureReport = null;
    this.structureQuery = '';
    this.variantReport = null;
    this.selectedVariantGroupId = null;
    this.infographicReport = null;
    this.selectedInfographicId = null;
    this.presentationReport = null;
    this.storyReport = null;
    this.selectedChapterId = null;
    this.selectedStoryId = null;
    this.selectedStoryStepId = null;
    this.experienceState = null;
    this.experienceStories = [];
    this.syncingExperience = false;
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

    this.dom.projectFileInput.addEventListener('change', () => {
      const file = this.dom.projectFileInput.files?.[0];
      if (file) this.actions.openProject?.(file);
      this.dom.projectFileInput.value = '';
    });

    this.dom.experienceFileInput.addEventListener('change', () => {
      const file = this.dom.experienceFileInput.files?.[0];
      if (file) this.actions.openExperience?.(file);
      this.dom.experienceFileInput.value = '';
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
      const experienceFile = files.find((candidate) => candidate.name.toLowerCase().endsWith('.productvis-show'));
      if (experienceFile) {
        this.actions.openExperience?.(experienceFile);
        return;
      }
      const projectFile = files.find((candidate) => candidate.name.toLowerCase().endsWith('.productvis'));
      if (projectFile) {
        this.actions.openProject?.(projectFile);
        return;
      }
      const glbFile = files.find((candidate) => candidate.name.toLowerCase().endsWith('.glb'));
      if (!glbFile) {
        this.showToast('Drop a self-contained .glb, .productvis or .productvis-show file.', true, '!');
        return;
      }
      this.actions.importFile?.(glbFile);
    });

    queryAll('[data-backdrop]').forEach((button) => {
      button.addEventListener('click', () => this.actions.applyBackdropPreset?.(button.dataset.backdrop));
    });

    queryAll('[data-lighting]').forEach((button) => {
      button.addEventListener('click', () => this.actions.applyLightingPreset?.(button.dataset.lighting));
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

    this.dom.backdropToneInput.addEventListener('input', () => {
      const value = Number(this.dom.backdropToneInput.value);
      this.setBackdropToneInput(value);
      this.actions.setBackdropTone?.(value);
    });

    this.#bindRange(this.dom.exposureInput, this.dom.exposureOutput, (value) => this.actions.setExposure?.(value));
    this.#bindRange(this.dom.environmentInput, this.dom.environmentOutput, (value) => this.actions.setEnvironment?.(value));
    this.dom.environmentRotationInput.addEventListener('input', () => {
      const degrees = Number(this.dom.environmentRotationInput.value);
      this.dom.environmentRotationOutput.value = `${Math.round(degrees)}°`;
      this.updateRangeProgress(this.dom.environmentRotationInput);
      this.actions.setEnvironmentRotation?.(degreesToRadians(degrees));
    });
    this.#bindRange(this.dom.keyInput, this.dom.keyOutput, (value) => this.actions.setKey?.(value));
    this.#bindRange(this.dom.fillInput, this.dom.fillOutput, (value) => this.actions.setFill?.(value));
    this.#bindRange(this.dom.rimInput, this.dom.rimOutput, (value) => this.actions.setRim?.(value));
    this.#bindRange(this.dom.bloomInput, this.dom.bloomOutput, (value) => this.actions.setBloom?.(value));
    this.#bindRange(this.dom.groundOffsetInput, this.dom.groundOffsetOutput, (value) => this.actions.setGroundOffset?.(value));
    this.#bindRange(this.dom.shadowOpacityInput, this.dom.shadowOpacityOutput, (value) => this.actions.setShadowOpacity?.(value));
    this.#bindRange(this.dom.shadowSoftnessInput, this.dom.shadowSoftnessOutput, (value) => this.actions.setShadowSoftness?.(value));

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
    this.dom.resetLookGroupButton.addEventListener('click', () => this.actions.resetLookGroup?.());
    this.dom.resetObjectGroupButton.addEventListener('click', () => this.actions.resetObjectGroup?.());
    this.dom.resetCameraGroupButton.addEventListener('click', () => this.actions.resetCameraGroup?.());
    this.dom.resetMotionGroupButton.addEventListener('click', () => this.actions.resetMotionGroup?.());
    this.dom.resetStructureGroupButton.addEventListener('click', () => this.actions.resetStructureGroup?.());
    this.dom.resetVariantGroupButton.addEventListener('click', () => this.actions.resetVariantGroup?.());
    this.dom.resetInfographicGroupButton.addEventListener('click', () => this.actions.resetInfographicGroup?.());
    this.dom.resetHealthGroupButton.addEventListener('click', () => this.actions.resetHealthGroup?.());
    this.dom.resetPublishGroupButton.addEventListener('click', () => this.actions.resetPublishGroup?.());
    this.dom.fitButton.addEventListener('click', () => this.actions.fitModel?.());
    this.dom.objectFitButton.addEventListener('click', () => this.actions.fitModel?.());
    this.dom.cameraResetButton.addEventListener('click', () => this.actions.setCameraPreset?.('hero'));

    this.dom.focalInput.addEventListener('input', () => {
      const focal = Number(this.dom.focalInput.value);
      this.dom.focalOutput.value = `${focal} mm`;
      this.updateRangeProgress(this.dom.focalInput);
      this.actions.setFocalLength?.(focal);
    });

    ['x', 'y', 'z'].forEach((axis) => {
      const input = this.dom[`target${axis.toUpperCase()}Input`];
      const output = this.dom[`target${axis.toUpperCase()}Output`];
      input.addEventListener('input', () => {
        const value = Number(input.value);
        output.value = value.toFixed(2);
        this.updateRangeProgress(input);
        this.actions.setCameraTarget?.(axis, value);
      });
    });

    this.dom.dampingInput.addEventListener('input', () => {
      const value = Number(this.dom.dampingInput.value);
      this.dom.dampingOutput.value = value.toFixed(2);
      this.updateRangeProgress(this.dom.dampingInput);
      this.actions.setDamping?.(value);
    });

    this.dom.autoRotateToggle.addEventListener('change', () => this.actions.setAutoRotate?.(this.dom.autoRotateToggle.checked));
    this.dom.horizonToggle.addEventListener('change', () => this.actions.setHorizonLocked?.(this.dom.horizonToggle.checked));
    this.dom.inspectToggle.addEventListener('change', () => this.actions.setInspectMode?.(this.dom.inspectToggle.checked));
    this.dom.backfaceRepairToggle.addEventListener('change', () => this.actions.setBackfaceRepair?.(this.dom.backfaceRepairToggle.checked));

    this.dom.autoQualityToggle.addEventListener('change', () => this.actions.setAutoQuality?.(this.dom.autoQualityToggle.checked));
    this.dom.pauseWhenHiddenToggle.addEventListener('change', () => this.actions.setPauseWhenHidden?.(this.dom.pauseWhenHiddenToggle.checked));
    this.dom.recoveryEnabledToggle.addEventListener('change', () => this.actions.setRecoveryEnabled?.(this.dom.recoveryEnabledToggle.checked));
    this.dom.saveRecoveryButton.addEventListener('click', () => this.actions.saveRecoveryNow?.());
    this.dom.clearRecoveryButton.addEventListener('click', () => this.actions.clearRecoveryDraft?.());
    this.dom.downloadSupportReportButton.addEventListener('click', () => this.actions.downloadSupportReport?.());
    this.dom.restoreRecoveryButton.addEventListener('click', () => this.actions.restoreRecoveryDraft?.());
    this.dom.dismissRecoveryButton.addEventListener('click', () => this.actions.dismissRecoveryDraft?.());

    this.dom.structureSearchInput.addEventListener('input', () => {
      this.structureQuery = this.dom.structureSearchInput.value.trim().toLowerCase();
      this.#renderStructureParts();
    });
    this.dom.structurePartList.addEventListener('click', (event) => {
      const visibility = event.target.closest('[data-toggle-part-visibility]');
      if (visibility) {
        event.stopPropagation();
        this.actions.togglePartVisibility?.(visibility.dataset.togglePartVisibility);
        return;
      }
      const row = event.target.closest('[data-part-id]');
      if (row) this.actions.selectPart?.(row.dataset.partId);
    });
    this.dom.showAllPartsButton.addEventListener('click', () => this.actions.showAllParts?.());
    this.dom.restoreAuthoredVisibilityButton.addEventListener('click', () => this.actions.restoreAuthoredVisibility?.());
    this.dom.isolateSelectedPartButton.addEventListener('click', () => this.actions.isolateSelectedPart?.());
    this.dom.toggleSelectedPartButton.addEventListener('click', () => this.actions.toggleSelectedPart?.());
    this.dom.anchorSelectedPartButton.addEventListener('click', () => {
      this.actions.createPartAnchor?.(this.dom.anchorNameInput.value);
    });
    this.dom.saveVisibilityStateButton.addEventListener('click', () => {
      this.actions.saveVisibilityState?.(this.dom.visibilityStateNameInput.value);
    });
    this.dom.applyVisibilityStateButton.addEventListener('click', () => {
      this.actions.applyVisibilityState?.(this.dom.visibilityStateSelect.value);
    });
    this.dom.deleteVisibilityStateButton.addEventListener('click', () => {
      this.actions.deleteVisibilityState?.(this.dom.visibilityStateSelect.value);
    });
    this.dom.visibilityStateSelect.addEventListener('change', () => this.#updateStructureActionState());
    queryAll('[data-anchor-display]').forEach((button) => {
      button.addEventListener('click', () => this.actions.setAnchorDisplay?.(button.dataset.anchorDisplay));
    });
    this.dom.createTargetAnchorButton.addEventListener('click', () => {
      this.actions.createTargetAnchor?.(this.dom.anchorNameInput.value);
    });
    this.dom.anchorSelect.addEventListener('change', () => {
      this.actions.selectAnchor?.(this.dom.anchorSelect.value);
      this.#updateStructureActionState();
    });
    this.dom.focusAnchorButton.addEventListener('click', () => this.actions.focusAnchor?.(this.dom.anchorSelect.value));
    this.dom.deleteAnchorButton.addEventListener('click', () => this.actions.deleteAnchor?.(this.dom.anchorSelect.value));

    this.dom.createVariantGroupButton.addEventListener('click', () => {
      this.actions.createVariantGroup?.(this.dom.variantGroupNameInput.value, true);
    });
    this.dom.variantGroupSelect.addEventListener('change', () => {
      this.selectedVariantGroupId = this.dom.variantGroupSelect.value || null;
      this.#renderVariantWorkspace();
    });
    this.dom.variantGroupRequiredToggle.addEventListener('change', () => {
      this.actions.setVariantGroupRequired?.(this.selectedVariantGroupId, this.dom.variantGroupRequiredToggle.checked);
    });
    this.dom.deleteVariantGroupButton.addEventListener('click', () => {
      this.actions.deleteVariantGroup?.(this.selectedVariantGroupId);
    });
    this.dom.variantAppearanceToggle.addEventListener('change', () => this.#updateVariantActionState());
    this.dom.variantVisibilitySelect.addEventListener('change', () => this.#updateVariantActionState());
    this.dom.createVariantOptionButton.addEventListener('click', () => {
      this.actions.createVariantOption?.({
        groupId: this.selectedVariantGroupId,
        name: this.dom.variantOptionNameInput.value,
        includeAppearance: this.dom.variantAppearanceToggle.checked,
        color: this.dom.variantColorInput.value,
        finish: this.dom.variantFinishSelect.value,
        visibility: this.dom.variantVisibilitySelect.value,
      });
    });
    this.dom.variantOptionList.addEventListener('click', (event) => this.#handleVariantActionClick(event));
    this.dom.variantTrayGroups.addEventListener('click', (event) => this.#handleVariantActionClick(event));
    this.dom.saveVariantConfigurationButton.addEventListener('click', () => {
      this.actions.saveVariantConfiguration?.(this.dom.variantConfigurationNameInput.value);
    });
    this.dom.variantConfigurationSelect.addEventListener('change', () => this.#updateVariantActionState());
    this.dom.applyVariantConfigurationButton.addEventListener('click', () => {
      this.actions.applyVariantConfiguration?.(this.dom.variantConfigurationSelect.value);
    });
    this.dom.deleteVariantConfigurationButton.addEventListener('click', () => {
      this.actions.deleteVariantConfiguration?.(this.dom.variantConfigurationSelect.value);
    });

    this.dom.variantPreviewToggle.addEventListener('change', () => {
      this.actions.setVariantPreviewEnabled?.(this.dom.variantPreviewToggle.checked);
    });


    queryAll('[data-infographic-display]').forEach((button) => {
      button.addEventListener('click', () => this.actions.setInfographicDisplay?.(button.dataset.infographicDisplay));
    });
    this.dom.infographicSelect.addEventListener('change', () => {
      this.selectedInfographicId = this.dom.infographicSelect.value || null;
      this.actions.selectInfographic?.(this.selectedInfographicId);
    });
    this.dom.infographicAnchorSelect.addEventListener('change', () => this.#updateInfographicActionState());
    this.dom.infographicTitleInput.addEventListener('input', () => this.#updateInfographicActionState());
    this.dom.createInfographicButton.addEventListener('click', () => {
      this.actions.createInfographic?.(this.#readInfographicForm());
    });
    this.dom.updateInfographicButton.addEventListener('click', () => {
      this.actions.updateInfographic?.(this.selectedInfographicId, this.#readInfographicForm());
    });
    this.dom.infographicVisibleToggle.addEventListener('change', () => {
      this.actions.setInfographicVisible?.(this.selectedInfographicId, this.dom.infographicVisibleToggle.checked);
    });
    this.dom.focusInfographicButton.addEventListener('click', () => {
      this.actions.focusInfographicAnchor?.(this.selectedInfographicId);
    });
    this.dom.deleteInfographicButton.addEventListener('click', () => {
      this.actions.deleteInfographic?.(this.selectedInfographicId);
    });

    this.dom.savePresentationButton.addEventListener('click', () => {
      this.actions.savePresentation?.(this.dom.presentationNameInput.value);
    });
    this.dom.presentationSelect.addEventListener('change', () => this.#updatePresentationActionState());
    this.dom.applyPresentationButton.addEventListener('click', () => {
      this.actions.applyPresentation?.(this.dom.presentationSelect.value);
    });
    this.dom.deletePresentationButton.addEventListener('click', () => {
      this.actions.deletePresentation?.(this.dom.presentationSelect.value);
    });

    this.dom.explodeDistanceInput.addEventListener('input', () => {
      const value = Number(this.dom.explodeDistanceInput.value);
      this.dom.explodeDistanceOutput.value = value.toFixed(2);
      this.updateRangeProgress(this.dom.explodeDistanceInput);
    });
    this.dom.applyExplodeOffsetButton.addEventListener('click', () => {
      this.actions.setSelectedExplode?.(Number(this.dom.explodeDistanceInput.value), this.dom.explodeDirectionSelect.value);
    });
    this.dom.clearExplodeOffsetButton.addEventListener('click', () => this.actions.clearSelectedExplode?.());
    this.dom.clearAllExplodeButton.addEventListener('click', () => this.actions.clearAllExplode?.());
    this.dom.saveExplodeStateButton.addEventListener('click', () => this.actions.saveExplodedState?.(this.dom.explodeStateNameInput.value));
    this.dom.explodeStateSelect.addEventListener('change', () => this.#updateStoryActionState());
    this.dom.applyExplodeStateButton.addEventListener('click', () => this.actions.applyExplodedState?.(this.dom.explodeStateSelect.value));
    this.dom.deleteExplodeStateButton.addEventListener('click', () => this.actions.deleteExplodedState?.(this.dom.explodeStateSelect.value));

    this.dom.chapterClipSelect.addEventListener('change', () => this.#setChapterEndFromClip());
    [this.dom.chapterStartInput, this.dom.chapterEndInput, this.dom.chapterSpeedInput].forEach((input) => {
      input.addEventListener('input', () => this.#updateStoryActionState());
    });
    this.dom.chapterSelect.addEventListener('change', () => {
      this.selectedChapterId = this.dom.chapterSelect.value || null;
      this.#loadSelectedChapter();
      this.#updateStoryActionState();
    });
    this.dom.createChapterButton.addEventListener('click', () => this.actions.createAnimationChapter?.(this.#readChapterForm()));
    this.dom.updateChapterButton.addEventListener('click', () => this.actions.updateAnimationChapter?.(this.selectedChapterId, this.#readChapterForm()));
    this.dom.previewChapterButton.addEventListener('click', () => this.actions.previewAnimationChapter?.(this.selectedChapterId));
    this.dom.deleteChapterButton.addEventListener('click', () => this.actions.deleteAnimationChapter?.(this.selectedChapterId));

    this.dom.createStoryButton.addEventListener('click', () => this.actions.createStory?.(this.dom.storyNameInput.value, this.dom.storyLoopToggle.checked));
    this.dom.storySelect.addEventListener('change', () => {
      this.selectedStoryId = this.dom.storySelect.value || null;
      this.actions.selectStory?.(this.selectedStoryId);
    });
    this.dom.storyLoopToggle.addEventListener('change', () => {
      if (this.selectedStoryId) this.actions.updateStory?.(this.selectedStoryId, { loop: this.dom.storyLoopToggle.checked });
    });
    this.dom.deleteStoryButton.addEventListener('click', () => this.actions.deleteStory?.(this.selectedStoryId));
    [this.dom.storyPanelPlayButton, this.dom.storyTransportPlayButton].forEach((button) => button.addEventListener('click', () => this.actions.toggleStoryPlayback?.()));
    [this.dom.storyPanelStopButton, this.dom.storyTransportStopButton].forEach((button) => button.addEventListener('click', () => this.actions.stopStoryPlayback?.()));
    this.dom.storyTransportPreviousButton.addEventListener('click', () => this.actions.previousStoryStep?.());
    this.dom.storyTransportNextButton.addEventListener('click', () => this.actions.nextStoryStep?.());

    this.dom.storyTransitionInput.addEventListener('input', () => {
      const value = Number(this.dom.storyTransitionInput.value);
      this.dom.storyTransitionOutput.value = `${value.toFixed(2)} s`;
      this.updateRangeProgress(this.dom.storyTransitionInput);
    });
    this.dom.storyHoldInput.addEventListener('input', () => {
      const value = Number(this.dom.storyHoldInput.value);
      this.dom.storyHoldOutput.value = `${value.toFixed(2)} s`;
      this.updateRangeProgress(this.dom.storyHoldInput);
    });
    this.dom.storyInfographicDisplaySelect.addEventListener('change', () => this.#updateStoryActionState());
    this.dom.addStoryStepButton.addEventListener('click', () => this.actions.addStoryStep?.(this.selectedStoryId, this.#readStoryStepForm()));
    this.dom.updateStoryStepButton.addEventListener('click', () => this.actions.updateStoryStep?.(this.selectedStoryId, this.selectedStoryStepId, this.#readStoryStepForm()));
    this.dom.storyStepSelect.addEventListener('change', () => {
      this.selectedStoryStepId = this.dom.storyStepSelect.value || null;
      this.actions.selectStoryStep?.(this.selectedStoryId, this.selectedStoryStepId);
    });
    this.dom.moveStoryStepUpButton.addEventListener('click', () => this.actions.moveStoryStep?.(this.selectedStoryId, this.selectedStoryStepId, 'up'));
    this.dom.moveStoryStepDownButton.addEventListener('click', () => this.actions.moveStoryStep?.(this.selectedStoryId, this.selectedStoryStepId, 'down'));
    this.dom.previewStoryStepButton.addEventListener('click', () => this.actions.previewStoryStep?.(this.selectedStoryId, this.selectedStoryStepId));
    this.dom.deleteStoryStepButton.addEventListener('click', () => this.actions.deleteStoryStep?.(this.selectedStoryId, this.selectedStoryStepId));
    this.dom.storyPreviewToggle.addEventListener('change', () => this.actions.setStoryPreviewEnabled?.(this.dom.storyPreviewToggle.checked));
    this.dom.resetStoryGroupButton.addEventListener('click', () => this.actions.resetStoryGroup?.());

    this.dom.materialDiagnosticsList.addEventListener('change', (event) => {
      const select = event.target.closest('select[data-material-id]');
      if (!select) return;
      this.actions.setMaterialSideOverride?.(select.dataset.materialId, select.value);
    });

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
    this.dom.quickTurntableButton.addEventListener('click', () => this.actions.toggleTurntable?.());
    this.dom.turntableSpeedInput.addEventListener('input', () => {
      const speed = Number(this.dom.turntableSpeedInput.value);
      this.dom.turntableSpeedOutput.value = `${speed.toFixed(2)}×`;
      this.updateRangeProgress(this.dom.turntableSpeedInput);
      this.actions.setTurntableSpeed?.(speed);
    });

    this.dom.saveLookButton.addEventListener('click', () => {
      this.actions.saveCurrentLook?.(this.dom.savedLookNameInput.value);
    });
    this.dom.applyLookButton.addEventListener('click', () => {
      this.actions.applySavedLook?.(this.dom.savedLookSelect.value);
    });
    this.dom.deleteLookButton.addEventListener('click', () => {
      this.actions.deleteSavedLook?.(this.dom.savedLookSelect.value);
    });
    this.dom.savedLookSelect.addEventListener('change', () => this.#updateSavedLookActionState());

    this.dom.projectButton.addEventListener('click', (event) => {
      event.stopPropagation();
      const open = this.dom.projectButton.getAttribute('aria-expanded') === 'true';
      this.toggleProjectMenu(!open);
    });
    this.dom.saveProjectButton.addEventListener('click', () => {
      this.toggleProjectMenu(false);
      this.actions.saveProject?.();
    });
    this.dom.openProjectButton.addEventListener('click', () => {
      this.toggleProjectMenu(false);
      this.dom.projectFileInput.click();
    });

    this.dom.openExperienceButton.addEventListener('click', () => {
      this.toggleProjectMenu(false);
      this.dom.experienceFileInput.click();
    });
    this.dom.publishExperienceButton.addEventListener('click', () => {
      this.toggleProjectMenu(false);
      this.actions.publishExperience?.({ share: false });
    });
    this.dom.presentButton.addEventListener('click', () => this.actions.enterExperience?.());
    this.dom.recentProjectsList.addEventListener('click', (event) => {
      const remove = event.target.closest('[data-remove-recent]');
      if (remove) {
        event.stopPropagation();
        this.actions.removeRecentProject?.(remove.dataset.removeRecent);
        return;
      }
      const row = event.target.closest('[data-recent-project]');
      if (!row) return;
      this.toggleProjectMenu(false);
      this.actions.openRecentProject?.(row.dataset.recentProject);
    });

    this.dom.dismissIntro.addEventListener('click', () => this.dismissIntro());
    this.dom.introHint.addEventListener('pointerdown', (event) => event.stopPropagation());

    this.dom.panelToggle.addEventListener('click', () => this.toggleAdvancedPanel());
    this.dom.panelClose.addEventListener('click', () => this.closeAdvancedPanel());

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

    queryAll('#exportMenu [data-export-presentation]').forEach((button) => {
      button.addEventListener('click', () => {
        this.toggleExportMenu(false);
        this.actions.exportPresentation?.(button.dataset.exportPresentation);
      });
    });

    queryAll('#exportMenu [data-export-framing]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        this.actions.setExportFraming?.(button.dataset.exportFraming);
      });
    });

    queryAll('.experience-field').forEach((field) => {
      const type = field instanceof HTMLInputElement && ['text', 'url', 'color'].includes(field.type)
        || field instanceof HTMLTextAreaElement
        ? 'input'
        : 'change';
      field.addEventListener(type, () => {
        if (!this.syncingExperience) this.actions.updateExperience?.(this.#readExperienceForm());
      });
    });

    this.dom.experienceLogoInput.addEventListener('change', () => {
      const file = this.dom.experienceLogoInput.files?.[0];
      if (file) this.actions.setExperienceLogo?.(file);
      this.dom.experienceLogoInput.value = '';
    });
    this.dom.removeExperienceLogoButton.addEventListener('click', () => this.actions.removeExperienceLogo?.());
    this.dom.previewExperienceButton.addEventListener('click', () => this.actions.enterExperience?.());
    this.dom.downloadExperienceButton.addEventListener('click', () => this.actions.publishExperience?.({ share: false }));
    this.dom.shareExperienceButton.addEventListener('click', () => this.actions.publishExperience?.({ share: true }));
    this.dom.copyExperienceLinkButton.addEventListener('click', () => this.actions.copyExperienceLink?.());
    this.dom.testExperienceArButton.addEventListener('click', () => this.actions.launchExperienceAr?.());
    this.dom.exportPresentationLandscapeButton.addEventListener('click', () => this.actions.exportPresentation?.('1920x1080'));
    this.dom.exportPresentationPortraitButton.addEventListener('click', () => this.actions.exportPresentation?.('2160x2700'));

    this.dom.presentationStartButton.addEventListener('click', () => this.actions.startExperience?.());
    this.dom.presentationExitButton.addEventListener('click', () => this.actions.exitExperience?.());
    this.dom.presentationOptionsButton.addEventListener('click', () => this.actions.toggleExperienceOptions?.());
    this.dom.presentationShareButton.addEventListener('click', () => this.actions.shareExperience?.());
    this.dom.presentationArButton.addEventListener('click', () => this.actions.launchExperienceAr?.());
    this.dom.presentationFullscreenButton.addEventListener('click', () => this.actions.toggleFullscreen?.());
    this.dom.presentationPreviousButton.addEventListener('click', () => this.actions.previousStoryStep?.());
    this.dom.presentationPlayButton.addEventListener('click', () => this.actions.toggleStoryPlayback?.());
    this.dom.presentationNextButton.addEventListener('click', () => this.actions.nextStoryStep?.());
    this.dom.presentationRestartButton.addEventListener('click', () => this.actions.restartExperience?.());
    this.dom.presentationExploreButton.addEventListener('click', () => this.actions.exploreExperience?.());
    this.dom.presentationStepDots.addEventListener('click', (event) => {
      const step = event.target.closest('[data-experience-step]');
      if (step) this.actions.goToExperienceStep?.(step.dataset.experienceStep);
    });

    document.addEventListener('pointerdown', (event) => {
      if (!event.target.closest('.export-wrap')) this.toggleExportMenu(false);
      if (!event.target.closest('.project-wrap')) this.toggleProjectMenu(false);
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

  setBackdropPresetActive(name) {
    queryAll('[data-backdrop]').forEach((button) => {
      const active = button.dataset.backdrop === name;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    this.dom.backdropChannelState.textContent = String(name || 'custom').toUpperCase();
  }

  clearBackdropPresetActive() {
    queryAll('[data-backdrop]').forEach((button) => {
      button.classList.remove('is-active');
      button.setAttribute('aria-pressed', 'false');
    });
    this.dom.backdropChannelState.textContent = 'CUSTOM';
  }

  // Stable V1.2/V1.3 aliases.
  setLookPresetActive(name) {
    this.setBackdropPresetActive(name);
  }

  clearLookPresetActive() {
    this.clearBackdropPresetActive();
  }

  setLightingPresetActive(name) {
    queryAll('[data-lighting]').forEach((button) => {
      const active = button.dataset.lighting === name;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    this.dom.lightingChannelState.textContent = String(name || 'custom').toUpperCase();
  }

  clearLightingPresetActive() {
    queryAll('[data-lighting]').forEach((button) => {
      button.classList.remove('is-active');
      button.setAttribute('aria-pressed', 'false');
    });
    this.dom.lightingChannelState.textContent = 'CUSTOM';
  }

  setLightingInputs(preset) {
    this.setLightingControl('exposure', preset.exposure);
    this.setLightingControl('environment', preset.environment);
    this.setLightingControl('environmentRotation', preset.environmentRotation);
    this.setLightingControl('key', preset.key);
    this.setLightingControl('fill', preset.fill);
    this.setLightingControl('rim', preset.rim);
    this.setLightingControl('bloom', preset.bloom);
    this.setGroundControl('shadow', preset.shadow);
    this.setGroundControl('softness', preset.shadowSoftness);
  }

  // Stable compatibility helper for old combined presets.
  setLookInputs(preset) {
    this.setBackdropToneInput(preset.backdropTone);
    this.setLightingInputs(preset);
  }

  setBackdropToneInput(value) {
    this.dom.backdropToneInput.value = String(value);
    this.dom.backdropToneOutput.value = `${Math.round(value * 100)}%`;
    this.dom.viewportShell.dataset.overlayTheme = value >= 0.58 ? 'dark' : 'light';
    this.updateRangeProgress(this.dom.backdropToneInput);
  }

  setInputValue(input, output, value, decimals = 2, suffix = '') {
    input.value = String(value);
    output.value = `${Number(value).toFixed(decimals)}${suffix}`;
    this.updateRangeProgress(input);
  }

  setLightingControl(name, value) {
    const controls = {
      exposure: [this.dom.exposureInput, this.dom.exposureOutput],
      environment: [this.dom.environmentInput, this.dom.environmentOutput],
      key: [this.dom.keyInput, this.dom.keyOutput],
      fill: [this.dom.fillInput, this.dom.fillOutput],
      rim: [this.dom.rimInput, this.dom.rimOutput],
      bloom: [this.dom.bloomInput, this.dom.bloomOutput],
    };
    if (name === 'environmentRotation') {
      const degrees = radiansToDegrees(value);
      this.dom.environmentRotationInput.value = String(degrees);
      this.dom.environmentRotationOutput.value = `${Math.round(degrees)}°`;
      this.updateRangeProgress(this.dom.environmentRotationInput);
      return;
    }
    const pair = controls[name];
    if (pair) this.setInputValue(pair[0], pair[1], value, 2);
  }

  setGroundControl(name, value) {
    const controls = {
      offset: [this.dom.groundOffsetInput, this.dom.groundOffsetOutput],
      shadow: [this.dom.shadowOpacityInput, this.dom.shadowOpacityOutput],
      softness: [this.dom.shadowSoftnessInput, this.dom.shadowSoftnessOutput],
    };
    const pair = controls[name];
    if (pair) this.setInputValue(pair[0], pair[1], value, 2);
  }

  setStudioToggle(name, enabled) {
    const toggles = {
      floor: this.dom.floorToggle,
      shadow: this.dom.shadowToggle,
      post: this.dom.postToggle,
    };
    if (toggles[name]) toggles[name].checked = Boolean(enabled);
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
      button.classList.toggle('is-active', Boolean(name) && button.dataset.camera === name);
    });
  }

  setCameraControl(name, value) {
    if (name === 'focal') {
      this.dom.focalInput.value = String(value);
      this.dom.focalOutput.value = `${Math.round(value)} mm`;
      this.updateRangeProgress(this.dom.focalInput);
    }
    if (name === 'damping') {
      this.setInputValue(this.dom.dampingInput, this.dom.dampingOutput, value, 2);
    }
  }

  updateCameraTargetUI(target = {}) {
    ['x', 'y', 'z'].forEach((axis) => {
      const upper = axis.toUpperCase();
      const input = this.dom[`target${upper}Input`];
      const output = this.dom[`target${upper}Output`];
      const value = Number(target[axis] ?? (axis === 'y' ? 0.47 : 0));
      input.value = String(value);
      output.value = value.toFixed(2);
      this.updateRangeProgress(input);
    });
  }

  setCameraToggle(name, enabled) {
    if (name === 'autoRotate') this.dom.autoRotateToggle.checked = Boolean(enabled);
    if (name === 'horizon') this.dom.horizonToggle.checked = Boolean(enabled);
  }

  setInspectMode(enabled) {
    this.dom.inspectToggle.checked = Boolean(enabled);
    this.dom.cameraModeValue.textContent = enabled ? 'INSPECT' : 'PRESENTATION';
  }

  setBackfaceRepair(enabled) {
    this.dom.backfaceRepairToggle.checked = Boolean(enabled);
  }

  updateCameraDiagnostics(diagnostics = {}) {
    const mode = diagnostics.mode === 'inspect' ? 'INSPECT' : 'PRESENTATION';
    this.dom.cameraModeValue.textContent = mode;
    this.dom.cameraMinDistance.textContent = Number(diagnostics.minDistance || 0).toFixed(2);
    this.dom.cameraNearValue.textContent = `${Number(diagnostics.near || 0).toFixed(3)} / ${Math.round(Number(diagnostics.far || 0))}`;
    if (diagnostics.target) this.updateCameraTargetUI(diagnostics.target);
    this.dom.cameraSafetyNote.textContent = diagnostics.insideModel
      ? 'Camera was kept outside the product shell.'
      : diagnostics.clampedToGround
        ? 'Camera was clamped above the presentation ground.'
        : diagnostics.targetClamped
          ? 'Camera target was kept inside the safe composition envelope.'
          : mode === 'INSPECT'
            ? 'Inspect mode relaxes safety limits for close review.'
            : 'Presentation mode keeps the orbit clean and above ground.';
  }

  updateMaterialDiagnostics(diagnostics = {}) {
    this.dom.materialHealth.textContent = String((diagnostics.health || 'safe')).toUpperCase();
    this.dom.diagTransparent.textContent = String(diagnostics.transparent || 0);
    this.dom.diagAlphaMasked.textContent = String(diagnostics.alphaMasked || 0);
    this.dom.diagGlass.textContent = String(diagnostics.glass || 0);
    this.dom.diagDoubleSided.textContent = String(diagnostics.doubleSided || 0);
    this.dom.diagBackfaceCandidates.textContent = String(diagnostics.backfaceCandidates || 0);
    this.dom.diagNotes.textContent = diagnostics.notes?.[0]
      || 'Opaque materials remain unchanged. Glass is reported but not forced double-sided.';
    this.dom.backfaceRepairToggle.checked = Boolean(diagnostics.backfaceRepairEnabled);
    this.dom.backfaceRepairToggle.disabled = Number(diagnostics.backfaceCandidates || 0) === 0;
    this.dom.materialListMeta.textContent = `${diagnostics.uniqueMaterials || 0} MATERIALS · ${diagnostics.manualOverrides || 0} OVERRIDES`;
    this.#renderMaterialList(diagnostics);
  }

  #renderMaterialList(diagnostics) {
    const materials = [...(diagnostics.materials || [])].sort((a, b) => {
      const score = (item) => (
        (item.safeBackfaceCandidate ? 8 : 0)
        + (item.glassLike ? 4 : 0)
        + (item.alphaBlended ? 3 : 0)
        + (item.alphaMasked ? 2 : 0)
        + (item.sideOverride !== 'auto' ? 16 : 0)
      );
      return score(b) - score(a) || a.id - b.id;
    });
    const visible = materials.slice(0, 64);
    const signature = JSON.stringify({
      total: materials.length,
      items: visible.map((item) => [
        item.id,
        item.materialName,
        item.meshName,
        item.sideOverride,
        item.effectiveSide,
        item.issues,
      ]),
    });
    if (signature === this.materialListSignature) return;
    this.materialListSignature = signature;
    this.dom.materialDiagnosticsList.replaceChildren();

    if (visible.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'material-list-empty';
      empty.textContent = 'No material slots were reported for this product.';
      this.dom.materialDiagnosticsList.appendChild(empty);
      return;
    }

    visible.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'material-diagnostic-row';
      row.classList.toggle('is-repaired', Boolean(item.repairActive));
      row.classList.toggle('is-watch', Boolean(item.glassLike || item.alphaBlended));

      const copy = document.createElement('div');
      copy.className = 'material-diagnostic-copy';
      const title = document.createElement('strong');
      title.textContent = item.materialName || `Material ${item.id}`;
      const meta = document.createElement('small');
      meta.textContent = `${item.meshName || 'Mesh'} · ${String(item.effectiveSide || item.originalSide).toUpperCase()}`;
      const tags = document.createElement('div');
      tags.className = 'material-tags';
      const tagValues = item.issues?.length ? item.issues : ['opaque'];
      tagValues.slice(0, 3).forEach((issue) => {
        const tag = document.createElement('span');
        tag.textContent = issue.replaceAll('-', ' ');
        tags.appendChild(tag);
      });
      copy.append(title, meta, tags);

      const select = document.createElement('select');
      select.dataset.materialId = String(item.id);
      select.setAttribute('aria-label', `Side policy for ${item.materialName || `material ${item.id}`}`);
      [
        ['auto', 'Auto'],
        ['original', 'Original'],
        ['front', 'Front'],
        ['back', 'Back'],
        ['double', 'Double'],
      ].forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
      });
      select.value = item.sideOverride || 'auto';
      row.append(copy, select);
      this.dom.materialDiagnosticsList.appendChild(row);
    });

    if (materials.length > visible.length) {
      const more = document.createElement('p');
      more.className = 'material-list-more';
      more.textContent = `${materials.length - visible.length} additional clean material slots are hidden for performance.`;
      this.dom.materialDiagnosticsList.appendChild(more);
    }
  }

  updateStructure(report = {}) {
    this.structureReport = report && typeof report === 'object' ? report : {};
    const total = Number(this.structureReport.totalParts || 0);
    const hidden = Number(this.structureReport.hiddenCount || 0);
    this.dom.structureMeta.textContent = `${total} ${total === 1 ? 'PART' : 'PARTS'}${hidden ? ` · ${hidden} HIDDEN` : ''}`;

    const selected = this.structureReport.selectedPart || null;
    this.dom.selectedPartName.textContent = selected?.label || 'No part selected';
    this.dom.selectedPartKind.textContent = selected ? String(selected.kind || 'part').toUpperCase() : 'NONE';
    this.dom.selectedPartPath.textContent = selected
      ? `${selected.path} · ${selected.meshCount || 0} mesh${selected.meshCount === 1 ? '' : 'es'}`
      : 'Select a mesh or group from the structure list.';
    const hasSelection = Boolean(selected?.id);
    this.dom.isolateSelectedPartButton.disabled = !hasSelection;
    this.dom.toggleSelectedPartButton.disabled = !hasSelection;
    this.dom.anchorSelectedPartButton.disabled = !hasSelection;
    this.dom.toggleSelectedPartButton.textContent = selected?.requestedVisible === false ? 'Show part' : 'Hide part';

    this.#renderStructureParts();
    this.#renderVisibilityStates();
    this.#renderAnchors();
    this.#updateStructureActionState();
    this.#renderVariantTarget();
    this.#updateVariantActionState();
  }

  #renderStructureParts() {
    const report = this.structureReport || {};
    const query = this.structureQuery;
    const records = (report.records || []).filter((record) => {
      if (!query) return true;
      const haystack = `${record.label || ''} ${record.path || ''} ${record.kind || ''}`.toLowerCase();
      return query.split(/\s+/).filter(Boolean).every((term) => haystack.includes(term));
    });
    this.dom.structurePartList.replaceChildren();

    if (!records.length) {
      const empty = document.createElement('p');
      empty.className = 'structure-empty';
      empty.textContent = report.totalParts
        ? 'No parts match this search.'
        : 'This product does not expose a usable mesh hierarchy.';
      this.dom.structurePartList.appendChild(empty);
      return;
    }

    records.slice(0, 256).forEach((record) => {
      const row = document.createElement('div');
      row.className = 'structure-part-row';
      row.classList.toggle('is-selected', Boolean(record.selected));
      row.classList.toggle('is-hidden', !record.effectiveVisible);
      row.style.setProperty('--part-depth', String(Math.min(6, Number(record.depth || 0))));

      const select = document.createElement('button');
      select.type = 'button';
      select.dataset.partId = record.id;
      select.className = 'structure-part-select';
      select.setAttribute('role', 'option');
      select.setAttribute('aria-selected', String(Boolean(record.selected)));

      const icon = document.createElement('i');
      icon.className = record.kind?.includes('mesh') ? 'is-mesh' : 'is-group';
      const copy = document.createElement('span');
      const title = document.createElement('b');
      title.textContent = record.label || 'Part';
      const meta = document.createElement('small');
      meta.textContent = `${record.kind || 'part'} · ${record.meshCount || 0} mesh${record.meshCount === 1 ? '' : 'es'}`;
      copy.append(title, meta);
      select.append(icon, copy);

      const visibility = document.createElement('button');
      visibility.type = 'button';
      visibility.className = 'structure-visibility-button';
      visibility.dataset.togglePartVisibility = record.id;
      visibility.setAttribute('aria-label', `${record.requestedVisible === false ? 'Show' : 'Hide'} ${record.label || 'part'}`);
      visibility.title = record.requestedVisible === false ? 'Show part' : 'Hide part';
      visibility.textContent = record.requestedVisible === false ? '○' : '●';

      row.append(select, visibility);
      this.dom.structurePartList.appendChild(row);
    });

    if (records.length > 256) {
      const more = document.createElement('p');
      more.className = 'structure-empty';
      more.textContent = `${records.length - 256} additional nodes hidden. Refine the search to inspect them.`;
      this.dom.structurePartList.appendChild(more);
    }
  }

  #renderVisibilityStates() {
    const states = this.structureReport?.visibilityStates || [];
    const previous = this.dom.visibilityStateSelect.value;
    this.dom.visibilityStateSelect.replaceChildren();
    if (!states.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No saved states';
      this.dom.visibilityStateSelect.appendChild(option);
      this.dom.visibilityStateSelect.disabled = true;
    } else {
      states.forEach((state) => {
        const option = document.createElement('option');
        option.value = state.id;
        option.textContent = state.name || 'Visibility state';
        this.dom.visibilityStateSelect.appendChild(option);
      });
      this.dom.visibilityStateSelect.disabled = false;
      const preferred = states.some((state) => state.id === this.structureReport.activeVisibilityStateId)
        ? this.structureReport.activeVisibilityStateId
        : states.some((state) => state.id === previous)
          ? previous
          : states[0].id;
      this.dom.visibilityStateSelect.value = preferred;
    }
    this.dom.visibilityStateCount.textContent = `${states.length} SAVED`;
  }

  #renderAnchors() {
    const anchors = this.structureReport?.anchors || [];
    const previous = this.dom.anchorSelect.value;
    this.dom.anchorSelect.replaceChildren();
    if (!anchors.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No anchors';
      this.dom.anchorSelect.appendChild(option);
      this.dom.anchorSelect.disabled = true;
    } else {
      anchors.forEach((anchor) => {
        const option = document.createElement('option');
        option.value = anchor.id;
        option.textContent = `${anchor.name || 'Anchor'}${anchor.resolved === false ? ' · unresolved' : ''}`;
        this.dom.anchorSelect.appendChild(option);
      });
      this.dom.anchorSelect.disabled = false;
      const selectedId = this.structureReport.selectedAnchorId;
      this.dom.anchorSelect.value = anchors.some((anchor) => anchor.id === selectedId)
        ? selectedId
        : anchors.some((anchor) => anchor.id === previous)
          ? previous
          : anchors[0].id;
    }
    this.dom.anchorCount.textContent = `${anchors.length} ${anchors.length === 1 ? 'ANCHOR' : 'ANCHORS'}`;
    queryAll('[data-anchor-display]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.anchorDisplay === (this.structureReport?.anchorDisplay || 'off'));
    });
    const current = anchors.find((anchor) => anchor.id === this.dom.anchorSelect.value);
    this.dom.anchorMeta.textContent = current
      ? `${String(current.kind || 'custom').replaceAll('-', ' ')}${current.partId ? ` · ${current.partId}` : ''}${current.resolved === false ? ' · fallback position' : ''}`
      : 'Anchors are stored in product-local space and follow the model.';
  }

  #updateStructureActionState() {
    const stateEnabled = Boolean(this.dom.visibilityStateSelect.value) && !this.dom.visibilityStateSelect.disabled;
    this.dom.applyVisibilityStateButton.disabled = !stateEnabled;
    this.dom.deleteVisibilityStateButton.disabled = !stateEnabled;
    const anchorEnabled = Boolean(this.dom.anchorSelect.value) && !this.dom.anchorSelect.disabled;
    this.dom.focusAnchorButton.disabled = !anchorEnabled;
    this.dom.deleteAnchorButton.disabled = !anchorEnabled;
  }

  clearStructureInputs() {
    this.dom.visibilityStateNameInput.value = '';
    this.dom.anchorNameInput.value = '';
  }

  selectVariantGroup(id) {
    this.selectedVariantGroupId = id || null;
    this.#renderVariantWorkspace();
  }

  clearVariantInputs() {
    this.dom.variantGroupNameInput.value = '';
    this.dom.variantOptionNameInput.value = '';
    this.dom.variantConfigurationNameInput.value = '';
    this.dom.variantVisibilitySelect.value = 'unchanged';
  }

  updateVariants(report = {}, { previewEnabled = false } = {}) {
    this.variantReport = report && typeof report === 'object' ? report : {};
    this.variantReport.previewEnabled = Boolean(previewEnabled);
    this.dom.variantPreviewToggle.checked = Boolean(previewEnabled);
    const groups = this.variantReport.groups || this.variantReport.variantGroups || [];
    if (!groups.some((group) => group.id === this.selectedVariantGroupId)) {
      this.selectedVariantGroupId = groups[0]?.id || null;
    }
    this.#renderVariantWorkspace();
  }

  #selectedVariantGroup() {
    const groups = this.variantReport?.groups || this.variantReport?.variantGroups || [];
    return groups.find((group) => group.id === this.selectedVariantGroupId) || null;
  }

  #renderVariantWorkspace() {
    const report = this.variantReport || {};
    const groups = report.groups || report.variantGroups || [];
    const selections = report.selections || report.variantSelections || {};
    const previousGroup = this.selectedVariantGroupId;
    this.dom.variantGroupSelect.replaceChildren();
    if (!groups.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No option groups';
      this.dom.variantGroupSelect.appendChild(option);
      this.dom.variantGroupSelect.disabled = true;
      this.selectedVariantGroupId = null;
    } else {
      groups.forEach((group) => {
        const option = document.createElement('option');
        option.value = group.id;
        option.textContent = group.name || 'Option group';
        this.dom.variantGroupSelect.appendChild(option);
      });
      this.dom.variantGroupSelect.disabled = false;
      this.selectedVariantGroupId = groups.some((group) => group.id === previousGroup)
        ? previousGroup
        : groups[0].id;
      this.dom.variantGroupSelect.value = this.selectedVariantGroupId;
    }
    this.dom.variantGroupCount.textContent = `${groups.length} ${groups.length === 1 ? 'GROUP' : 'GROUPS'}`;

    const group = this.#selectedVariantGroup();
    this.dom.variantGroupRequiredToggle.checked = group?.required !== false;
    this.dom.variantGroupRequiredToggle.disabled = !group;
    this.dom.deleteVariantGroupButton.disabled = !group;
    this.#renderVariantTarget();
    this.#renderVariantOptions(group, selections);
    this.#renderVariantConfigurations();
    this.#renderVariantConflicts();
    this.#renderVariantTray(groups, selections, Boolean(report.previewEnabled));
    this.#updateVariantActionState();
  }

  #renderVariantTarget() {
    const selected = this.structureReport?.selectedPart || null;
    this.dom.variantTargetName.textContent = selected?.label || 'Select a part in Parts';
    this.dom.variantTargetKind.textContent = selected ? String(selected.kind || 'part').toUpperCase() : 'NO PART';
    this.dom.variantTargetMeta.textContent = selected
      ? `${selected.path} · appearance expands to ${selected.meshCount || 0} mesh${selected.meshCount === 1 ? '' : 'es'}`
      : 'Appearance changes expand safely to descendant meshes. Visibility changes target the selected stable part ID.';
  }

  #renderVariantOptions(group, selections) {
    this.dom.variantOptionList.replaceChildren();
    const options = group?.options || [];
    const activeId = group ? selections[group.id] : null;
    this.dom.variantOptionCount.textContent = `${options.length} ${options.length === 1 ? 'OPTION' : 'OPTIONS'}`;
    if (!group || !options.length) {
      const empty = document.createElement('p');
      empty.className = 'structure-empty';
      empty.textContent = group
        ? 'Select a part and create the first option.'
        : 'Create an option group before authoring variants.';
      this.dom.variantOptionList.appendChild(empty);
      return;
    }

    options.forEach((option) => {
      const row = document.createElement('div');
      row.className = 'variant-option-row';
      row.classList.toggle('is-active', option.id === activeId);
      const main = document.createElement('button');
      main.type = 'button';
      main.className = 'variant-option-main';
      main.dataset.variantActivate = option.id;
      main.dataset.variantGroup = group.id;
      const swatch = document.createElement('i');
      swatch.className = 'variant-option-swatch';
      if (option.swatch) swatch.style.setProperty('--variant-swatch', option.swatch);
      else swatch.classList.add('is-visibility');
      const copy = document.createElement('span');
      const title = document.createElement('b');
      title.textContent = option.name || 'Option';
      const meta = document.createElement('small');
      const appearanceCount = Object.keys(option.changes?.appearance || {}).length;
      const visibilityCount = Object.keys(option.changes?.visibility || {}).length;
      meta.textContent = `${appearanceCount ? `${appearanceCount} appearance` : ''}${appearanceCount && visibilityCount ? ' · ' : ''}${visibilityCount ? `${visibilityCount} visibility` : ''}${option.id === group.defaultOptionId ? ' · default' : ''}`;
      copy.append(title, meta);
      main.append(swatch, copy);

      const actions = document.createElement('div');
      actions.className = 'variant-option-actions';
      const make = (label, action) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.dataset[action] = option.id;
        button.dataset.variantGroup = group.id;
        return button;
      };
      actions.append(make(option.id === group.defaultOptionId ? 'Default' : 'Set default', 'variantDefault'));
      actions.append(make('×', 'variantDelete'));
      row.append(main, actions);
      this.dom.variantOptionList.appendChild(row);
    });

    if (group.required === false && activeId) {
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'variant-clear-selection';
      clear.dataset.variantClear = group.id;
      clear.textContent = 'Clear optional selection';
      this.dom.variantOptionList.appendChild(clear);
    }
  }

  #renderVariantConfigurations() {
    const report = this.variantReport || {};
    const configurations = report.configurations || [];
    const previous = this.dom.variantConfigurationSelect.value;
    this.dom.variantConfigurationSelect.replaceChildren();
    if (!configurations.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No configurations';
      this.dom.variantConfigurationSelect.appendChild(option);
      this.dom.variantConfigurationSelect.disabled = true;
    } else {
      configurations.forEach((configuration) => {
        const option = document.createElement('option');
        option.value = configuration.id;
        option.textContent = configuration.name || 'Configuration';
        this.dom.variantConfigurationSelect.appendChild(option);
      });
      this.dom.variantConfigurationSelect.disabled = false;
      const active = report.activeConfigurationId;
      this.dom.variantConfigurationSelect.value = configurations.some((item) => item.id === active)
        ? active
        : configurations.some((item) => item.id === previous)
          ? previous
          : configurations[0].id;
    }
    this.dom.variantConfigurationCount.textContent = `${configurations.length} SAVED`;
  }

  #renderVariantConflicts() {
    const conflicts = this.variantReport?.conflicts || [];
    this.dom.variantConflictCount.textContent = `${conflicts.length} ${conflicts.length === 1 ? 'CONFLICT' : 'CONFLICTS'}`;
    this.dom.variantConflictList.replaceChildren();
    this.dom.variantConflictNote.textContent = conflicts.length
      ? 'Later groups are winning deterministically. Review overlapping targets if that was not intentional.'
      : 'Groups resolve from top to bottom. Later groups override only the properties they explicitly change.';
    conflicts.slice(0, 8).forEach((conflict) => {
      const row = document.createElement('p');
      row.textContent = `${conflict.type} · ${conflict.targetId} · ${conflict.property}`;
      this.dom.variantConflictList.appendChild(row);
    });
    this.dom.variantConflictList.parentElement?.setAttribute('data-conflicts', String(conflicts.length > 0));
  }

  #renderVariantTray(groups, selections, previewEnabled = false) {
    this.dom.variantTray.hidden = !(previewEnabled && groups.length);
    this.dom.variantTrayMeta.textContent = `${groups.length} ${groups.length === 1 ? 'GROUP' : 'GROUPS'}`;
    this.dom.variantTrayGroups.replaceChildren();
    groups.forEach((group) => {
      const section = document.createElement('div');
      section.className = 'variant-tray-group';
      const label = document.createElement('span');
      label.textContent = group.name || 'Options';
      const options = document.createElement('div');
      options.className = 'variant-tray-options';
      group.options.forEach((option) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.variantActivate = option.id;
        button.dataset.variantGroup = group.id;
        button.classList.toggle('is-active', selections[group.id] === option.id);
        if (option.swatch) {
          const swatch = document.createElement('i');
          swatch.style.setProperty('--variant-swatch', option.swatch);
          button.appendChild(swatch);
        }
        const textNode = document.createElement('span');
        textNode.textContent = option.name || 'Option';
        button.appendChild(textNode);
        options.appendChild(button);
      });
      section.append(label, options);
      this.dom.variantTrayGroups.appendChild(section);
    });
  }

  #handleVariantActionClick(event) {
    const activate = event.target.closest('[data-variant-activate]');
    if (activate) {
      this.actions.activateVariantOption?.(activate.dataset.variantGroup, activate.dataset.variantActivate);
      return;
    }
    const setDefault = event.target.closest('[data-variant-default]');
    if (setDefault) {
      this.actions.setVariantDefaultOption?.(setDefault.dataset.variantGroup, setDefault.dataset.variantDefault);
      return;
    }
    const remove = event.target.closest('[data-variant-delete]');
    if (remove) {
      this.actions.deleteVariantOption?.(remove.dataset.variantGroup, remove.dataset.variantDelete);
      return;
    }
    const clear = event.target.closest('[data-variant-clear]');
    if (clear) this.actions.clearVariantSelection?.(clear.dataset.variantClear);
  }

  #updateVariantActionState() {
    const group = this.#selectedVariantGroup();
    const hasPart = Boolean(this.structureReport?.selectedPart?.id);
    const hasChange = this.dom.variantAppearanceToggle.checked || this.dom.variantVisibilitySelect.value !== 'unchanged';
    this.dom.createVariantOptionButton.disabled = !(group && hasPart && hasChange);
    this.dom.variantColorInput.disabled = !this.dom.variantAppearanceToggle.checked;
    this.dom.variantFinishSelect.disabled = !this.dom.variantAppearanceToggle.checked;
    this.dom.variantGroupRequiredToggle.disabled = !group;
    this.dom.deleteVariantGroupButton.disabled = !group;
    const configurationEnabled = Boolean(this.dom.variantConfigurationSelect.value) && !this.dom.variantConfigurationSelect.disabled;
    this.dom.applyVariantConfigurationButton.disabled = !configurationEnabled;
    this.dom.deleteVariantConfigurationButton.disabled = !configurationEnabled;
  }

  #readInfographicForm() {
    return {
      anchorId: this.dom.infographicAnchorSelect.value || null,
      eyebrow: this.dom.infographicEyebrowInput.value,
      title: this.dom.infographicTitleInput.value,
      body: this.dom.infographicBodyInput.value,
      accent: this.dom.infographicAccentInput.value,
      side: this.dom.infographicSideSelect.value,
    };
  }

  clearInfographicInputs() {
    this.dom.infographicEyebrowInput.value = 'FEATURE';
    this.dom.infographicTitleInput.value = '';
    this.dom.infographicBodyInput.value = '';
    this.dom.infographicAccentInput.value = '#ff7950';
    this.dom.infographicSideSelect.value = 'auto';
    this.#updateInfographicActionState();
  }

  selectInfographic(id) {
    this.selectedInfographicId = id || null;
    this.#renderInfographicWorkspace();
  }

  updateInfographics(report = {}) {
    this.infographicReport = report && typeof report === 'object' ? report : {};
    const records = this.infographicReport.infographics || [];
    const preferred = this.infographicReport.selectedInfographicId;
    if (preferred && records.some((record) => record.id === preferred)) this.selectedInfographicId = preferred;
    else if (!records.some((record) => record.id === this.selectedInfographicId)) this.selectedInfographicId = records[0]?.id || null;
    this.#renderInfographicWorkspace();
  }

  #renderInfographicWorkspace() {
    const report = this.infographicReport || {};
    const records = report.infographics || [];
    const anchors = report.availableAnchors || [];
    const selected = records.find((record) => record.id === this.selectedInfographicId) || null;

    queryAll('[data-infographic-display]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.infographicDisplay === (report.display || 'off'));
    });
    this.dom.infographicCount.textContent = `${records.length} ${records.length === 1 ? 'INFOGRAPHIC' : 'INFOGRAPHICS'}`;
    this.dom.infographicUnresolvedCount.textContent = `${report.unresolvedCount || 0} UNRESOLVED`;

    const currentAnchor = selected?.anchorId || this.dom.infographicAnchorSelect.value;
    this.dom.infographicAnchorSelect.replaceChildren();
    if (!anchors.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Create an anchor in Parts';
      this.dom.infographicAnchorSelect.appendChild(option);
      this.dom.infographicAnchorSelect.disabled = true;
    } else {
      anchors.forEach((anchor) => {
        const option = document.createElement('option');
        option.value = anchor.id;
        option.textContent = `${anchor.name || 'Anchor'}${anchor.resolved === false ? ' · fallback' : ''}`;
        this.dom.infographicAnchorSelect.appendChild(option);
      });
      this.dom.infographicAnchorSelect.disabled = false;
      this.dom.infographicAnchorSelect.value = anchors.some((anchor) => anchor.id === currentAnchor)
        ? currentAnchor
        : anchors[0].id;
    }

    this.dom.infographicSelect.replaceChildren();
    if (!records.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No infographics';
      this.dom.infographicSelect.appendChild(option);
      this.dom.infographicSelect.disabled = true;
      this.selectedInfographicId = null;
    } else {
      records.forEach((record) => {
        const option = document.createElement('option');
        option.value = record.id;
        option.textContent = `${record.title || 'Infographic'} · ${record.anchorName || 'Anchor'}`;
        this.dom.infographicSelect.appendChild(option);
      });
      this.dom.infographicSelect.disabled = false;
      this.dom.infographicSelect.value = selected?.id || records[0].id;
      this.selectedInfographicId = this.dom.infographicSelect.value;
    }

    const active = records.find((record) => record.id === this.selectedInfographicId) || null;
    if (active) {
      this.dom.infographicEyebrowInput.value = active.eyebrow || 'FEATURE';
      this.dom.infographicTitleInput.value = active.title || '';
      this.dom.infographicBodyInput.value = active.body || '';
      this.dom.infographicAccentInput.value = active.accent || '#ff7950';
      this.dom.infographicSideSelect.value = active.side || 'auto';
      if (anchors.some((anchor) => anchor.id === active.anchorId)) this.dom.infographicAnchorSelect.value = active.anchorId;
      this.dom.infographicVisibleToggle.checked = active.visible !== false;
      this.dom.infographicMeta.textContent = `${active.anchorName || 'Missing anchor'} · ${active.resolved ? 'resolved' : 'unresolved fallback'} · ${active.side || 'auto'} side`;
    } else {
      this.dom.infographicVisibleToggle.checked = true;
      this.dom.infographicMeta.textContent = 'Infographic cards reference anchors; they do not rewrite the GLB.';
    }
    this.#updateInfographicActionState();
  }

  #updateInfographicActionState() {
    const hasAnchor = Boolean(this.dom.infographicAnchorSelect.value) && !this.dom.infographicAnchorSelect.disabled;
    const hasTitle = Boolean(this.dom.infographicTitleInput.value.trim());
    const hasSelected = Boolean(this.selectedInfographicId) && !this.dom.infographicSelect.disabled;
    this.dom.createInfographicButton.disabled = !(hasAnchor && hasTitle);
    this.dom.updateInfographicButton.disabled = !hasSelected;
    this.dom.infographicVisibleToggle.disabled = !hasSelected;
    this.dom.focusInfographicButton.disabled = !hasSelected;
    this.dom.deleteInfographicButton.disabled = !hasSelected;
  }


  updatePresentations(report = {}) {
    this.presentationReport = report && typeof report === 'object' ? report : {};
    const presentations = this.presentationReport.presentations || [];
    const previous = this.dom.presentationSelect.value;
    this.dom.presentationSelect.replaceChildren();
    if (!presentations.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No presentations';
      this.dom.presentationSelect.appendChild(option);
      this.dom.presentationSelect.disabled = true;
    } else {
      presentations.forEach((presentation) => {
        const option = document.createElement('option');
        option.value = presentation.id;
        option.textContent = presentation.name || 'Presentation';
        this.dom.presentationSelect.appendChild(option);
      });
      this.dom.presentationSelect.disabled = false;
      const active = this.presentationReport.activePresentationId;
      this.dom.presentationSelect.value = presentations.some((item) => item.id === active)
        ? active
        : presentations.some((item) => item.id === previous)
          ? previous
          : presentations[0].id;
    }
    this.dom.presentationCount.textContent = `${presentations.length} SAVED`;
    this.#updatePresentationActionState();
  }

  clearPresentationInput() {
    this.dom.presentationNameInput.value = '';
  }

  #updatePresentationActionState() {
    const enabled = Boolean(this.dom.presentationSelect.value) && !this.dom.presentationSelect.disabled;
    this.dom.applyPresentationButton.disabled = !enabled;
    this.dom.deletePresentationButton.disabled = !enabled;
  }

  updateStories(report = {}) {
    this.storyReport = report && typeof report === 'object' ? report : {};
    const explosion = this.storyReport.explosion || {};
    const explodeStates = Array.isArray(explosion.explodeStates) ? explosion.explodeStates : [];
    const chapters = Array.isArray(this.storyReport.animationChapters) ? this.storyReport.animationChapters : [];
    const stories = Array.isArray(this.storyReport.stories) ? this.storyReport.stories : [];
    const clips = Array.isArray(this.storyReport.clips) ? this.storyReport.clips : [];
    const presentations = Array.isArray(this.storyReport.presentations) ? this.storyReport.presentations : [];
    const infographics = Array.isArray(this.storyReport.infographics) ? this.storyReport.infographics : [];
    const selectedPart = this.storyReport.selectedPart || null;

    this.dom.storySelectedPartName.textContent = selectedPart?.label || 'Select a part in Parts';
    this.dom.explodeOffsetCount.textContent = `${explosion.offsetCount || 0} ${(explosion.offsetCount || 0) === 1 ? 'PART' : 'PARTS'} OFFSET`;
    if (selectedPart?.id) {
      const vector = explosion.explodeOffsets?.[selectedPart.id];
      if (Array.isArray(vector)) {
        const distance = Math.hypot(...vector.map(Number));
        this.dom.explodeDistanceInput.value = String(Math.min(3, distance));
        this.dom.explodeDistanceOutput.value = distance.toFixed(2);
        this.updateRangeProgress(this.dom.explodeDistanceInput);
      }
    }

    this.#replaceStorySelect(this.dom.explodeStateSelect, explodeStates, {
      emptyLabel: 'No exploded states',
      selectedId: explosion.activeExplodeStateId || this.dom.explodeStateSelect.value,
      label: (item) => item.name || 'Exploded state',
    });

    const previousClip = this.dom.chapterClipSelect.value;
    this.dom.chapterClipSelect.replaceChildren();
    if (!clips.length) {
      const option = document.createElement('option');
      option.value = '0';
      option.textContent = 'No animations';
      this.dom.chapterClipSelect.appendChild(option);
      this.dom.chapterClipSelect.disabled = true;
    } else {
      clips.forEach((clip) => {
        const option = document.createElement('option');
        option.value = String(clip.index);
        option.textContent = `${clip.name || `Clip ${clip.index + 1}`} · ${Number(clip.duration || 0).toFixed(2)} s`;
        this.dom.chapterClipSelect.appendChild(option);
      });
      this.dom.chapterClipSelect.disabled = false;
      this.dom.chapterClipSelect.value = clips.some((clip) => String(clip.index) === previousClip)
        ? previousClip
        : String(clips[0].index);
    }

    const chapterSelection = chapters.some((item) => item.id === this.selectedChapterId)
      ? this.selectedChapterId
      : chapters[0]?.id || null;
    this.selectedChapterId = chapterSelection;
    this.#replaceStorySelect(this.dom.chapterSelect, chapters, {
      emptyLabel: 'No chapters',
      selectedId: chapterSelection,
      label: (item) => item.name || 'Animation chapter',
    });
    this.dom.animationChapterCount.textContent = `${chapters.length} ${chapters.length === 1 ? 'CHAPTER' : 'CHAPTERS'}`;
    this.#loadSelectedChapter();

    const requestedStoryId = this.storyReport.activeStoryId || this.selectedStoryId;
    this.selectedStoryId = stories.some((item) => item.id === requestedStoryId)
      ? requestedStoryId
      : stories[0]?.id || null;
    this.#replaceStorySelect(this.dom.storySelect, stories, {
      emptyLabel: 'No stories',
      selectedId: this.selectedStoryId,
      label: (item) => item.unresolved?.length
        ? `${item.name || 'Story'} · review`
        : item.name || 'Story',
    });
    this.dom.storyCount.textContent = `${stories.length} ${stories.length === 1 ? 'STORY' : 'STORIES'}`;

    const activeStory = stories.find((item) => item.id === this.selectedStoryId) || null;
    this.dom.storyLoopToggle.checked = Boolean(activeStory?.loop);
    const steps = Array.isArray(activeStory?.steps) ? activeStory.steps : [];
    const requestedStepId = this.storyReport.activeStoryStepId || this.selectedStoryStepId;
    this.selectedStoryStepId = steps.some((item) => item.id === requestedStepId)
      ? requestedStepId
      : steps[0]?.id || null;
    this.#replaceStorySelect(this.dom.storyStepSelect, steps, {
      emptyLabel: 'No story steps',
      selectedId: this.selectedStoryStepId,
      label: (item, index) => `${index + 1}. ${item.name || `Step ${index + 1}`}${item.unresolved?.length ? ' · missing reference' : ''}`,
    });
    this.dom.storyStepCount.textContent = `${steps.length} ${steps.length === 1 ? 'STEP' : 'STEPS'}`;

    this.#replaceStoryReferenceSelect(this.dom.storyPresentationSelect, presentations, {
      emptyLabel: 'Keep current',
      label: (item) => item.name || 'Saved shot',
    });
    this.#replaceStoryReferenceSelect(this.dom.storyExplodeSelect, explodeStates, {
      emptyLabel: 'Keep current',
      label: (item) => item.name || 'Exploded state',
    });
    this.#replaceStoryReferenceSelect(this.dom.storyChapterSelect, chapters, {
      emptyLabel: 'No chapter',
      label: (item) => item.name || 'Animation chapter',
    });
    this.#replaceStoryReferenceSelect(this.dom.storyInfographicSelect, infographics, {
      emptyLabel: 'None',
      label: (item) => item.title || item.name || 'Infographic',
    });

    const activeStep = steps.find((item) => item.id === this.selectedStoryStepId) || null;
    this.#loadStoryStep(activeStep);
    this.dom.storyPreviewToggle.checked = Boolean(this.storyReport.storyPreviewEnabled);
    this.#updateStoryActionState();
    this.updateStoryPlayer(this.storyReport.player || {});
  }

  updateStoryPlayer(state = {}) {
    const report = this.storyReport || {};
    const stories = Array.isArray(report.stories) ? report.stories : [];
    const selectedStory = stories.find((item) => item.id === (state.storyId || this.selectedStoryId)) || null;
    const steps = selectedStory?.steps || [];
    const stepIndex = Number.isInteger(state.stepIndex)
      ? state.stepIndex
      : Math.max(0, steps.findIndex((step) => step.id === this.selectedStoryStepId));
    const activeStep = state.stepId
      ? steps.find((step) => step.id === state.stepId)
      : steps[stepIndex] || null;
    const previewEnabled = Boolean(report.storyPreviewEnabled ?? this.dom.storyPreviewToggle.checked);
    const hasStory = Boolean(selectedStory?.id && steps.length);

    this.dom.storyTransport.hidden = !(previewEnabled && hasStory);
    this.dom.storyTransportName.textContent = state.storyName || selectedStory?.name || 'No active story';
    const phase = state.playing
      ? state.paused
        ? 'PAUSED'
        : String(state.phase || 'PLAYING').toUpperCase()
      : hasStory
        ? 'READY'
        : 'IDLE';
    const stepMeta = hasStory && activeStep
      ? `${Math.max(1, stepIndex + 1)}/${steps.length} · ${activeStep.name || 'Step'}`
      : '';
    this.dom.storyTransportStatus.textContent = stepMeta ? `${phase} · ${stepMeta}` : phase;

    const playing = Boolean(state.playing);
    const paused = Boolean(state.paused);
    const playLabel = playing ? (paused ? 'Resume' : 'Pause') : 'Play';
    this.dom.storyTransportPlayButton.textContent = playLabel;
    this.dom.storyPanelPlayButton.textContent = playLabel;
    this.dom.storyTransportPlayButton.classList.toggle('is-playing', playing && !paused);
    this.dom.storyPanelPlayButton.classList.toggle('is-playing', playing && !paused);

    [this.dom.storyTransportPreviousButton, this.dom.storyTransportNextButton].forEach((button) => {
      button.disabled = !hasStory;
    });
    this.dom.storyTransportPlayButton.disabled = !hasStory;
    this.dom.storyPanelPlayButton.disabled = !hasStory;
    this.dom.storyTransportStopButton.disabled = !playing;
    this.dom.storyPanelStopButton.disabled = !playing;
  }

  clearStoryInputs(kind = 'all') {
    if (kind === 'explode' || kind === 'all') this.dom.explodeStateNameInput.value = '';
    if (kind === 'chapter' || kind === 'all') this.dom.chapterNameInput.value = '';
    if (kind === 'story' || kind === 'all') this.dom.storyNameInput.value = '';
    if (kind === 'step' || kind === 'all') this.dom.storyStepNameInput.value = '';
  }

  #replaceStorySelect(select, items, { emptyLabel, selectedId = null, label } = {}) {
    const previous = selectedId || select.value;
    select.replaceChildren();
    if (!items.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = emptyLabel || 'None';
      select.appendChild(option);
      select.disabled = true;
      return;
    }
    items.forEach((item, index) => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = label?.(item, index) || item.name || item.id;
      select.appendChild(option);
    });
    select.disabled = false;
    select.value = items.some((item) => item.id === previous) ? previous : items[0].id;
  }

  #replaceStoryReferenceSelect(select, items, { emptyLabel, label } = {}) {
    const previous = select.value;
    select.replaceChildren();
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = emptyLabel || 'None';
    select.appendChild(empty);
    items.forEach((item, index) => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = label?.(item, index) || item.name || item.id;
      select.appendChild(option);
    });
    select.value = items.some((item) => item.id === previous) ? previous : '';
  }

  #setChapterEndFromClip() {
    const clipIndex = Number(this.dom.chapterClipSelect.value);
    const clip = (this.storyReport?.clips || []).find((item) => Number(item.index) === clipIndex);
    if (!clip) return;
    this.dom.chapterStartInput.value = '0';
    this.dom.chapterEndInput.value = Math.max(0.001, Number(clip.duration) || 1).toFixed(3);
    this.#updateStoryActionState();
  }

  #loadSelectedChapter() {
    const chapter = (this.storyReport?.animationChapters || []).find((item) => item.id === this.selectedChapterId) || null;
    if (!chapter) {
      if (!this.dom.chapterClipSelect.disabled) {
        const clip = (this.storyReport?.clips || []).find((item) => String(item.index) === this.dom.chapterClipSelect.value);
        this.dom.chapterStartInput.value = '0';
        this.dom.chapterEndInput.value = Math.max(0.001, Number(clip?.duration) || 1).toFixed(3);
      }
      this.dom.chapterSpeedInput.value = '1';
      this.dom.chapterLoopToggle.checked = false;
      this.dom.chapterHoldToggle.checked = true;
      return;
    }
    this.dom.chapterNameInput.value = chapter.name || '';
    if ([...this.dom.chapterClipSelect.options].some((option) => Number(option.value) === Number(chapter.clipIndex))) {
      this.dom.chapterClipSelect.value = String(chapter.clipIndex);
    }
    this.dom.chapterStartInput.value = Number(chapter.startTime || 0).toFixed(3);
    this.dom.chapterEndInput.value = Number(chapter.endTime || 0.001).toFixed(3);
    this.dom.chapterSpeedInput.value = Number(chapter.speed || 1).toFixed(2);
    this.dom.chapterLoopToggle.checked = Boolean(chapter.loop);
    this.dom.chapterHoldToggle.checked = chapter.holdAtEnd !== false;
  }

  #readChapterForm() {
    return {
      name: this.dom.chapterNameInput.value,
      clipIndex: Number(this.dom.chapterClipSelect.value),
      startTime: Number(this.dom.chapterStartInput.value),
      endTime: Number(this.dom.chapterEndInput.value),
      speed: Number(this.dom.chapterSpeedInput.value),
      loop: this.dom.chapterLoopToggle.checked,
      holdAtEnd: this.dom.chapterHoldToggle.checked,
    };
  }

  #loadStoryStep(step) {
    if (!step) {
      this.dom.storyStepNameInput.value = '';
      this.dom.storyPresentationSelect.value = '';
      this.dom.storyExplodeSelect.value = '';
      this.dom.storyChapterSelect.value = '';
      this.dom.storyInfographicDisplaySelect.value = 'inherit';
      this.dom.storyInfographicSelect.value = '';
      this.dom.storyEasingSelect.value = 'cinematic';
      this.dom.storyTransitionInput.value = '1.2';
      this.dom.storyTransitionOutput.value = '1.20 s';
      this.dom.storyHoldInput.value = '1';
      this.dom.storyHoldOutput.value = '1.00 s';
      this.updateRangeProgress(this.dom.storyTransitionInput);
      this.updateRangeProgress(this.dom.storyHoldInput);
      return;
    }
    this.dom.storyStepNameInput.value = step.name || '';
    this.dom.storyPresentationSelect.value = [...this.dom.storyPresentationSelect.options].some((option) => option.value === step.presentationId)
      ? step.presentationId || ''
      : '';
    this.dom.storyExplodeSelect.value = [...this.dom.storyExplodeSelect.options].some((option) => option.value === step.explodeStateId)
      ? step.explodeStateId || ''
      : '';
    this.dom.storyChapterSelect.value = [...this.dom.storyChapterSelect.options].some((option) => option.value === step.chapterId)
      ? step.chapterId || ''
      : '';
    this.dom.storyInfographicDisplaySelect.value = step.infographicDisplay || 'inherit';
    this.dom.storyInfographicSelect.value = [...this.dom.storyInfographicSelect.options].some((option) => option.value === step.selectedInfographicId)
      ? step.selectedInfographicId || ''
      : '';
    this.dom.storyEasingSelect.value = step.easing || 'cinematic';
    this.dom.storyTransitionInput.value = String(step.transitionDuration ?? 1.2);
    this.dom.storyTransitionOutput.value = `${Number(step.transitionDuration ?? 1.2).toFixed(2)} s`;
    this.dom.storyHoldInput.value = String(step.holdDuration ?? 1);
    this.dom.storyHoldOutput.value = `${Number(step.holdDuration ?? 1).toFixed(2)} s`;
    this.updateRangeProgress(this.dom.storyTransitionInput);
    this.updateRangeProgress(this.dom.storyHoldInput);
  }

  #readStoryStepForm() {
    return {
      name: this.dom.storyStepNameInput.value,
      presentationId: this.dom.storyPresentationSelect.value || null,
      explodeStateId: this.dom.storyExplodeSelect.value || null,
      chapterId: this.dom.storyChapterSelect.value || null,
      infographicDisplay: this.dom.storyInfographicDisplaySelect.value || 'inherit',
      selectedInfographicId: this.dom.storyInfographicSelect.value || null,
      easing: this.dom.storyEasingSelect.value || 'cinematic',
      transitionDuration: Number(this.dom.storyTransitionInput.value),
      holdDuration: Number(this.dom.storyHoldInput.value),
    };
  }

  #updateStoryActionState() {
    const report = this.storyReport || {};
    const explosion = report.explosion || {};
    const stories = Array.isArray(report.stories) ? report.stories : [];
    const activeStory = stories.find((item) => item.id === this.selectedStoryId) || null;
    const steps = activeStory?.steps || [];
    const selectedStepIndex = steps.findIndex((item) => item.id === this.selectedStoryStepId);
    const hasSelectedPart = Boolean(report.selectedPart?.id);
    const hasExplodeState = Boolean(this.dom.explodeStateSelect.value) && !this.dom.explodeStateSelect.disabled;
    const hasClip = !this.dom.chapterClipSelect.disabled && Boolean(this.dom.chapterClipSelect.options.length);
    const hasChapter = Boolean(this.selectedChapterId) && !this.dom.chapterSelect.disabled;
    const hasStory = Boolean(activeStory?.id);
    const hasStep = selectedStepIndex >= 0;

    this.dom.applyExplodeOffsetButton.disabled = !hasSelectedPart;
    this.dom.clearExplodeOffsetButton.disabled = !hasSelectedPart;
    // Empty offsets are a valid reusable 'assembled' state.
    this.dom.saveExplodeStateButton.disabled = false;
    this.dom.clearAllExplodeButton.disabled = Number(explosion.offsetCount || 0) <= 0;
    this.dom.applyExplodeStateButton.disabled = !hasExplodeState;
    this.dom.deleteExplodeStateButton.disabled = !hasExplodeState;

    const start = Number(this.dom.chapterStartInput.value);
    const end = Number(this.dom.chapterEndInput.value);
    const validRange = Number.isFinite(start) && Number.isFinite(end) && end > start;
    this.dom.createChapterButton.disabled = !(hasClip && validRange);
    this.dom.updateChapterButton.disabled = !(hasChapter && validRange);
    this.dom.previewChapterButton.disabled = !hasChapter;
    this.dom.deleteChapterButton.disabled = !hasChapter;

    this.dom.deleteStoryButton.disabled = !hasStory;
    this.dom.addStoryStepButton.disabled = !hasStory;
    this.dom.updateStoryStepButton.disabled = !hasStep;
    this.dom.moveStoryStepUpButton.disabled = !hasStep || selectedStepIndex <= 0;
    this.dom.moveStoryStepDownButton.disabled = !hasStep || selectedStepIndex >= steps.length - 1;
    this.dom.previewStoryStepButton.disabled = !hasStep;
    this.dom.deleteStoryStepButton.disabled = !hasStep;
    this.dom.storyInfographicSelect.disabled = this.dom.storyInfographicDisplaySelect.value === 'off';
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
    this.dom.quickTurntableButton.classList.toggle('is-active', turntable);
    this.dom.quickTurntableButton.setAttribute('aria-pressed', String(turntable));
    this.dom.turntableSpeedInput.value = String(turntableSpeed);
    this.dom.turntableSpeedOutput.value = `${turntableSpeed.toFixed(2)}×`;
    this.updateRangeProgress(this.dom.animationSpeedInput);
    this.updateRangeProgress(this.dom.turntableSpeedInput);
  }

  updatePreflight(report = {}) {
    const metrics = report.metrics || {};
    const status = ['ready', 'review', 'heavy'].includes(report.status) ? report.status : 'ready';
    const score = Math.max(0, Math.min(100, Math.round(Number(report.score) || 0)));
    this.dom.preflightScore.textContent = String(score);
    this.dom.preflightStatus.textContent = status.toUpperCase();
    this.dom.preflightSummary.textContent = report.summary || 'Asset health has not been evaluated.';
    this.dom.preflightMeshes.textContent = formatNumber(metrics.meshes || 0);
    this.dom.preflightDrawCalls.textContent = formatNumber(metrics.drawCalls || 0);
    this.dom.preflightTriangles.textContent = formatCompact(metrics.renderedTriangles || metrics.triangles || 0);
    this.dom.preflightMaxTexture.textContent = metrics.maxTextureDimension ? `${formatNumber(metrics.maxTextureDimension)} px` : '—';
    this.dom.preflightTextureMemory.textContent = `${Number(metrics.estimatedTextureMegabytes || 0).toFixed(1)} MB`;
    this.dom.preflightFileSize.textContent = metrics.fileSize ? formatBytes(metrics.fileSize) : 'Procedural';
    this.dom.preflightIssueCount.textContent = `${report.issues?.length || 0} ${(report.issues?.length || 0) === 1 ? 'ITEM' : 'ITEMS'}`;

    const scoreCard = this.dom.preflightScore.closest('.health-score-card');
    scoreCard?.setAttribute('data-health-status', status);
    this.dom.preflightHudBadge.dataset.status = status;
    this.dom.preflightHudBadge.textContent = `${status.toUpperCase()} ${score}`;

    this.dom.preflightIssueList.innerHTML = '';
    const issues = Array.isArray(report.issues) ? report.issues : [];
    if (!issues.length) {
      const empty = document.createElement('p');
      empty.className = 'health-empty';
      empty.textContent = 'No asset warnings detected.';
      this.dom.preflightIssueList.appendChild(empty);
    } else {
      issues.forEach((issue) => {
        const row = document.createElement('article');
        row.className = `preflight-issue is-${issue.severity || 'info'}`;
        const icon = document.createElement('span');
        icon.textContent = issue.severity === 'critical' ? '!' : issue.severity === 'warning' ? '•' : 'i';
        const copy = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = issue.title || 'Review item';
        const detail = document.createElement('p');
        detail.textContent = issue.detail || '';
        const recommendation = document.createElement('small');
        recommendation.textContent = issue.recommendation || '';
        copy.append(title, detail, recommendation);
        row.append(icon, copy);
        this.dom.preflightIssueList.appendChild(row);
      });
    }
  }

  updateRuntime(snapshot = {}, quality = 'quality', { autoQuality = true, suspended = false } = {}) {
    const fps = Number(snapshot.fps || 0);
    const frameTime = Number(snapshot.frameTimeMs || 0);
    const p95 = Number(snapshot.p95FrameTimeMs || 0);
    const state = suspended ? 'paused' : String(snapshot.state || 'warming');
    this.dom.runtimeState.textContent = state.toUpperCase();
    this.dom.runtimeFps.textContent = fps > 0 ? `${fps.toFixed(1)} fps` : '—';
    this.dom.runtimeFrameTime.textContent = frameTime > 0 ? `${frameTime.toFixed(1)} ms` : '—';
    this.dom.runtimeP95.textContent = p95 > 0 ? `${p95.toFixed(1)} ms` : '—';
    this.dom.runtimeQuality.textContent = String(quality || 'quality').toUpperCase();
    this.dom.runtimeHudBadge.textContent = state === 'paused'
      ? 'PAUSED'
      : fps > 0
        ? `${Math.round(fps)} FPS`
        : 'WARMING';
    this.dom.runtimeHudBadge.dataset.state = state;
    this.dom.runtimeNote.textContent = state === 'paused'
      ? 'Rendering is paused while this tab is hidden.'
      : state === 'strained'
        ? autoQuality
          ? 'Sustained pressure detected. Auto quality may step down after its safety window.'
          : 'Performance pressure detected. Choose Balanced or Fast if interaction feels heavy.'
        : state === 'smooth'
          ? autoQuality
            ? 'Smooth headroom. Auto quality can restore detail after a sustained window.'
            : 'Runtime is smooth at the selected quality.'
          : state === 'stable'
            ? 'Runtime is stable for interactive presentation.'
            : 'Collecting a stable performance window.';
  }

  setRuntimePreferences({ autoQuality, pauseWhenHidden, recoveryEnabled } = {}) {
    if (typeof autoQuality === 'boolean') this.dom.autoQualityToggle.checked = autoQuality;
    if (typeof pauseWhenHidden === 'boolean') this.dom.pauseWhenHiddenToggle.checked = pauseWhenHidden;
    if (typeof recoveryEnabled === 'boolean') this.dom.recoveryEnabledToggle.checked = recoveryEnabled;
  }

  updateRecoveryStatus(metadata = null, { state = 'idle', message = null } = {}) {
    const labels = {
      idle: 'LOCAL',
      saving: 'SAVING',
      saved: 'SAVED',
      disabled: 'OFF',
      unavailable: 'UNAVAILABLE',
      error: 'ERROR',
    };
    this.dom.recoveryStatus.textContent = labels[state] || String(state).toUpperCase();
    this.dom.recoveryStatus.dataset.state = state;
    if (message) {
      this.dom.recoveryMeta.textContent = message;
    } else if (metadata?.savedAt) {
      const date = new Date(metadata.savedAt);
      const when = Number.isNaN(date.getTime()) ? 'recently' : date.toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' });
      this.dom.recoveryMeta.textContent = `${metadata.title || 'Unsaved project'} · ${when} · ${formatBytes(metadata.size || 0)}`;
    } else {
      this.dom.recoveryMeta.textContent = state === 'disabled'
        ? 'Automatic local recovery is disabled for this project.'
        : state === 'unavailable'
          ? 'This browser did not expose local IndexedDB recovery storage.'
          : 'No recovery draft has been written in this session.';
    }
    const disabled = state === 'disabled' || state === 'unavailable';
    this.dom.saveRecoveryButton.disabled = disabled;
    this.dom.clearRecoveryButton.disabled = state === 'unavailable';
  }

  showRecoveryPrompt(metadata = {}) {
    this.dom.recoveryPrompt.hidden = false;
    this.dom.recoveryPromptTitle.textContent = metadata.title || 'Unsaved Product VIS session';
    const date = metadata.savedAt ? new Date(metadata.savedAt) : null;
    const when = date && !Number.isNaN(date.getTime())
      ? date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
      : 'a previous session';
    this.dom.recoveryPromptMeta.textContent = `${metadata.assetName || 'Embedded product'} · saved ${when}`;
  }

  hideRecoveryPrompt() {
    this.dom.recoveryPrompt.hidden = true;
  }

  setSystemFooter(status, meta) {
    this.dom.systemFooterStatus.textContent = String(status || 'GPU READY').toUpperCase();
    this.dom.systemFooterMeta.textContent = String(meta || 'GLB stays on this device');
  }

  updateExperienceEditor(profile = {}, stories = []) {
    this.experienceState = profile && typeof profile === 'object' ? profile : {};
    this.experienceStories = Array.isArray(stories) ? stories : [];
    this.syncingExperience = true;
    try {
      const state = this.experienceState;
      this.dom.experienceEyebrowInput.value = state.eyebrow || '';
      this.dom.experienceTitleInput.value = state.title || '';
      this.dom.experienceSubtitleInput.value = state.subtitle || '';
      this.dom.experienceAccentInput.value = state.accent || '#ff7950';
      this.dom.experienceThemeSelect.value = ['dark', 'light', 'auto'].includes(state.theme) ? state.theme : 'dark';
      this.dom.experienceEntryModeSelect.value = state.entryMode === 'direct' ? 'direct' : 'intro';
      this.dom.experienceStartLabelInput.value = state.startLabel || 'Start experience';
      this.dom.experienceAutoplayToggle.checked = Boolean(state.autoplay);
      this.dom.experienceOrbitToggle.checked = Boolean(state.allowOrbit);
      this.dom.experienceOptionsToggle.checked = Boolean(state.showOptions);
      this.dom.experienceInfographicsToggle.checked = Boolean(state.showInfographics);
      this.dom.experienceStepNavigationToggle.checked = Boolean(state.showStepNavigation);
      this.dom.experienceIntroEnabledToggle.checked = Boolean(state.intro?.enabled);
      this.dom.experienceIntroTitleInput.value = state.intro?.title || '';
      this.dom.experienceIntroBodyInput.value = state.intro?.body || '';
      this.dom.experienceOutroEnabledToggle.checked = Boolean(state.outro?.enabled);
      this.dom.experienceOutroTitleInput.value = state.outro?.title || '';
      this.dom.experienceOutroBodyInput.value = state.outro?.body || '';
      this.dom.experienceCtaLabelInput.value = state.outro?.ctaLabel || '';
      this.dom.experienceCtaUrlInput.value = state.outro?.ctaUrl || '';
      this.dom.experienceExportBrandToggle.checked = Boolean(state.export?.brandOverlay);
      this.dom.experienceExportInfographicsToggle.checked = Boolean(state.export?.infographics);
      this.dom.experienceExportStoryToggle.checked = Boolean(state.export?.storyCaption);
      this.dom.experienceHostedUrlInput.value = state.share?.hostedPackageUrl || '';
      this.dom.experienceAndroidGlbUrlInput.value = state.ar?.androidGlbUrl || '';
      this.dom.experienceIosUsdzUrlInput.value = state.ar?.iosUsdzUrl || '';
      this.dom.experienceArFallbackUrlInput.value = state.ar?.fallbackUrl || '';
      this.dom.experienceArResizableToggle.checked = state.ar?.resizable !== false;
      this.dom.experienceArVerticalToggle.checked = Boolean(state.ar?.verticalPlacement);
      this.dom.experienceShowArToggle.checked = Boolean(state.showAr);

      this.dom.experienceStorySelect.replaceChildren();
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = this.experienceStories.length ? 'Current / first story' : 'No authored stories';
      this.dom.experienceStorySelect.appendChild(empty);
      this.experienceStories.forEach((story) => {
        const option = document.createElement('option');
        option.value = story.id;
        option.textContent = story.name || 'Product story';
        this.dom.experienceStorySelect.appendChild(option);
      });
      this.dom.experienceStorySelect.value = this.experienceStories.some((story) => story.id === state.entryStoryId)
        ? state.entryStoryId
        : '';
      this.dom.experienceStorySelect.disabled = !this.experienceStories.length;
      this.#renderExperienceLogo(state.logoDataUrl);
    } finally {
      this.syncingExperience = false;
    }
  }

  updateExperienceRuntime(runtime = {}, storyReport = this.storyReport || {}) {
    const state = runtime?.state || runtime || {};
    const profile = state.profile || this.experienceState || {};
    const active = Boolean(state.active);
    const phase = state.phase || 'editor';
    const storyState = state.storyState || {};
    const stories = Array.isArray(storyReport?.stories) ? storyReport.stories : this.experienceStories;
    const story = stories.find((item) => item.id === (storyState.storyId || state.storyId)) || null;
    const steps = Array.isArray(story?.steps) ? story.steps : [];

    this.dom.presentationShell.hidden = !active;
    document.body.classList.toggle('presentation-mode', active);
    document.body.classList.toggle('presentation-intro-active', active && phase === 'intro');
    document.body.classList.toggle('presentation-outro-active', active && phase === 'outro');
    document.body.dataset.presentationSource = active ? (state.source || 'editor') : 'editor';
    if (!active) return;

    const autoTheme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    const theme = profile.theme === 'auto' ? autoTheme : profile.theme === 'light' ? 'light' : 'dark';
    this.dom.presentationShell.dataset.theme = theme;
    this.dom.presentationShell.style.setProperty('--experience-accent', profile.accent || '#ff7950');

    this.dom.presentationBrandEyebrow.textContent = profile.eyebrow || 'PRODUCT VIS';
    this.dom.presentationBrandTitle.textContent = profile.title || 'Product Experience';
    this.dom.presentationBrandMark.textContent = (profile.title || 'P').trim().charAt(0).toUpperCase() || 'P';
    this.dom.presentationIntroEyebrow.textContent = profile.eyebrow || 'PRODUCT VIS';
    this.dom.presentationIntroTitle.textContent = profile.intro?.title || profile.title || 'Meet the product.';
    this.dom.presentationIntroBody.textContent = profile.intro?.body || profile.subtitle || '';
    this.dom.presentationStartButton.textContent = profile.startLabel || 'Start experience';
    this.dom.presentationOutroTitle.textContent = profile.outro?.title || 'Ready for the next step?';
    this.dom.presentationOutroBody.textContent = profile.outro?.body || '';

    [this.dom.presentationBrandLogo, this.dom.presentationIntroLogo].forEach((image) => {
      const hasLogo = Boolean(profile.logoDataUrl);
      image.hidden = !hasLogo;
      if (hasLogo) image.src = profile.logoDataUrl;
      else image.removeAttribute('src');
    });
    this.dom.presentationBrandMark.hidden = Boolean(profile.logoDataUrl);

    this.dom.presentationOptionsButton.hidden = !profile.showOptions;
    const hasSecureArTarget = [profile.ar?.androidGlbUrl, profile.ar?.iosUsdzUrl].some((value) => {
      if (!value) return false;
      try { return new URL(value, globalThis.location?.href).protocol === 'https:'; } catch { return false; }
    });
    this.dom.presentationShareButton.hidden = profile.showShare === false;
    this.dom.presentationArButton.hidden = !profile.showAr || !hasSecureArTarget;
    this.dom.presentationFullscreenButton.hidden = profile.showFullscreen === false;
    this.dom.presentationExitButton.hidden = profile.showExit === false || state.source !== 'editor';
    this.dom.presentationNavigation.hidden = phase !== 'active' || profile.showStepNavigation === false;
    this.dom.presentationIntro.hidden = phase !== 'intro';
    this.dom.presentationOutro.hidden = phase !== 'outro';

    const ctaUrl = profile.outro?.ctaUrl;
    this.dom.presentationOutroLink.hidden = !ctaUrl;
    if (ctaUrl) {
      this.dom.presentationOutroLink.href = ctaUrl;
      this.dom.presentationOutroLink.textContent = profile.outro?.ctaLabel || 'Learn more';
    } else {
      this.dom.presentationOutroLink.removeAttribute('href');
    }

    this.dom.presentationStoryName.textContent = storyState.storyName || story?.name || 'PRODUCT STORY';
    this.dom.presentationStepName.textContent = storyState.stepName || steps[storyState.stepIndex]?.name || 'Explore freely';
    const phaseLabel = storyState.phase ? String(storyState.phase).toUpperCase() : 'READY';
    const countLabel = storyState.stepCount ? `${Math.max(0, Number(storyState.stepIndex) + 1)} / ${storyState.stepCount}` : '';
    this.dom.presentationStepMeta.textContent = [phaseLabel, countLabel].filter(Boolean).join(' · ');
    this.dom.presentationPlayButton.hidden = profile.showPlayControl === false;
    this.dom.presentationPlayButton.textContent = storyState.playing
      ? storyState.paused ? 'Resume' : 'Pause'
      : 'Play';

    this.dom.presentationStepDots.replaceChildren();
    steps.forEach((step, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.experienceStep = step.id;
      button.classList.toggle('is-active', step.id === storyState.stepId || index === storyState.stepIndex);
      button.setAttribute('aria-label', `Go to ${step.name || `step ${index + 1}`}`);
      this.dom.presentationStepDots.appendChild(button);
    });
    this.dom.presentationStepDots.hidden = !steps.length;
    this.dom.presentationPreviousButton.disabled = !steps.length;
    this.dom.presentationNextButton.disabled = !steps.length;
    this.dom.presentationPlayButton.disabled = !steps.length;
  }

  setExperienceBusy(busy) {
    const disabled = Boolean(busy);
    [
      this.dom.publishExperienceButton,
      this.dom.previewExperienceButton,
      this.dom.downloadExperienceButton,
      this.dom.shareExperienceButton,
      this.dom.copyExperienceLinkButton,
    ].forEach((button) => { button.disabled = disabled; });
  }

  #renderExperienceLogo(dataUrl) {
    this.dom.experienceLogoPreview.replaceChildren();
    if (dataUrl) {
      const image = document.createElement('img');
      image.src = dataUrl;
      image.alt = 'Experience logo preview';
      this.dom.experienceLogoPreview.appendChild(image);
      this.dom.removeExperienceLogoButton.disabled = false;
    } else {
      const label = document.createElement('span');
      label.textContent = 'NO LOGO';
      this.dom.experienceLogoPreview.appendChild(label);
      this.dom.removeExperienceLogoButton.disabled = true;
    }
  }

  #readExperienceForm() {
    const current = this.experienceState || {};
    return {
      ...current,
      eyebrow: this.dom.experienceEyebrowInput.value,
      title: this.dom.experienceTitleInput.value,
      subtitle: this.dom.experienceSubtitleInput.value,
      accent: this.dom.experienceAccentInput.value,
      theme: this.dom.experienceThemeSelect.value,
      entryStoryId: this.dom.experienceStorySelect.value || null,
      entryMode: this.dom.experienceEntryModeSelect.value,
      startLabel: this.dom.experienceStartLabelInput.value,
      autoplay: this.dom.experienceAutoplayToggle.checked,
      allowOrbit: this.dom.experienceOrbitToggle.checked,
      showOptions: this.dom.experienceOptionsToggle.checked,
      showInfographics: this.dom.experienceInfographicsToggle.checked,
      showStepNavigation: this.dom.experienceStepNavigationToggle.checked,
      showAr: this.dom.experienceShowArToggle.checked,
      intro: {
        ...(current.intro || {}),
        enabled: this.dom.experienceIntroEnabledToggle.checked,
        title: this.dom.experienceIntroTitleInput.value,
        body: this.dom.experienceIntroBodyInput.value,
      },
      outro: {
        ...(current.outro || {}),
        enabled: this.dom.experienceOutroEnabledToggle.checked,
        title: this.dom.experienceOutroTitleInput.value,
        body: this.dom.experienceOutroBodyInput.value,
        ctaLabel: this.dom.experienceCtaLabelInput.value,
        ctaUrl: this.dom.experienceCtaUrlInput.value || null,
      },
      export: {
        brandOverlay: this.dom.experienceExportBrandToggle.checked,
        infographics: this.dom.experienceExportInfographicsToggle.checked,
        storyCaption: this.dom.experienceExportStoryToggle.checked,
      },
      share: {
        ...(current.share || {}),
        hostedPackageUrl: this.dom.experienceHostedUrlInput.value || null,
      },
      ar: {
        ...(current.ar || {}),
        androidGlbUrl: this.dom.experienceAndroidGlbUrlInput.value || null,
        iosUsdzUrl: this.dom.experienceIosUsdzUrlInput.value || null,
        fallbackUrl: this.dom.experienceArFallbackUrlInput.value || null,
        resizable: this.dom.experienceArResizableToggle.checked,
        verticalPlacement: this.dom.experienceArVerticalToggle.checked,
      },
    };
  }

  updateGroupStatuses(statuses = {}) {
    const map = {
      look: this.dom.lookGroupStatus,
      object: this.dom.objectGroupStatus,
      camera: this.dom.cameraGroupStatus,
      motion: this.dom.motionGroupStatus,
      structure: this.dom.structureGroupStatus,
      variants: this.dom.variantGroupStatus,
      info: this.dom.infoGroupStatus,
      stories: this.dom.storyGroupStatus,
      publish: this.dom.publishGroupStatus,
      health: this.dom.healthGroupStatus,
    };
    let hasCustom = false;
    Object.entries(map).forEach(([name, element]) => {
      const status = statuses[name] || { label: 'DEFAULT', custom: false };
      element.textContent = status.label;
      element.closest('.group-state')?.classList.toggle('is-custom', Boolean(status.custom));
      hasCustom ||= Boolean(status.custom);
    });
    this.dom.panelToggle.classList.toggle('has-custom', hasCustom);
  }

  updateSavedLooks(looks = [], selectedId = null) {
    this.dom.savedLookSelect.innerHTML = '';
    if (!looks.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No saved looks';
      this.dom.savedLookSelect.appendChild(option);
      this.dom.savedLookSelect.disabled = true;
    } else {
      looks.forEach((look) => {
        const option = document.createElement('option');
        option.value = look.id;
        option.textContent = look.name;
        this.dom.savedLookSelect.appendChild(option);
      });
      this.dom.savedLookSelect.disabled = false;
      this.dom.savedLookSelect.value = looks.some((look) => look.id === selectedId)
        ? selectedId
        : looks[0].id;
    }
    this.dom.savedLookCount.textContent = `${looks.length} ${looks.length === 1 ? 'SAVED' : 'SAVED'}`;
    this.#updateSavedLookActionState();
  }

  clearSavedLookName() {
    this.dom.savedLookNameInput.value = '';
  }

  #updateSavedLookActionState() {
    const enabled = Boolean(this.dom.savedLookSelect.value) && !this.dom.savedLookSelect.disabled;
    this.dom.applyLookButton.disabled = !enabled;
    this.dom.deleteLookButton.disabled = !enabled;
  }

  toggleProjectMenu(open) {
    this.dom.projectButton.setAttribute('aria-expanded', String(open));
    this.dom.projectMenu.hidden = !open;
    if (open) this.actions.refreshRecentProjects?.();
  }

  setProjectBusy(busy) {
    this.dom.saveProjectButton.disabled = Boolean(busy);
    this.dom.openProjectButton.disabled = Boolean(busy);
    this.dom.openExperienceButton.disabled = Boolean(busy);
    this.dom.publishExperienceButton.disabled = Boolean(busy);
    this.dom.projectButton.classList.toggle('is-busy', Boolean(busy));
  }

  setProjectStateLabel(label) {
    this.dom.projectStateLabel.textContent = String(label || 'UNSAVED').toUpperCase();
  }

  updateRecentProjects(projects = []) {
    this.dom.recentProjectsList.innerHTML = '';
    if (!projects.length) {
      const empty = document.createElement('p');
      empty.id = 'recentProjectsEmpty';
      empty.className = 'project-empty';
      empty.textContent = 'Saved projects on this device appear here.';
      this.dom.recentProjectsList.appendChild(empty);
      return;
    }
    projects.forEach((project) => {
      const row = document.createElement('div');
      row.className = 'recent-project-row';
      const open = document.createElement('button');
      open.type = 'button';
      open.dataset.recentProject = project.id;
      open.innerHTML = '<span><b></b><small></small></span>';
      const date = project.savedAt ? new Date(project.savedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Local';
      open.querySelector('b').textContent = project.title || 'Product VIS Project';
      open.querySelector('small').textContent = `${project.assetName || 'Embedded asset'} · ${date}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.setAttribute('aria-label', 'Remove recent project');
      remove.dataset.removeRecent = project.id;
      remove.textContent = '×';
      row.append(open, remove);
      this.dom.recentProjectsList.appendChild(row);
    });
  }

  setExportFraming(mode) {
    const normalized = mode === 'fill' ? 'fill' : 'match';
    queryAll('[data-export-framing]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.exportFraming === normalized);
    });
    this.dom.exportFramingNote.textContent = normalized === 'fill'
      ? 'Fill the frame with a centered crop.'
      : 'Preserve the complete viewport composition.';
  }

  switchPanel(name) {
    const titles = { look: 'Look', object: 'Object', camera: 'Camera', motion: 'Motion', structure: 'Parts', variants: 'Variants', info: 'Info', stories: 'Stories', publish: 'Publish', health: 'Health' };
    let activeTab = null;
    queryAll('.panel-tab').forEach((button) => {
      const active = button.dataset.panel === name;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
      if (active) activeTab = button;
    });
    queryAll('[data-panel-page]').forEach((page) => {
      const active = page.dataset.panelPage === name;
      page.classList.toggle('is-active', active);
      page.hidden = !active;
    });
    this.dom.panelTitle.textContent = titles[name] || capitalize(name);
    if (activeTab && window.matchMedia('(max-width: 720px)').matches) {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      requestAnimationFrame(() => activeTab.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'nearest',
        inline: 'center',
      }));
    }
  }

  toggleAdvancedPanel() {
    const opening = !this.dom.controlPanel.classList.contains('is-open');
    this.dom.controlPanel.classList.toggle('is-open', opening);
    this.dom.panelToggle.classList.toggle('is-active', opening);
    this.dom.panelToggle.setAttribute('aria-expanded', String(opening));
    document.body.classList.toggle('panel-open', opening);
  }

  closeAdvancedPanel() {
    this.dom.controlPanel.classList.remove('is-open');
    this.dom.panelToggle.classList.remove('is-active');
    this.dom.panelToggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('panel-open');
  }

  // Stable aliases for earlier mobile-sheet callers.
  toggleMobilePanel() {
    this.toggleAdvancedPanel();
  }

  closeMobilePanel() {
    this.closeAdvancedPanel();
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
    const open = this.dom.controlPanel.classList.contains('is-open');
    this.dom.panelToggle.classList.toggle('is-active', open);
    this.dom.panelToggle.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('panel-open', open);
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
    if (event.defaultPrevented || event.altKey) return;
    const target = event.target;
    const editing = target instanceof HTMLInputElement
      || target instanceof HTMLSelectElement
      || target instanceof HTMLTextAreaElement;
    const key = event.key.toLowerCase();
    const presenting = document.body.classList.contains('presentation-mode');
    if (presenting) {
      if (key === 'escape' && document.body.dataset.presentationSource === 'editor') {
        this.actions.exitExperience?.();
      }
      return;
    }

    if ((event.ctrlKey || event.metaKey) && key === 's') {
      event.preventDefault();
      this.actions.saveProject?.();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === 'o') {
      event.preventDefault();
      this.dom.projectFileInput.click();
      return;
    }
    if (event.ctrlKey || event.metaKey || editing || this.dom.helpDialog.open) return;

    if (key === 'escape') {
      this.closeAdvancedPanel();
      this.toggleExportMenu(false);
      this.toggleProjectMenu(false);
      return;
    }
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
