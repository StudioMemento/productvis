export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** index);
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Math.round(value || 0));
}

export function formatCompact(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
  return String(Math.round(value || 0));
}

export function stripExtension(filename) {
  return filename.replace(/\.[^/.]+$/, '');
}

export function slugify(value) {
  return String(value || 'product-vis')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'product-vis';
}

export function cleanErrorMessage(error) {
  const message = error?.message || String(error || 'Unknown renderer error.');
  return message.replace(/^Error:\s*/i, '').slice(0, 180);
}

export function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
}
