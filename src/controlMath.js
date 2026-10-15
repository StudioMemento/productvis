export function snapValue(value, min, max, step) {
  if (!Number.isFinite(value)) return min;
  const bounded = Math.min(max, Math.max(min, value));
  if (bounded === max || bounded === min) return bounded;
  return Math.min(max, Math.max(min, Number((min + Math.round((bounded - min) / step) * step).toFixed(6))));
}

export function dragValue(start, delta, min, max, step, fine = false) {
  return snapValue(start + delta * (max - min) / (fine ? 1200 : 180), min, max, step);
}
