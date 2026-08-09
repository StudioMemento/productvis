function positive(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export function computeExportFramePlan({
  viewportWidth,
  viewportHeight,
  outputWidth,
  outputHeight,
  mode = 'match',
} = {}) {
  const vw = positive(viewportWidth);
  const vh = positive(viewportHeight);
  const ow = Math.max(1, Math.round(positive(outputWidth)));
  const oh = Math.max(1, Math.round(positive(outputHeight)));
  const viewportAspect = vw / vh;
  const outputAspect = ow / oh;
  const normalizedMode = mode === 'fill' ? 'fill' : 'match';

  if (normalizedMode === 'fill') {
    let renderWidth;
    let renderHeight;
    if (viewportAspect >= outputAspect) {
      renderHeight = oh;
      renderWidth = Math.max(ow, Math.round(renderHeight * viewportAspect));
    } else {
      renderWidth = ow;
      renderHeight = Math.max(oh, Math.round(renderWidth / viewportAspect));
    }
    return {
      mode: 'fill',
      viewportAspect,
      outputWidth: ow,
      outputHeight: oh,
      renderWidth,
      renderHeight,
      source: {
        x: Math.max(0, Math.round((renderWidth - ow) / 2)),
        y: Math.max(0, Math.round((renderHeight - oh) / 2)),
        width: ow,
        height: oh,
      },
      destination: { x: 0, y: 0, width: ow, height: oh },
      hasBars: false,
    };
  }

  let destinationWidth;
  let destinationHeight;
  if (viewportAspect >= outputAspect) {
    destinationWidth = ow;
    destinationHeight = Math.max(1, Math.round(ow / viewportAspect));
  } else {
    destinationHeight = oh;
    destinationWidth = Math.max(1, Math.round(oh * viewportAspect));
  }

  return {
    mode: 'match',
    viewportAspect,
    outputWidth: ow,
    outputHeight: oh,
    renderWidth: destinationWidth,
    renderHeight: destinationHeight,
    source: { x: 0, y: 0, width: destinationWidth, height: destinationHeight },
    destination: {
      x: Math.round((ow - destinationWidth) / 2),
      y: Math.round((oh - destinationHeight) / 2),
      width: destinationWidth,
      height: destinationHeight,
    },
    hasBars: destinationWidth !== ow || destinationHeight !== oh,
  };
}

export function scaleExportFramePlanForGpu(plan, maxTextureSize) {
  if (!plan || typeof plan !== 'object') throw new TypeError('An export frame plan is required.');
  const limit = Math.max(1, Math.floor(positive(maxTextureSize, 4096)));
  const originalWidth = Math.max(1, Math.round(positive(plan.renderWidth)));
  const originalHeight = Math.max(1, Math.round(positive(plan.renderHeight)));
  const scale = Math.min(1, limit / originalWidth, limit / originalHeight);
  if (scale >= 1) return { ...plan, renderScale: 1, scaledForGpu: false };

  const renderWidth = Math.max(1, Math.floor(originalWidth * scale));
  const renderHeight = Math.max(1, Math.floor(originalHeight * scale));
  const scaleX = renderWidth / originalWidth;
  const scaleY = renderHeight / originalHeight;
  return {
    ...plan,
    renderWidth,
    renderHeight,
    source: {
      x: plan.source.x * scaleX,
      y: plan.source.y * scaleY,
      width: plan.source.width * scaleX,
      height: plan.source.height * scaleY,
    },
    renderScale: Math.min(scaleX, scaleY),
    scaledForGpu: true,
  };
}
