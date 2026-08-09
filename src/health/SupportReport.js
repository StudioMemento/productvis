function clone(value) {
  if (value === undefined) return null;
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function safeNavigator() {
  const source = globalThis.navigator || {};
  return {
    userAgent: String(source.userAgent || 'unknown').slice(0, 500),
    platform: String(source.platform || 'unknown').slice(0, 120),
    language: String(source.language || 'unknown').slice(0, 40),
    hardwareConcurrency: Number.isFinite(Number(source.hardwareConcurrency)) ? Number(source.hardwareConcurrency) : null,
    deviceMemory: Number.isFinite(Number(source.deviceMemory)) ? Number(source.deviceMemory) : null,
    maxTouchPoints: Number.isFinite(Number(source.maxTouchPoints)) ? Number(source.maxTouchPoints) : 0,
  };
}

export function createSupportReport({
  appVersion,
  project,
  modelPreflight,
  materialDiagnostics,
  cameraDiagnostics,
  performance,
  rendererCapabilities,
  recovery,
  viewport,
} = {}) {
  const safeProject = project && typeof project === 'object'
    ? {
      schemaVersion: project.schemaVersion ?? null,
      title: project.meta?.title ?? null,
      model: {
        name: project.model?.name ?? null,
        fileSize: project.model?.fileSize ?? null,
        procedural: project.model?.procedural ?? null,
        materialMode: project.model?.materialMode ?? null,
      },
      camera: {
        preset: project.camera?.preset ?? null,
        focalLength: project.camera?.focalLength ?? null,
        mode: project.camera?.mode ?? null,
      },
      motion: {
        clipsSelected: project.motion?.clipIndex ?? null,
        playing: project.motion?.playing ?? null,
        turntable: project.motion?.turntable ?? null,
      },
      configurator: {
        visibilityOverrides: Object.keys(project.configurator?.partVisibility || {}).length,
        visibilityStates: Array.isArray(project.configurator?.states) ? project.configurator.states.length : 0,
        anchors: Array.isArray(project.configurator?.anchors) ? project.configurator.anchors.length : 0,
        anchorDisplay: project.configurator?.anchorDisplay ?? null,
        variantGroups: Array.isArray(project.configurator?.variantGroups) ? project.configurator.variantGroups.length : 0,
        activeVariantSelections: Object.keys(project.configurator?.variantSelections || {}).length,
        savedConfigurations: Array.isArray(project.configurator?.configurations) ? project.configurator.configurations.length : 0,
        variantPreviewEnabled: project.configurator?.variantPreviewEnabled === true,
        infographics: Array.isArray(project.configurator?.infographics) ? project.configurator.infographics.length : 0,
        visibleInfographics: Array.isArray(project.configurator?.infographics)
          ? project.configurator.infographics.filter((item) => item?.visible !== false).length
          : 0,
        infographicDisplay: project.configurator?.infographicDisplay ?? null,
        selectedInfographic: project.configurator?.selectedInfographicId ? true : false,
        presentationStates: Array.isArray(project.configurator?.presentations) ? project.configurator.presentations.length : 0,
        activePresentation: project.configurator?.activePresentationId ? true : false,
        explodedPartOffsets: Object.keys(project.configurator?.explodeOffsets || {}).length,
        explodedStates: Array.isArray(project.configurator?.explodeStates) ? project.configurator.explodeStates.length : 0,
        animationChapters: Array.isArray(project.configurator?.animationChapters) ? project.configurator.animationChapters.length : 0,
        stories: Array.isArray(project.configurator?.stories) ? project.configurator.stories.length : 0,
        storySteps: Array.isArray(project.configurator?.stories)
          ? project.configurator.stories.reduce((total, story) => total + (Array.isArray(story?.steps) ? story.steps.length : 0), 0)
          : 0,
        storyPreviewEnabled: project.configurator?.storyPreviewEnabled === true,
      },
      render: {
        quality: project.render?.quality ?? null,
        exportFraming: project.render?.exportFraming ?? null,
      },
      runtime: {
        autoQuality: project.runtime?.autoQuality ?? null,
        pauseWhenHidden: project.runtime?.pauseWhenHidden ?? null,
        recoveryEnabled: project.runtime?.recoveryEnabled ?? null,
      },
    }
    : null;

  return {
    kind: 'productvis-support-report',
    reportVersion: 1,
    generatedAt: new Date().toISOString(),
    appVersion: String(appVersion || 'unknown'),
    browser: safeNavigator(),
    viewport: clone(viewport),
    renderer: clone(rendererCapabilities),
    project: safeProject,
    modelPreflight: clone(modelPreflight),
    materialDiagnostics: clone(materialDiagnostics),
    cameraDiagnostics: clone(cameraDiagnostics),
    performance: clone(performance),
    recovery: clone(recovery),
    privacy: 'Generated locally. No model bytes, textures, saved-look names, or project binary data are included.',
  };
}
