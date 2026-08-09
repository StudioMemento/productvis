function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function mapNdcToExport(ndc, plan) {
  if (!plan) return null;
  const x = finite(ndc?.x);
  const y = finite(ndc?.y);
  const z = finite(ndc?.z);
  if (z < -1 || z > 1) return null;
  const renderX = (x * 0.5 + 0.5) * plan.renderWidth;
  const renderY = (-y * 0.5 + 0.5) * plan.renderHeight;
  const source = plan.source;
  const destination = plan.destination;
  const outputX = destination.x + (renderX - source.x) * (destination.width / source.width);
  const outputY = destination.y + (renderY - source.y) * (destination.height / source.height);
  const visible = outputX >= -2
    && outputY >= -2
    && outputX <= plan.outputWidth + 2
    && outputY <= plan.outputHeight + 2;
  return { x: outputX, y: outputY, z, visible };
}

export function presentationSafeArea(width, height) {
  const w = Math.max(1, finite(width, 1));
  const h = Math.max(1, finite(height, 1));
  const shortest = Math.min(w, h);
  const margin = Math.max(28, Math.min(96, shortest * 0.055));
  return {
    margin,
    top: margin,
    left: margin,
    right: w - margin,
    bottom: h - margin,
    width: w - margin * 2,
    height: h - margin * 2,
  };
}

export function presentationCardSize(width, height) {
  const shortest = Math.min(Math.max(1, finite(width, 1)), Math.max(1, finite(height, 1)));
  return {
    width: Math.max(240, Math.min(430, shortest * 0.34)),
    minHeight: Math.max(110, Math.min(180, shortest * 0.15)),
    radius: Math.max(16, Math.min(28, shortest * 0.018)),
  };
}
