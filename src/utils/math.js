export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

export function easeOutQuint(t) {
  return 1 - ((1 - t) ** 5);
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
