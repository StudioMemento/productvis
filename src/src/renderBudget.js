// Bound full-screen postprocessing cost, including on Retina and 4K displays.
export function renderPixelRatio(width, height, deviceRatio = 1, quality = 'auto') {
  const pixels = Math.max(1, width) * Math.max(1, height);
  const budget = quality === 'high' ? 4_000_000 : quality === 'fluid' ? 1_000_000 : 2_000_000;
  const cap = quality === 'high' ? 2 : quality === 'fluid' ? 1 : width < 700 ? 1.3 : 1.5;
  return Math.min(Math.max(.1, deviceRatio || 1), cap, Math.sqrt(budget / pixels));
}
